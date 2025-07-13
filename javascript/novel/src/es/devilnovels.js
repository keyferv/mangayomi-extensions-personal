const mangayomiSources = [{
    "name": "Devil Novels",
    "lang": "es",
    "baseUrl": "https://devilnovels.com",
    "apiUrl": "", "iconUrl": "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.devilnovels.png",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.0.2",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "novel/src/es/devilnovels.js",
    "isNsfw": false,
    "hasCloudflare": true,
    "notes": "Y esperemos q no falle"
}];

class DefaultExtension extends MProvider {
    headers = {
        Referer: this.source.baseUrl,
        Origin: this.source.baseUrl,
        Connection: "keep-alive",
        Accept: "*/*",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Sec-Fetch-Mode": "cors",
        "Accept-Encoding": "gzip, deflate",
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    };

    _parseLatestUpdatesList(doc) {
        const list = [];
        const processedLinks = new Set();
        // Usamos un selector más general que cubre más casos
        const updatesSection = doc.selectFirst("div.elementor-element-bf49f11 table tbody, div.site-content div.elementor-element-bf49f11");

        if (!updatesSection) {
            return { list: [], hasNextPage: false };
        }

        const novelRows = updatesSection.select("tr, article.post"); // Incluimos articles para mayor robustez
        for (const row of novelRows) {
            const linkElement = row.selectFirst("td:first-child a[data-wpel-link='internal'], h2.entry-title a, h3.elementor-post__title a");
            const link = linkElement?.getHref;
            // Intentamos obtener la imagen de varias ubicaciones
            let imageUrl = row.selectFirst("td:first-child div > img")?.getSrc ||
                row.selectFirst("img")?.getSrc; // Nuevo selector para img directamente
            const name = linkElement?.text.trim();

            if (link && name && !processedLinks.has(link) && name.length > 2 &&
                !name.includes('Capítulo') && !name.includes('Chapter')) {
                // Si no se encontró imageUrl, usar la por defecto
                if (!imageUrl || imageUrl.startsWith("data:")) {
                    imageUrl = this.source.iconUrl;
                }
                list.push({ name, imageUrl, link });
                processedLinks.add(link);
            }
        }
        return { list: list, hasNextPage: false };
    }

    // ...existing code...

    _parseRankingList(doc) {
        const list = [];
        const processedLinks = new Set();
        const rankingSection = doc.selectFirst("div.elementor-element-fc0fa0f div.pvc-top-pages");

        if (!rankingSection) {
            return { list: [], hasNextPage: false };
        }

        const mangaElements = rankingSection.select("div[style*='width: 150px;']");
        for (const element of mangaElements) {
            const linkElement = element.selectFirst("a[data-wpel-link='internal']");
            const link = linkElement?.getHref;
            let imageUrl = element.selectFirst("img")?.getSrc;
            const name = element.selectFirst("p > a[data-wpel-link='internal']")?.text.trim();

            if (link && name && !processedLinks.has(link) && name.length > 2 &&
                !name.includes('Capítulo') && !name.includes('Chapter') &&
                !link.includes('page/') && !link.includes('category/')) {

                if (!imageUrl || imageUrl.startsWith("data:")) {
                    imageUrl = this.source.iconUrl;
                }

                // CORREGIDO: ¡Estas eran las líneas que faltaban!
                list.push({ name, imageUrl, link });
                processedLinks.add(link);
            }
        }
        return { list: list, hasNextPage: false };
    }

    // ...existing code...

