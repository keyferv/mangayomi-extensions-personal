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
        const updatesSection = doc.selectFirst("div.elementor-element-bf49f11 table tbody");

        if (!updatesSection) {
            return { list: [], hasNextPage: false };
        }

        const novelRows = updatesSection.select("tr");
        for (const row of novelRows) {
            const novelInfoCell = row.selectFirst("td:first-child");
            const linkElement = novelInfoCell?.selectFirst("a[data-wpel-link='internal']");
            const link = linkElement?.getHref;
            const imageUrl = novelInfoCell?.selectFirst("div > img")?.getSrc;
            const name = linkElement?.text.trim();

            if (link && name && !processedLinks.has(link) && name.length > 2 &&
                !name.includes('Capítulo') && !name.includes('Chapter')) {
                list.push({ name, imageUrl, link });
                processedLinks.add(link);
            }
        }
        return { list: list, hasNextPage: false };
    }

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
            const imageUrl = element.selectFirst("img")?.getSrc;
            const name = element.selectFirst("p > a[data-wpel-link='internal']")?.text.trim();

            if (link && name && !processedLinks.has(link) && name.length > 2 &&
                !name.includes('Capítulo') && !name.includes('Chapter') &&
                !link.includes('page/') && !link.includes('category/')) {
                list.push({ name, imageUrl, link });
                processedLinks.add(link);
            }
        }
        return { list: list, hasNextPage: false };
    }

    _parseSearchResults(doc) {
        const list = [];
        const processedLinks = new Set();
        const entryElements = doc.select("article.post");

        for (const element of entryElements) {
            const categoryLinkElement = element.selectFirst("span.ast-taxonomy-container.cat-links a[data-wpel-link='internal']");
            const novelLink = categoryLinkElement?.getHref;
            const novelName = categoryLinkElement?.text.trim();
            const imageUrl = "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.devilnovels.png";

            if (novelLink && novelName && !processedLinks.has(novelLink) &&
                !novelName.includes('Capítulo') && !novelName.includes('Chapter')) {
                list.push({ name: novelName, imageUrl: imageUrl, link: novelLink });
                processedLinks.add(novelLink);
            }
        }

        const nextPageElement = doc.selectFirst("a.nextpostslink, .nav-links .next, .page-numbers .next");
        const hasNextPage = nextPageElement !== null;
        return { list: list, hasNextPage: hasNextPage };
    }

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

    getHeaders(url) {
        return this.headers;
    }

    mangaListFromPage(res) {
        const doc = new Document(res.body);
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

            if (link && name && !processedLinks.has(link) &&
                !link.includes('/page/') && !link.includes('/category/') &&
                !link.includes('/tag/') && !link.includes('/author/') &&
                !link.includes('/comments') && !name.includes('Capítulo') && !name.includes('Chapter')) {
                if (!imageUrl) {
                    imageUrl = "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.devilnovels.png";
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
        return this._parseSearchResults(doc);
    }

    async getDetail(url) {
        const client = new Client();
        const MAX_PAGES = 35;
        const REPEAT_LIMIT = 5;
        const allChapters = [];
        const seenUrls = new Set();
        let repeatCount = 0;

        const widgetId = 'bc939d8';

        console.log(`✨ Iniciando getDetail para URL: ${url}`);

        // --- Extracción de detalles de la NOVELA (imagen y descripción) ---
        const initialRes = await client.get(url, this.headers);
        const initialDoc = new Document(initialRes.body);

        const description = initialDoc.selectFirst("div.elementor-widget-theme-post-content.elementor-widget p")?.text.trim() ||
                            initialDoc.selectFirst("div.entry-content p")?.text.trim() ||
                            initialDoc.selectFirst("meta[name='description']")?.attr("content") ||
                            "";

        const imageUrl = initialDoc.selectFirst("div.elementor-element-26a9788 img")?.getSrc ||
                         initialDoc.selectFirst("meta[property='og:image']")?.attr("content") ||
                         "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.devilnovels.png";

        // Dejar estos campos explícitamente vacíos para evitar problemas
        const genre = [];
        const author = "";
        const artist = "";
        const status = 5; // Estado "Desconocido" por defecto

        // --- Bucle para recopilar capítulos ---
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
                    console.warn(`⚠️ Página ${page} vacía o no se encontraron capítulos válidos. Terminando...`);
                    break;
                }

                let addedToCurrentBatch = 0;
                for (const ch of chaptersOnPage) {
                    if (seenUrls.has(ch.url)) {
                        repeatCount++;
                        if (repeatCount >= REPEAT_LIMIT) {
                            console.warn(`🛑 Demasiados capítulos repetidos. Terminando la paginación.`);
                            break;
                        }
                    } else {
                        repeatCount = 0;
                        seenUrls.add(ch.url);
                        allChapters.push(ch);
                        addedToCurrentBatch++;
                    }
                }

                if (repeatCount >= REPEAT_LIMIT || addedToCurrentBatch === 0) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 300));

            } catch (error) {
                console.error(`❌ Error al obtener capítulos de la página ${page}:`, error);
                break;
            }
        }

        allChapters.sort((a, b) => {
            const numA = parseFloat(a.name.match(/(\d+(\.\d+)?)/)?.[1] || 0);
            const numB = parseFloat(b.name.match(/(\d+(\.\d+)?)/)?.[1] || 0);
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name);
        });

        console.log(`✅ Total de capítulos recopilados para la novela: ${allChapters.length}`);

        return {
            imageUrl: imageUrl,
            description: description,
            genre: genre,
            author: author,
            artist: artist,
            status: status,
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
                    !p.outerHtml.includes('elementor'))
                {
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