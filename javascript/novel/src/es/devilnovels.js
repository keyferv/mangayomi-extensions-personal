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
        const entryElements = doc.select("article.post, div.post-item, div.novel-item, div.elementor-post");

        for (const element of entryElements) {
            let link = element.selectFirst("a[data-wpel-link='internal']")?.getHref;
            if (!link) {
                link = element.selectFirst("a[href*='devilnovels.com/']")?.getHref;
            }

            let imageUrl = element.selectFirst("img")?.getSrc;
            let name = element.selectFirst("h2.entry-title a, h3.entry-title a, .novel-title a, .elementor-post__title a")?.text.trim();

            if (!name) {
                name = element.selectFirst("a")?.text.trim();
            }

            // NUEVO: Detectar si es un capítulo y convertirlo a novela
            const isChapter = name && (name.toLowerCase().includes('capítulo') || name.toLowerCase().includes('chapter'));

            if (isChapter) {
                // Extraer el nombre de la novela del título del capítulo
                const novelName = this._extractNovelNameFromChapter(name);
                const novelLink = this._buildNovelLinkFromChapter(link);

                if (novelName && novelLink && !processedLinks.has(novelLink)) {
                    list.push({
                        name: novelName,
                        imageUrl: imageUrl || this.source.iconUrl,
                        link: novelLink
                    });
                    processedLinks.add(novelLink);
                }
            } else {
                // Es una entrada de novela normal
                if (link && name && !processedLinks.has(link) &&
                    !link.includes('/page/') && !link.includes('/category/') &&
                    !link.includes('/tag/') && !link.includes('/author/') &&
                    !link.includes('/comments')) {

                    if (!imageUrl || imageUrl.startsWith("data:")) {
                        imageUrl = this.source.iconUrl;
                    }

                    list.push({ name, imageUrl, link });
                    processedLinks.add(link);
                }
            }
        }

        const hasNextPage = doc.selectFirst("a.nextpostslink, a.next, .nav-links .next, .elementor-pagination .elementor-pagination__next") !== null;
        return { list, hasNextPage };
    }

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

    async search(query, page, filters) {
        const url = `${this.source.baseUrl}/?s=${encodeURIComponent(query)}&paged=${page}`;
        const res = await new Client().get(url, this.headers);
        const doc = new Document(res.body);

        // Usar el mismo parser que funciona en mangaListFromPage
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
                // ← CAPÍTULO, construir URL de novela
                novelName = categoryLinkElement.text.trim();
                const slug = this.slugify(novelName);
                novelLink = `${this.source.baseUrl}/${slug}/`;

                // Obtener portada desde la página principal de la novela
                // ↓ Alternativamente, solo usar ícono por defecto para evitar más llamadas
                imageUrl = this.source.iconUrl;
            } else {
                // ← ENTRADA DE NOVELA
                const titleElement = element.selectFirst("h2.entry-title a");
                const imgElement = element.selectFirst("img");
                novelName = titleElement?.text.trim() || "";
                novelLink = titleElement?.getHref;
                imageUrl = imgElement?.getSrc || this.source.iconUrl;
            }

            if (novelLink && novelName && !processedLinks.has(novelLink) &&
                !novelName.toLowerCase().includes("capítulo") && !novelName.toLowerCase().includes("chapter")) {
                list.push({ name: novelName, imageUrl, link: novelLink });
                processedLinks.add(novelLink);
            }
        }

        const nextPageElement = doc.selectFirst("a.nextpostslink, .nav-links .next, .page-numbers .next");
        const hasNextPage = nextPageElement !== null;

        return { list, hasNextPage };
    }

    async getDetail(url) {
        const client = new Client();
        const MAX_PAGES = 35;
        const REPEAT_LIMIT = 5;
        const allChapters = [];
        const seenUrls = new Set();
        let repeatCount = 0;

        const fallbackWidgetId = "bc939d8"; // ← WidgetId fijo usado primero
        let widgetId = fallbackWidgetId;

        console.log(`✨ Iniciando getDetail para URL: ${url}`);

        // 1. Obtener la primera página
        const initialRes = await client.get(url, this.headers);
        const initialDoc = new Document(initialRes.body);

        // Extraer detalles de novela si quieres (de momento los dejamos vacíos)
        const genre = [];
        const author = "";
        const artist = "";
        const status = 5;
        const description = "";
        const imageUrl = "";

        let validWidgetFound = false;

        for (let attempt = 0; attempt < 2 && !validWidgetFound; attempt++) {
            // Si el intento anterior falló, recuperar dinámicamente el widgetId
            if (attempt === 1) {
                const match = initialRes.body.match(/<div[^>]+class="[^"]*elementor-widget-posts[^"]*"[^>]+data-id="([a-z0-9]+)"/);
                widgetId = match ? match[1] : null;

                if (!widgetId) {
                    console.warn("❌ No se pudo obtener widgetId dinámicamente. Cancelando.");
                    break;
                }

                console.log(`🔁 Usando widgetId dinámico: ${widgetId}`);
            }

            // Paginación
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
                            // ← Falló en el primer intento con widget fijo
                            break; // salta al segundo intento
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