    _parseSearchResults(doc) {
        const list = [];
        const processedLinks = new Set();

        // CORREGIDO: Selector más amplio para capturar todos los tipos de artículos
        const entryElements = doc.select("article.post, article.page, article[class*='post-']");

        for (const element of entryElements) {
            // 1. Primero intentar detectar si es entrada directa de novela
            const titleElement = element.selectFirst("h2.entry-title a");
            const imgElement = element.selectFirst("img");

            let novelName = titleElement?.text.trim() || "";
            let novelLink = titleElement?.getHref;
            let imageUrl = imgElement?.getSrc || this.source.iconUrl;

            // 2. Si tenemos entrada directa válida, procesarla
            if (novelLink && novelName &&
                !novelName.toLowerCase().includes("capítulo") &&
                !novelName.toLowerCase().includes("chapter") &&
                !novelLink.includes('/category/') &&
                !novelLink.includes('/tag/') &&
                !novelLink.includes('/author/') &&
                !novelLink.includes('/page/') &&
                !processedLinks.has(novelLink)) {

                // Validar imagen
                if (!imageUrl || imageUrl.startsWith("data:")) {
                    imageUrl = this.source.iconUrl;
                }

                list.push({ name: novelName, imageUrl, link: novelLink });
                processedLinks.add(novelLink);
                continue; // Saltar al siguiente elemento
            }

            // 3. Si no es entrada directa, verificar si es capítulo con categoría
            const categoryLinkElement = element.selectFirst("span.cat-links a[data-wpel-link='internal']");
            if (categoryLinkElement) {
                const categoryName = categoryLinkElement.text.trim();
                const categoryHref = categoryLinkElement.getHref;

                if (categoryHref && categoryHref.includes('/category/')) {
                    const categorySlug = categoryHref.split('/category/')[1].replace('/', '');

                    // Mapeo manual para casos conocidos
                    const slugMappings = {
                        'chaotic-sword-god': 'Chaotic-Sword-God',
                        'the-main-heroines-are-trying-to-kill-me': 'las-heroinas-principales-estan-tratando-de-matarme',
                        'sovereign-of-the-three-realms': 'soberano-de-los-tres-reinos',
                        'emperors-domination': 'emperors-dominacion',
                        'tales-of-demons-and-gods': 'historia-de-demonios-y-dioses'
                    };

                    const mappedSlug = slugMappings[categorySlug] || categorySlug;
                    const novelLinkFromCategory = `${this.source.baseUrl}/${mappedSlug}/`;

                    // Intentar extraer nombre en español del título del capítulo
                    const chapterTitleElement = element.selectFirst("h2.entry-title a");
                    let extractedNovelName = categoryName;

                    if (chapterTitleElement) {
                        const chapterTitle = chapterTitleElement.text.trim();
                        const extracted = this._extractNovelNameFromChapter(chapterTitle);
                        if (extracted && extracted.length > categoryName.length) {
                            extractedNovelName = extracted;
                        }
                    }

                    if (!processedLinks.has(novelLinkFromCategory) &&
                        !extractedNovelName.toLowerCase().includes("capítulo") &&
                        !extractedNovelName.toLowerCase().includes("chapter")) {

                        list.push({
                            name: extractedNovelName,
                            imageUrl: this.source.iconUrl,
                            link: novelLinkFromCategory
                        });
                        processedLinks.add(novelLinkFromCategory);
                    }
                }
            }
        }

        const nextPageElement = doc.selectFirst("a.nextpostslink, .nav-links .next, .page-numbers .next");
        const hasNextPage = nextPageElement !== null;

        return { list, hasNextPage };
    }

    // ...existing code...

