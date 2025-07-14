const mangayomiSources = [{
    "name": "Novelas Ligeras",
    "lang": "es",
    "baseUrl": "https://novelasligeras.net",
    "apiUrl": "",
    "iconUrl": "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.nova.png",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.0.4",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "novel/src/es/nova.js",
    "isNsfw": false,
    "hasCloudflare": true, // ✅ Mejorado con manejo inteligente de Cloudflare
    "notes": "Extensión para NovelasLigeras.net con manejo avanzado de Cloudflare, reintentos automáticos y delays progresivos"
}];

class DefaultExtension extends MProvider {
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": this.source.baseUrl,
        "Origin": this.source.baseUrl,
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Cache-Control": "max-age=0"
    };

    _parseLatestUpdatesList(doc) {
        const list = [];
        const processedLinks = new Set();

        // CORREGIDO: Selector para la grilla de productos de WooCommerce
        const productGrid = doc.selectFirst("div.products-shortcode.products-masonry-shortcode-id-1dc0a3eb33bd0de0463e644559d7d294 div.dt-css-grid");

        if (!productGrid) {
            console.warn("❌ No se encontró la grilla de productos de Últimas Actualizaciones");
            return { list: [], hasNextPage: false };
        }

        const productCells = productGrid.select("div.wf-cell article.product");
        console.log(`🔍 Productos encontrados en Últimas Actualizaciones: ${productCells.length}`);

        for (const article of productCells) {
            const titleElement = article.selectFirst("h4.entry-title a");
            const name = titleElement?.text.trim();
            const link = titleElement?.getHref;

            const imgElement = article.selectFirst("figure.woocom-project img:not(.show-on-hover)");
            let imageUrl = imgElement?.getSrc || imgElement?.attr("data-src");

            if (name && link && !processedLinks.has(link) && name.length > 3 &&
                !name.toLowerCase().includes('capítulo') &&
                !name.toLowerCase().includes('chapter')) {

                const absoluteImageUrl = this.normalizeUrl(imageUrl, this.source.baseUrl) || this.source.iconUrl;

                list.push({
                    name,
                    imageUrl: absoluteImageUrl,
                    link,
                });
                processedLinks.add(link);
                console.log(`✅ Agregado: ${name} - ${link}`);
            }
        }

        console.log(`📊 Total de novelas procesadas: ${list.length}`);
        return { list: list, hasNextPage: false };
    }

    _parseNovelList(doc) {
        const list = [];
        const processedLinks = new Set();

        // Selector para la lista de novelas con paginación
        const productGrid = doc.selectFirst("div.woocommerce.columns-4 ul.products");

        if (!productGrid) {
            console.warn("❌ No se encontró la grilla de productos");
            return { list: [], hasNextPage: false };
        }

        const products = productGrid.select("li.product");
        console.log(`🔍 Productos encontrados: ${products.length}`);

        for (const product of products) {
            const titleElement = product.selectFirst("h2.woocommerce-loop-product__title a, h3.woocommerce-loop-product__title a");
            const name = titleElement?.text.trim();
            const link = titleElement?.getHref;

            // Buscar imagen en diferentes ubicaciones posibles
            let imageUrl = product.selectFirst("img")?.getSrc ||
                product.selectFirst("img")?.attr("data-src") ||
                product.selectFirst("img")?.attr("src");

            if (name && link && !processedLinks.has(link) && name.length > 3 &&
                !name.toLowerCase().includes('capítulo') &&
                !name.toLowerCase().includes('chapter')) {

                const absoluteImageUrl = this.normalizeUrl(imageUrl, this.source.baseUrl) || this.source.iconUrl;

                list.push({
                    name,
                    imageUrl: absoluteImageUrl,
                    link,
                });
                processedLinks.add(link);
                console.log(`✅ Agregado: ${name} - ${link}`);
            }
        }

        // Verificar si hay próxima página
        const nextPageLink = doc.selectFirst("a.next.page-numbers, .woocommerce-pagination .next");
        const hasNextPage = nextPageLink !== null;

        console.log(`📊 Total de novelas procesadas: ${list.length}, Próxima página: ${hasNextPage}`);
        return { list, hasNextPage };
    }

    // ==================== FUNCIONES AUXILIARES ====================
    
    /**
     * Función para manejar Cloudflare con reintentos y delays
     */
    async _fetchWithCloudflareHandling(url, options = {}) {
        const maxRetries = 3;
        const delays = [2000, 5000, 10000]; // 2s, 5s, 10s
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`🌐 Intento ${attempt + 1}/${maxRetries} para: ${url}`);
                
                // Añadir delay progresivo para evitar rate limiting
                if (attempt > 0) {
                    console.log(`⏳ Esperando ${delays[attempt - 1]}ms antes del siguiente intento...`);
                    await this._delay(delays[attempt - 1]);
                }
                
                // Headers más completos para simular navegador real
                const enhancedHeaders = {
                    ...this.headers,
                    "Cache-Control": attempt === 0 ? "no-cache" : "max-age=300",
                    "Pragma": attempt === 0 ? "no-cache" : undefined
                };
                
                const client = new Client();
                const res = await client.get(url, enhancedHeaders);
                
                // Verificar si la respuesta contiene Cloudflare challenge
                if (res.body.includes('Checking your browser') || 
                    res.body.includes('cloudflare') ||
                    res.body.includes('cf-ray') ||
                    res.status === 503) {
                    
                    console.warn(`🛡️ Cloudflare detectado en intento ${attempt + 1}`);
                    if (attempt === maxRetries - 1) {
                        throw new Error("Cloudflare bloqueó todas las peticiones después de varios intentos");
                    }
                    continue;
                }
                
                console.log(`✅ Petición exitosa en intento ${attempt + 1}`);
                return res;
                
            } catch (error) {
                console.error(`❌ Error en intento ${attempt + 1}:`, error.message);
                
                if (attempt === maxRetries - 1) {
                    throw new Error(`Falló después de ${maxRetries} intentos: ${error.message}`);
                }
            }
        }
    }
    
    /**
     * Función de delay para esperas
     */
    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Extrae metadatos básicos de la página de detalle
     */
    _extractNovelMetadata(doc) {
        // Título
        const title = doc.selectFirst("h1.product_title.entry-title")?.text.trim() || "";
        
        // Imagen con múltiples selectores
        let imageUrl = doc.selectFirst("div.woocommerce-product-gallery img")?.getSrc ||
                      doc.selectFirst("div.vc_single_image-wrapper img")?.getSrc ||
                      doc.selectFirst("figure.wpb_wrapper img")?.getSrc ||
                      doc.selectFirst("meta[property='og:image']")?.attr("content") ||
                      this.source.iconUrl;

        // Descripción inteligente
        const descElement = doc.selectFirst("div.woocommerce-product-details__short-description, div.product-short-description, div.wpb_wrapper p");
        let description = descElement?.text.trim() || "";
        
        if (!description || description.length < 50) {
            const contentElements = doc.select("div.wpb_text_column p, div.vc_column-inner p");
            for (const elem of contentElements) {
                const text = elem.text.trim();
                if (text.length > 50 && 
                    !text.toLowerCase().includes("capítulo") && 
                    !text.toLowerCase().includes("volumen")) {
                    description = text;
                    break;
                }
            }
        }
        
        if (!description || description.length < 20) {
            description = "Sin descripción disponible";
        }

        // Información adicional
        const author = doc.selectFirst("span.posted_in a")?.text.trim() || "Autor desconocido";
        const genreElements = doc.select("span.posted_in a, .product_meta a");
        const genre = genreElements.map(el => el.text.trim()).filter(g => g && g.length > 0) || ["Sin género"];
        const status = 0; // Por defecto "En curso"

        return {
            title,
            imageUrl: this.normalizeUrl(imageUrl, this.source.baseUrl) || this.source.iconUrl,
            description,
            author,
            genre,
            status
        };
    }

    /**
     * Extrae todos los capítulos de las pestañas de la novela
     */
    _extractChaptersFromTabs(doc) {
        const chapters = [];
        
        console.log("🔍 Buscando capítulos en pestañas...");

        // 1. Buscar todos los paneles de pestañas (tanto visibles como ocultos)
        const tabPanels = doc.select("div.wpb_tab.ui-tabs-panel");
        
        console.log(`📑 Pestañas encontradas: ${tabPanels.length}`);

        for (let i = 0; i < tabPanels.length; i++) {
            const panel = tabPanels[i];
            
            // Obtener el nombre de la pestaña
            const tabId = panel.attr("id");
            const tabTitle = doc.selectFirst(`a[href="#${tabId}"]`)?.text.trim() || `Pestaña ${i + 1}`;
            
            console.log(`📖 Procesando: ${tabTitle}`);
            
            // 2. Buscar todos los enlaces de capítulos en esta pestaña
            const chapterLinks = panel.select("div.post-content a[href*='novelasligeras.net']");
            
            console.log(`📝 Enlaces encontrados en ${tabTitle}: ${chapterLinks.length}`);
            
            for (const link of chapterLinks) {
                const chapterTitle = link.text.trim();
                const chapterUrl = link.getHref;
                
                // Filtrar enlaces válidos
                if (this._isValidChapterLink(chapterUrl, chapterTitle)) {
                    const chapterNumber = this._extractChapterNumber(chapterTitle);
                    
                    chapters.push({
                        name: chapterTitle,
                        url: chapterUrl,
                        date_upload: "",
                        chapterNumber: chapterNumber
                    });
                    
                    console.log(`✅ Capítulo agregado: ${chapterTitle}`);
                }
            }
        }

        // 3. Si no se encontraron capítulos en pestañas, buscar en el contenido general
        if (chapters.length === 0) {
            console.log("⚠️ No se encontraron capítulos en pestañas, buscando en contenido general...");
            
            const allLinks = doc.select("a[href*='novelasligeras.net'][href*='capitulo'], a[href*='novelasligeras.net'][href*='parte']");
            
            for (const link of allLinks) {
                const chapterTitle = link.text.trim();
                const chapterUrl = link.getHref;
                
                if (this._isValidChapterLink(chapterUrl, chapterTitle)) {
                    const chapterNumber = this._extractChapterNumber(chapterTitle);
                    
                    chapters.push({
                        name: chapterTitle,
                        url: chapterUrl,
                        date_upload: "",
                        chapterNumber: chapterNumber
                    });
                }
            }
        }

        // 4. Ordenar capítulos por número
        chapters.sort((a, b) => {
            if (a.chapterNumber !== b.chapterNumber) {
                return a.chapterNumber - b.chapterNumber;
            }
            return a.name.localeCompare(b.name);
        });

        console.log(`✅ Total de capítulos extraídos: ${chapters.length}`);
        
        // Limpiar y devolver
        return chapters.map(ch => ({
            name: ch.name,
            url: ch.url,
            date_upload: ch.date_upload
        }));
    }

    /**
     * Valida si un enlace es un capítulo válido
     */
    _isValidChapterLink(url, title) {
        return url && title && 
               title.length > 5 &&
               (title.toLowerCase().includes("capítulo") ||
                title.toLowerCase().includes("parte") ||
                /cap[íi]tulo\s*\d+/i.test(title));
    }

    /**
     * Extrae número de capítulo para ordenamiento
     */
    _extractChapterNumber(title) {
        // Buscar patrones como "Capítulo 15", "Parte 1 – Capítulo 11", etc.
        const patterns = [
            /capítulo\s*(\d+)/i,
            /cap[íi]tulo\s*(\d+)/i,
            /chapter\s*(\d+)/i,
            /parte\s*\d+\s*[–-]\s*capítulo\s*(\d+)/i,
            /(\d+).*capítulo/i,
            /(\d+)/  // Último recurso: cualquier número
        ];

        for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match) {
                return parseInt(match[1]) || 0;
            }
        }

        return 0;
    }

    /**
     * Extrae contenido HTML del capítulo (mejorado para NovelasLigeras.net)
     */
    _extractChapterContent(doc, name) {
        // Extraer título del capítulo
        const title = doc.selectFirst("h1.entry-title, h1.product_title, h2")?.text.trim() || name;

        // NUEVO: Selector específico para el contenido del lector
        let content = "";
        
        // 1. Intentar extraer del contenedor principal del lector
        const readerBoxes = doc.select("div#readerBox");
        if (readerBoxes.length > 0) {
            console.log(`📖 Encontradas ${readerBoxes.length} cajas de lector`);
            
            // Combinar todo el contenido de las cajas de lector
            for (const box of readerBoxes) {
                content += box.innerHtml + "\n";
            }
        }
        
        // 2. Si no hay readerBox, usar selectores alternativos
        if (!content || content.trim().length < 100) {
            content = doc.selectFirst("div.entry-content")?.innerHtml ||
                     doc.selectFirst("div.wpb_text_column .wpb_wrapper")?.innerHtml ||
                     doc.selectFirst("div.product-description")?.innerHtml ||
                     "";
        }

        // 3. Si todavía no hay contenido suficiente, buscar en todo el contenido de la página
        if (!content || content.trim().length < 100) {
            const contentElements = doc.select("div.wpb_wrapper p, div.vc_column-inner p");
            const paragraphs = [];
            
            for (const elem of contentElements) {
                const text = elem.text.trim();
                if (text.length > 30 && 
                    !text.toLowerCase().includes("novelas ligeras") &&
                    !text.toLowerCase().includes("copyright")) {
                    paragraphs.push(`<p>${text}</p>`);
                }
            }
            
            if (paragraphs.length > 0) {
                content = paragraphs.join("\n");
            }
        }

        // Limpiar el contenido
        const cleanContent = content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<div class="adsbygoogle"[^>]*>[\s\S]*?<\/div>/gi, "")
            .replace(/&nbsp;/g, " ")
            .replace(/<p>\s*<\/p>/g, "") // Remover párrafos vacíos
            .trim();

        return `<h2>${title}</h2><hr><br>${cleanContent || "<p>No se pudo extraer el contenido del capítulo.</p>"}`;
    }

    // ==================== FUNCIONES PRINCIPALES ====================


    async getLatestUpdates(page) {
        if (page > 1) {
            return { list: [], hasNextPage: false };
        }

        const res = await this._fetchWithCloudflareHandling(this.source.baseUrl);
        const doc = new Document(res.body);
        return this._parseLatestUpdatesList(doc);
    }

    async getPopular(page) {
        const url = page === 1
            ? `${this.source.baseUrl}/index.php/lista-de-novela-ligera-novela-web/?orderby=popularity`
            : `${this.source.baseUrl}/index.php/lista-de-novela-ligera-novela-web/page/${page}/?orderby=popularity`;

        const res = await this._fetchWithCloudflareHandling(url);
        const doc = new Document(res.body);
        return this._parseNovelList(doc);
    }

    async mangaListFromPage(res) {
        const doc = new Document(res.body);
        return this._parseNovelList(doc);
    }

    async search(query, page, filters) {
        const searchUrl = page === 1
            ? `${this.source.baseUrl}/?s=${encodeURIComponent(query)}&post_type=product`
            : `${this.source.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}&post_type=product`;

        const res = await this._fetchWithCloudflareHandling(searchUrl);
        const doc = new Document(res.body);
        return this._parseNovelList(doc);
    }

    async getDetail(url) {
        const res = await this._fetchWithCloudflareHandling(url);
        const doc = new Document(res.body);

        // Usar funciones auxiliares
        const metadata = this._extractNovelMetadata(doc);
        const chapters = this._extractChaptersFromTabs(doc);

        return {
            imageUrl: metadata.imageUrl,
            description: metadata.description,
            genre: metadata.genre,
            author: metadata.author,
            artist: "Artista desconocido",
            status: metadata.status,
            chapters: chapters
        };
    }

    async getHtmlContent(name, url) {
        const res = await this._fetchWithCloudflareHandling(url);
        const doc = new Document(res.body);

        // Usar función auxiliar
        return this._extractChapterContent(doc, name);
    }

    normalizeUrl(url, baseUrl) {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        return new URL(url, baseUrl).href;
    }

    toStatus(status) {
        if (status?.toLowerCase().includes("completado") || status?.toLowerCase().includes("completed")) return 1;
        if (status?.toLowerCase().includes("en curso") || status?.toLowerCase().includes("ongoing")) return 0;
        if (status?.toLowerCase().includes("pausado") || status?.toLowerCase().includes("hiatus")) return 2;
        if (status?.toLowerCase().includes("cancelado") || status?.toLowerCase().includes("dropped")) return 3;
        return 5; // Desconocido
    }

    getFilterList() {
        return [
            {
                type_name: "SelectFilter",
                name: "Ordenar por",
                state: 0,
                values: [
                    {
                        type_name: "SelectOption",
                        name: "Popularidad",
                        value: "popularity",
                    },
                    {
                        type_name: "SelectOption",
                        name: "Más recientes",
                        value: "date",
                    },
                    {
                        type_name: "SelectOption",
                        name: "Título",
                        value: "title",
                    },
                ],
            }
        ];
    }

    getSourcePreferences() {
        return [];
    }

    getHeaders(url) {
        return this.headers;
    }
}