    // Función auxiliar para extraer el nombre de la novela del título del capítulo
    _extractNovelNameFromChapter(chapterTitle) {
        // Ejemplos: "Las Heroínas Principales Están Tratando de Matarme Capítulo 123"
        // -> "Las Heroínas Principales Están Tratando de Matarme"

        const patterns = [
            /^(.+?)\s+capítulo\s+\d+/i,
            /^(.+?)\s+chapter\s+\d+/i,
            /^(.+?)\s+cap\s+\d+/i,
            /^(.+?)\s+episodio\s+\d+/i
        ];

        for (const pattern of patterns) {
            const match = chapterTitle.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        // Fallback: tomar todo antes del último número
        const lastNumberIndex = chapterTitle.lastIndexOf(/\d+/.exec(chapterTitle)?.[0] || '');
        if (lastNumberIndex > 0) {
            return chapterTitle.substring(0, lastNumberIndex).trim();
        }

        return chapterTitle;
    }

    // Función auxiliar para construir el enlace de la novela desde un enlace de capítulo
    _buildNovelLinkFromChapter(chapterLink) {
        // Ejemplo: "https://devilnovels.com/las-heroinas/capitulo-123/"
        // -> "https://devilnovels.com/las-heroinas/"

        if (!chapterLink) return null;

        // Remover la parte del capítulo
        const urlParts = chapterLink.split('/');

        // Buscar y remover partes que contengan "capitulo", "chapter", etc.
        const filteredParts = urlParts.filter(part =>
            !part.toLowerCase().includes('capitulo') &&
            !part.toLowerCase().includes('chapter') &&
            !part.toLowerCase().includes('cap-') &&
            !/^\d+$/.test(part) // Remover números solos
        );

        // Reconstruir la URL
        const novelUrl = filteredParts.join('/');
        return novelUrl.endsWith('/') ? novelUrl : novelUrl + '/';
    }

    // ...existing code...


    _parseChaptersFromPage(doc) {
        const allChapters = [];
        const containers = doc.select('.elementor-posts-container');

        if (containers.length === 0) {
            const articles = doc.select("article.elementor-post");
            articles.forEach(article => {
                const a = article.selectFirst("h3.elementor-post__title a, h4.elementor-post__title a");
                if (a) {
                    allChapters.push({
                        name: a.text.trim(),
                        url: a.getHref,
                        dateUpload: String(Date.now()),
                        scanlator: null
                    });
                }
            });
        } else {
            containers.forEach(container => {
                const articles = container.select("article.elementor-post");
                const chaptersInContainer = articles.map(article => {
                    const a = article.selectFirst("h3.elementor-post__title a, h4.elementor-post__title a");
                    if (!a) return null;

                    return {
                        name: a.text.trim(),
                        url: a.getHref,
                        dateUpload: String(Date.now()),
                        scanlator: null
                    };
                }).filter(Boolean);

                if (chaptersInContainer.length > 1) {
                    allChapters.push(...chaptersInContainer);
                }
            });
        }
        console.log(`✅ Capítulos extraídos de la página (dentro de _parseChaptersFromPage): ${allChapters.length}`);
        return allChapters;
    }

    slugify(text) {
        return text
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-") // reemplazar todo por guiones
            .replace(/(^-|-$)+/g, "") // quitar guiones al principio o final
            .replace(/--+/g, "-"); // limpiar guiones dobles
    }


    getHeaders(url) {
        return this.headers;
    }

    mangaListFromPage(res) {
        const doc = new Document(res.body);
        const list = [];
        const processedLinks = new Set();

        // CORREGIDO: Selector que SÍ funciona
        const entryElements = doc.select("article.post, div.post-item, div.novel-item, div.elementor-post");

        for (const element of entryElements) {
            // CORREGIDO: Agregar verificación de existencia antes de acceder a getHref
            let link = element.selectFirst("a[data-wpel-link='internal']")?.getHref;
            if (!link) {
                link = element.selectFirst("a[href*='devilnovels.com/']")?.getHref;
            }

            let imageUrl = element.selectFirst("img")?.getSrc;
            let name = element.selectFirst("h2.entry-title a, h3.entry-title a, .novel-title a, .elementor-post__title a")?.text.trim();

            if (!name) {
                name = element.selectFirst("a")?.text.trim();
            }

            if (link && name && !processedLinks.has(link) &&
                !link.includes('/page/') && !link.includes('/category/') &&
                !link.includes('/tag/') && !link.includes('/author/') &&
                !link.includes('/comments') && !name.includes('Capítulo') && !name.includes('Chapter')) {

                // CORREGIDO: Asegurar que la imagen sea válida
                if (!imageUrl || imageUrl.startsWith("data:")) {
                    imageUrl = this.source.iconUrl;
                }

                list.push({ name, imageUrl, link });
                processedLinks.add(link);
            }
        }

        const hasNextPage = doc.selectFirst("a.nextpostslink, a.next, .nav-links .next, .elementor-pagination .elementor-pagination__next") !== null;
        return { list: list, hasNextPage };
    }

    toStatus(status) {
        if (status.includes("En curso") || status.includes("Ongoing")) return 0;
        else if (status.includes("Completado") || status.includes("Completed")) return 1;
        else if (status.includes("Hiatus") || status.includes("Pausado")) return 2;
        else if (status.includes("Cancelado") || status.includes("Dropped")) return 3;
        else return 5;
    }

    async getPopular(page) {
        const res = await new Client().get(`${this.source.baseUrl}/`, this.headers);
        const doc = new Document(res.body);
        return this._parseRankingList(doc);
    }

    async getLatestUpdates(page) {
        const res = await new Client().get(`${this.source.baseUrl}/`, this.headers);
        const doc = new Document(res.body);
        return this._parseLatestUpdatesList(doc);
    }

    // ...existing code...

    // ...existing code...

    async search(query, page, filters) {
        const url = `${this.source.baseUrl}/?s=${encodeURIComponent(query)}&paged=${page}`;
        const res = await new Client().get(url, this.headers);
        const doc = new Document(res.body);

        const list = [];
        const processedLinks = new Set();
        const entryElements = doc.select("article.post");

        for (const element of entryElements) {
            // 1. Detectar si es capítulo con categoría
            const categoryLinkElement = element.selectFirst("span.cat-links a[data-wpel-link='internal']");
            const isChapter = !!categoryLinkElement;

            let novelName = "";
            let novelLink = "";
            let imageUrl = "";

            if (isChapter) {
                // ← CAPÍTULO, necesitamos convertir category URL a novela URL
                const categoryHref = categoryLinkElement.getHref;

                // Extraer el slug de la categoría
                if (categoryHref && categoryHref.includes('/category/')) {
                    const categorySlug = categoryHref.split('/category/')[1].replace('/', '');

                    // NUEVO: Mapeo manual para casos conocidos problemáticos
                    const slugMappings = {
                        'chaotic-sword-god': 'Chaotic-Sword-God',
                        'the-main-heroines-are-trying-to-kill-me': 'las-heroinas-principales-estan-tratando-de-matarme',
                        'sovereign-of-the-three-realms': 'soberano-de-los-tres-reinos',
                        'emperors-domination': 'emperors-dominacion'
                    };

                    const mappedSlug = slugMappings[categorySlug] || categorySlug;
                    novelLink = `${this.source.baseUrl}/${mappedSlug}/`;

                    // Usar el nombre en español si existe, sino el de la categoría
                    novelName = categoryLinkElement.text.trim();

                    // NUEVO: Intentar obtener nombre en español desde el título del capítulo
                    const chapterTitleElement = element.selectFirst("h2.entry-title a");
                    if (chapterTitleElement) {
                        const chapterTitle = chapterTitleElement.text.trim();
                        const extractedNovelName = this._extractNovelNameFromChapter(chapterTitle);
                        if (extractedNovelName && extractedNovelName.length > novelName.length) {
                            novelName = extractedNovelName;
                        }
                    }
                } else {
                    // Fallback al método anterior
                    novelName = categoryLinkElement.text.trim();
                    const slug = this.slugify(novelName);
                    novelLink = `${this.source.baseUrl}/${slug}/`;
                }

                imageUrl = this.source.iconUrl;
            } else {
                // ← ENTRADA DE NOVELA DIRECTA
                const titleElement = element.selectFirst("h2.entry-title a");
                const imgElement = element.selectFirst("img");
                novelName = titleElement?.text.trim() || "";
                novelLink = titleElement?.getHref;
                imageUrl = imgElement?.getSrc || this.source.iconUrl;
            }

            // Validación mejorada
            if (novelLink && novelName && !processedLinks.has(novelLink) &&
                !novelName.toLowerCase().includes("capítulo") &&
                !novelName.toLowerCase().includes("chapter") &&
                !novelLink.includes('/tag/') &&
                !novelLink.includes('/author/') &&
                !novelLink.includes('/page/') &&
                !novelLink.includes('/category/')) { // Excluir URLs de categorías que no se pudieron convertir

                list.push({ name: novelName, imageUrl, link: novelLink });
                processedLinks.add(novelLink);
            }
        }

        const nextPageElement = doc.selectFirst("a.nextpostslink, .nav-links .next, .page-numbers .next");
        const hasNextPage = nextPageElement !== null;

        return { list, hasNextPage };
    }

    // MEJORAR la función _extractNovelNameFromChapter para manejar mejor los títulos
    _extractNovelNameFromChapter(chapterTitle) {
        // Ejemplos: "Las Heroínas Principales Están Tratando de Matarme Capitulo 517.2"
        // -> "Las Heroínas Principales Están Tratando de Matarme"

        const patterns = [
            /^(.+?)\s+capítulo\s+[\d.]+/i,
            /^(.+?)\s+chapter\s+[\d.]+/i,
            /^(.+?)\s+cap\s+[\d.]+/i,
            /^(.+?)\s+episodio\s+[\d.]+/i,
            /^(.+?)\s+\d+[\d.]*$/i  // Patrón para títulos que terminan solo en número
        ];

        for (const pattern of patterns) {
            const match = chapterTitle.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        // Fallback: tomar todo antes del último número
        const numberMatch = chapterTitle.match(/(.+?)\s+[\d.]+\s*$/);
        if (numberMatch) {
            return numberMatch[1].trim();
        }

        return chapterTitle;
    }

    // ...existing code...

    // ...existing code...
    // ...existing code...

    async getDetail(url) {
        const client = new Client();
        const MAX_PAGES = 35;
        const REPEAT_LIMIT = 5;
        const allChapters = [];
        const seenUrls = new Set();
        let repeatCount = 0;

        const fallbackWidgetId = "bc939d8";
        let widgetId = fallbackWidgetId;

        console.log(`✨ Iniciando getDetail para URL: ${url}`);

        // 1. Obtener la primera página
        const initialRes = await client.get(url, this.headers);
        const initialDoc = new Document(initialRes.body);

        // CORREGIDO: Extracción completa de metadatos de novela

        // --- Extracción de imagen con múltiples selectores ---
        let imageUrl = initialDoc.selectFirst("div.separator img")?.getSrc ||
            initialDoc.selectFirst("p img.aligncenter")?.getSrc ||
            initialDoc.selectFirst("div.elementor-widget-container img")?.getSrc ||
            initialDoc.selectFirst("div.entry-content img")?.getSrc ||
            initialDoc.selectFirst("div.post-content img")?.getSrc ||
            initialDoc.selectFirst("article img")?.getSrc ||
            initialDoc.selectFirst("meta[property='og:image']")?.attr("content") ||
            this.source.iconUrl; // IMPORTANTE: siempre tener fallback

        // --- Extracción mejorada de descripción ---
        let description = initialDoc.selectFirst("div.entry-content p")?.text.trim() ||
            initialDoc.selectFirst("div.elementor-widget-container p")?.text.trim() ||
            initialDoc.selectFirst("div.post-content p")?.text.trim() ||
            initialDoc.selectFirst("meta[property='og:description']")?.attr("content") ||
            initialDoc.selectFirst("meta[name='description']")?.attr("content") ||
            "Sin descripción disponible"; // IMPORTANTE: siempre tener fallback

        // Limpiar la descripción de elementos no deseados
        if (description && description !== "Sin descripción disponible") {
            description = description
                .replace(/El Jefe Final me propuso matrimonio\.?\s*/i, "")
                .replace(/Este capítulo ha sido traducido por[\s\S]*$/i, "")
                .replace(/Puedes leer más capítulos[\s\S]*$/i, "")
                .replace(/No se permite la reproducción[\s\S]*$/i, "")
                .trim() || "Sin descripción disponible";
        }

        // --- Extracción de géneros ---
        const genre = initialDoc.select("span.post-categories a, a[rel='tag'], .genre-links a")
            .map(e => e.text.trim())
            .filter(g => g && g.length > 0) || ["Sin género"]; // IMPORTANTE: siempre array válido

        // --- Extracción de autor ---
        const author = initialDoc.selectFirst("span.author a")?.text.trim() ||
            initialDoc.selectFirst("meta[name='author']")?.attr("content") ||
            "Autor desconocido"; // IMPORTANTE: siempre tener valor

        const artist = "Artista desconocido"; // IMPORTANTE: siempre tener valor

        // --- Extracción de estado ---
        let statusText = initialDoc.selectFirst("div.elementor-element:has(h2:contains(Estado)) + div p")?.text.trim() ||
            initialDoc.selectFirst("p:contains(Estado)")?.text.trim() ||
            initialDoc.selectFirst(".status")?.text.trim();

        if (statusText && statusText.includes(":")) {
            statusText = statusText.split(":")[1]?.trim();
        }
        const status = statusText ? this.toStatus(statusText) : 0; // IMPORTANTE: siempre número válido

        let validWidgetFound = false;

        for (let attempt = 0; attempt < 2 && !validWidgetFound; attempt++) {
            if (attempt === 1) {
                const match = initialRes.body.match(/<div[^>]+class="[^"]*elementor-widget-posts[^"]*"[^>]+data-id="([a-z0-9]+)"/);
                widgetId = match ? match[1] : null;

                if (!widgetId) {
                    console.warn("❌ No se pudo obtener widgetId dinámicamente. Cancelando.");
                    break;
                }

                console.log(`🔁 Usando widgetId dinámico: ${widgetId}`);
            }

            for (let page = 1; page <= MAX_PAGES; page++) {
                const pageUrl = page === 1
                    ? url.replace(/\/$/, '')
                    : `${url.replace(/\/$/, '')}/?e-page=${widgetId}&page=${page}`;

                console.log(`🌐 Solicitando página de capítulos ${page}: ${pageUrl}`);

                try {
                    const res = await client.get(pageUrl, this.headers);
                    const doc = new Document(res.body);

                    const chaptersOnPage = this._parseChaptersFromPage(doc);
                    if (chaptersOnPage.length === 0) {
                        console.warn(`⚠️ Página ${page} vacía. Intento: ${attempt}`);
                        if (page === 1 && attempt === 0) {
                            break;
                        } else {
                            return {
                                imageUrl,
                                description,
                                genre,
                                author,
                                artist,
                                status,
                                chapters: allChapters
                            };
                        }
                    }

                    validWidgetFound = true;

                    let added = 0;
                    for (const ch of chaptersOnPage) {
                        if (seenUrls.has(ch.url)) {
                            repeatCount++;
                            if (repeatCount >= REPEAT_LIMIT) {
                                console.warn("🛑 Demasiados capítulos repetidos. Terminando...");
                                break;
                            }
                        } else {
                            repeatCount = 0;
                            seenUrls.add(ch.url);
                            allChapters.push(ch);
                            added++;
                        }
                    }

                    if (repeatCount >= REPEAT_LIMIT || added === 0) break;
                    await new Promise(resolve => setTimeout(resolve, 300));

                } catch (err) {
                    console.error(`❌ Error cargando página ${page}:`, err);
                    break;
                }
            }
        }

        allChapters.sort((a, b) => {
            const numA = parseFloat(a.name.match(/(\d+(\.\d+)?)/)?.[1] || 0);
            const numB = parseFloat(b.name.match(/(\d+(\.\d+)?)/)?.[1] || 0);
            return numA !== numB ? numA - numB : a.name.localeCompare(b.name);
        });

        console.log(`✅ Total capítulos: ${allChapters.length}`);
        console.log(`🖼️ Imagen URL: ${imageUrl}`);
        console.log(`📝 Descripción: ${description.substring(0, 100)}...`);

        return {
            imageUrl,
            description,
            genre,
            author,
            artist,
            status,
            chapters: allChapters
        };
    }


    async getHtmlContent(name, url) {
        const client = new Client();
        const res = await client.get(url, this.headers);
        return await this.cleanHtmlContent(res.body);
    }

    async cleanHtmlContent(html) {
        const doc = new Document(html);

        const title = doc.selectFirst("meta[property='og:title']")?.attr("content") ||
            doc.selectFirst("h1.entry-title")?.text.trim() ||
            doc.selectFirst("title")?.text.trim() || "";

        const cleanTitle = title.replace(/ - Devilnovels$/i, "").trim();

        let content = doc.selectFirst("div.elementor-widget-theme-post-content.elementor-widget")?.innerHtml ||
            doc.selectFirst("div.entry-content")?.innerHtml ||
            doc.selectFirst("div.post-content")?.innerHtml ||
            doc.selectFirst("div.chapter-content")?.innerHtml ||
            doc.selectFirst("article .content")?.innerHtml ||
            doc.selectFirst("main .content")?.innerHtml ||
            doc.selectFirst("div.content")?.innerHtml || "";

        if (!content || content.length < 50) {
            content = doc.selectFirst("meta[name='description']")?.attr("content") || "";
        }

        const cleanContent = content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<div class="adsbygoogle"[^>]*>[\s\S]*?<\/div>/gi, "")
            .replace(/<ins[^>]*>[\s\S]*?<\/ins>/gi, "")
            .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
            .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
            .replace(/&nbsp;/g, " ")
            .replace(/\n\s*\n/g, "\n")
            .trim();

        if (!cleanContent || cleanContent.length < 100) {
            const paragraphs = doc.select("p");
            let extractedContent = "";

            for (const p of paragraphs) {
                const text = p.text.trim();
                if (text.length > 50 && !text.toLowerCase().includes("devilnovels.com") &&
                    !text.toLowerCase().includes("copyright") &&
                    !text.toLowerCase().includes("este capítulo ha sido traducido por") &&
                    !text.toLowerCase().includes("no se permite la reproducción total") &&
                    !text.toLowerCase().includes("puedes leer más capítulos") &&
                    !p.outerHtml.includes('elementor')) {
                    extractedContent += `<p>${text}</p>\n`;
                }
            }
            return `<h2>${cleanTitle}</h2><hr><br>${extractedContent || "<p>No se pudo extraer el contenido del capítulo. Intenta usar un visor web si el problema persiste.</p>"}`;
        }

        return `<h2>${cleanTitle}</h2><hr><br>${cleanContent}`;
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
                        name: "Más recientes",
                        value: "date",
                    },
                    {
                        type_name: "SelectOption",
                        name: "Título",
                        value: "title",
                    },
                    {
                        type_name: "SelectOption",
                        name: "Popularidad",
                        value: "popularity",
                    },
                ],
            },
            {
                type_name: "SelectFilter",
                name: "Orden",
                state: 0,
                values: [
                    {
                        type_name: "SelectOption",
                        name: "Descendente",
                        value: "desc",
                    },
                    {
                        type_name: "SelectOption",
                        name: "Ascendente",
                        value: "asc",
                    },
                ],
            }
        ];
    }

    getSourcePreferences() {
        return [];
    }
}