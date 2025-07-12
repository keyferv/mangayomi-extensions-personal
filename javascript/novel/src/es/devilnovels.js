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

    // --- Función auxiliar para parsear la lista de Actualizaciones (Recientes) ---
    _parseLatestUpdatesList(doc) {
        const list = [];
        const processedLinks = new Set();

        // Selector del tbody de la tabla de actualizaciones
        const updatesSection = doc.selectFirst("div.elementor-element-bf49f11 table tbody");

        if (!updatesSection) {
            // Si no se encuentra la sección de actualizaciones, devuelve una lista vacía
            return { list: [], hasNextPage: false };
        }

        // Selector de cada fila (tr) de la tabla, que representa una novela
        const novelRows = updatesSection.select("tr");

        for (const row of novelRows) {
            // La información de la novela está en la primera celda (td) de cada fila
            const novelInfoCell = row.selectFirst("td:first-child");

            const linkElement = novelInfoCell?.selectFirst("a[data-wpel-link='internal']");
            const link = linkElement?.getHref;

            // La imagen está dentro de un div dentro de la celda de información
            const imageUrl = novelInfoCell?.selectFirst("div > img")?.getSrc;

            // El nombre de la novela es el texto del enlace
            const name = linkElement?.text.trim();

            // Filtros para asegurar que el enlace y el nombre son válidos
            if (link && name && !processedLinks.has(link) && name.length > 2 &&
                !name.includes('Capítulo') && !name.includes('Chapter')) {

                list.push({ name, imageUrl, link });
                processedLinks.add(link); // Añade el enlace para evitar duplicados
            }
        }
        // La sección de actualizaciones en la página principal no tiene paginación.
        return { list: list, hasNextPage: false };
    }

    // --- Función auxiliar para parsear la lista de Ranking (Populares) ---
    _parseRankingList(doc) {
        const list = [];
        const processedLinks = new Set();

        // Selector principal que contiene todos los elementos del ranking
        const rankingSection = doc.selectFirst("div.elementor-element-fc0fa0f div.pvc-top-pages");

        if (!rankingSection) {
            // Si no se encuentra la sección de ranking, devuelve una lista vacía
            return { list: [], hasNextPage: false };
        }

        // Selector de cada elemento individual de novela dentro de la sección de ranking
        // Usamos 'width: 150px;' que fue lo que funcionó en la consola
        const mangaElements = rankingSection.select("div[style*='width: 150px;']");

        for (const element of mangaElements) {
            const linkElement = element.selectFirst("a[data-wpel-link='internal']");
            const link = linkElement?.getHref;

            const imageUrl = element.selectFirst("img")?.getSrc;

            // El nombre está dentro de un párrafo y luego un enlace
            const name = element.selectFirst("p > a[data-wpel-link='internal']")?.text.trim();

            // Filtros para asegurar que el enlace y el nombre son válidos
            if (link && name && !processedLinks.has(link) && name.length > 2 &&
                !name.includes('Capítulo') && !name.includes('Chapter') &&
                !link.includes('page/') && !link.includes('category/')) {

                list.push({ name, imageUrl, link });
                processedLinks.add(link); // Añade el enlace para evitar duplicados
            }
        }
        // La sección de ranking en la página principal no tiene paginación.
        return { list: list, hasNextPage: false };
    }

    // --- Función auxiliar para parsear los resultados de búsqueda ---
    _parseSearchResults(doc) {
        const list = [];
        const processedLinks = new Set(); // Para evitar duplicados de novelas

        // Cada resultado individual (capítulo o novela) está en un <article>
        const entryElements = doc.select("article.post");

        for (const element of entryElements) {
            // Extraer el enlace de la categoría (que debería ser el enlace a la novela principal)
            const categoryLinkElement = element.selectFirst("span.ast-taxonomy-container.cat-links a[data-wpel-link='internal']");
            const novelLink = categoryLinkElement?.getHref;
            const novelName = categoryLinkElement?.text.trim(); // Este es el nombre de la NOVELA PRINCIPAL

            // El problema es que en la búsqueda, Devil Novels no muestra la imagen de la novela,
            // sino que la portada del capítulo es el mismo icono de Devil Novels o no hay.
            // Por lo tanto, usaremos una imagen por defecto para las búsquedas.
            const imageUrl = "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.devilnovels.png"; // Imagen por defecto

            // Asegurarse de que tenemos un nombre de novela principal y un enlace válido,
            // y que no lo hayamos añadido ya (para evitar duplicados si varios capítulos de la misma novela aparecen).
            if (novelLink && novelName && !processedLinks.has(novelLink) &&
                !novelName.includes('Capítulo') && !novelName.includes('Chapter')) { // Filtra si por alguna razón el nombre de la categoría es un capítulo

                list.push({ name: novelName, imageUrl: imageUrl, link: novelLink });
                processedLinks.add(novelLink);
            }
        }

        // --- Paginación para la búsqueda ---
        // Necesitamos encontrar los selectores para la paginación en los resultados de búsqueda.
        // Basado en sitios de WordPress, estos son algunos selectores comunes:
        const nextPageElement = doc.selectFirst("a.nextpostslink, .nav-links .next, .page-numbers .next");
        const hasNextPage = nextPageElement !== null;

        return { list: list, hasNextPage: hasNextPage };
    }

    _parseChaptersFromPage(doc) {

        const allChapters = [];

        const containers = doc.select('.elementor-posts-container');

        if (containers.length === 0) {
            // Si no encuentra el contenedor específico, busca directamente los artículos
            // por si el diseño ha cambiado o es otra sección.
            // Esto es un fallback, pero tu script ya da una buena pista.
            const articles = doc.select("article.elementor-post");
            articles.forEach(article => {
                const a = article.selectFirst("h3.elementor-post__title a, h4.elementor-post__title a");
                if (a) {
                    allChapters.push({
                        name: a.text.trim(),
                        url: a.getHref,
                        dateUpload: String(Date.now()), // No hay fecha explícita, usa la actual
                        scanlator: null
                    });
                }
            });
        } else {
            // Recorre los contenedores si los encuentra
            containers.forEach(container => {
                const articles = container.select("article.elementor-post");
                const chaptersInContainer = articles.map(article => {
                    const a = article.selectFirst("h3.elementor-post__title a, h4.elementor-post__title a");
                    if (!a) return null; // Si no hay enlace, no es un capítulo válido

                    return {
                        name: a.text.trim(),
                        url: a.getHref,
                        dateUpload: String(Date.now()),
                        scanlator: null
                    };
                }).filter(Boolean); // Elimina los `null`

                //Esto evita que "Último Capítulo" o similares se cuelen.
                if (chaptersInContainer.length > 1) {
                    allChapters.push(...chaptersInContainer);
                }
            });
        }

        console.log(`✅ Capítulos extraídos de la página (dentro de _parseChaptersFromPage): ${allChapters.length}`);
        return allChapters;
    }



    getHeaders(url) {
        throw new Error("getHeaders not implemented");
    }

    mangaListFromPage(res) {
        const doc = new Document(res.body);
        const list = [];
        const processedLinks = new Set();

        // Selector más específico para las entradas de novelas
        // Buscamos contenedores que suelen tener la imagen y el título
        const entryElements = doc.select("article.post, div.post-item, div.novel-item, div.entry"); // Ajusta estos selectores según la estructura HTML de Devil Novels

        for (const element of entryElements) {
            let link = element.selectFirst("a[href*='devilnovels.com/']").getHref;
            let imageUrl = element.selectFirst("img")?.getSrc;
            let name = element.selectFirst("h2.entry-title a, h3.entry-title a, .novel-title a")?.text.trim(); // Busca el título dentro del contenedor

            // Si no se encuentra el título con el selector anterior, intenta buscarlo de forma más genérica.
            if (!name) {
                name = element.selectFirst("a")?.text.trim();
            }

            // Asegúrate de que el enlace sea una URL de novela válida y no se haya procesado ya.
            if (link && name && !processedLinks.has(link) &&
                !link.includes('page/') && !link.includes('category/') &&
                !link.includes('tag/') && !link.includes('author/') &&
                !link.includes('comments') && !name.includes('Capítulo') && !name.includes('Chapter')) {

                // Intentar obtener una URL de imagen por defecto si no se encontró ninguna
                if (!imageUrl) {
                    imageUrl = "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.devilnovels.png"; // Una imagen por defecto o placeholder
                }

                list.push({ name, imageUrl, link });
                processedLinks.add(link);
            }
        }

        // Paginación: buscar enlaces a la siguiente página
        const hasNextPage = doc.selectFirst("a.nextpostslink, a.next, .nav-links .next") !== null; // Ajusta estos selectores según la paginación del sitio

        // Eliminar duplicados por nombre (ya lo haces, pero lo mantenemos si hay varios selectores)
        const uniqueList = [];
        const seenNames = new Set();
        for (const item of list) {
            if (!seenNames.has(item.name)) {
                seenNames.add(item.name);
                uniqueList.push(item);
            }
        }

        return { list: uniqueList, hasNextPage };
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
        return this._parseRankingList(doc); // Llama a la nueva función de parseo para el ranking
    }

    async getLatestUpdates(page) {
        const res = await new Client().get(`${this.source.baseUrl}/`, this.headers);
        const doc = new Document(res.body);
        return this._parseLatestUpdatesList(doc); // Llama a la nueva función de parseo para actualizaciones
    }

    async search(query, page, filters) {
        const url = `${this.source.baseUrl}/?s=${encodeURIComponent(query)}&paged=${page}`; // Añadimos paginación
        const res = await new Client().get(url, this.headers);
        const doc = new Document(res.body);
        return this._parseSearchResults(doc); // Llama a la nueva función auxiliar para la búsqueda
    }

    async getDetail(url) {
        const client = new Client();
        const MAX_PAGES = 35; // Límite de páginas a buscar, como en tu script
        const REPEAT_LIMIT = 5; // Límite de repeticiones para detener el bucle
        const allChapters = [];
        const seenUrls = new Set(); // Para evitar capítulos duplicados
        let repeatCount = 0; // Contador de repeticiones

        // Extraer widgetId del URL o buscarlo si es la primera página.
        // Asumiendo que bc939d8 es el widgetId que se ha determinado que funciona
        // para la paginación de capítulos en Devil Novels.
        let widgetId = 'bc939d8'; // Hardcodeado según tu script

        console.log(`✨ Iniciando getDetail para URL: ${url}`);

        // Primero, obtener la información de la novela desde la URL principal
        const initialRes = await client.get(url, this.headers);
        const initialDoc = new Document(initialRes.body);

        const description = initialDoc.selectFirst("div.elementor-widget-theme-post-content.elementor-widget p")?.text.trim() ||
            initialDoc.selectFirst("div.entry-content p")?.text.trim() || "";

        const imageUrl = initialDoc.selectFirst("div.elementor-element-26a9788 img")?.getSrc ||
            initialDoc.selectFirst("meta[property='og:image']")?.attr("content") ||
            "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.devilnovels.png";

        const genreElements = initialDoc.select("span.cat-links a, .elementor-widget-post-info__terms a");
        const genre = genreElements.map(el => el.text.trim()).filter(Boolean);

        const authorElement = initialDoc.selectFirst("div.elementor-element-1c9f049 span.elementor-icon-list-text");
        const author = authorElement ? authorElement.text.trim().replace('Autor:', '').trim() : "";

        const statusElement = initialDoc.selectFirst("div.elementor-element-6175e3a span.elementor-icon-list-text");
        const statusText = statusElement ? statusElement.text.trim() : "";
        const status = this.toStatus(statusText);


        // Iniciar la recopilación de capítulos
        for (let page = 1; page <= MAX_PAGES; page++) {
            const pageUrl = page === 1
                ? url.replace(/\/$/, '') // Asegura que la URL base no termine en '/' duplicado
                : `${url.replace(/\/$/, '')}/?e-page=${widgetId}&page=${page}`; // Usa el widgetId y el formato de tu script

            console.log(`🌐 Solicitando página de capítulos ${page}: ${pageUrl}`);

            try {
                const res = await client.get(pageUrl, this.headers);
                const doc = new Document(res.body);

                // Aquí es donde _parseChaptersFromPage entra en juego
                const chaptersOnPage = this._parseChaptersFromPage(doc);

                if (chaptersOnPage.length === 0) {
                    console.warn(`⚠️ Página ${page} vacía o no se encontraron capítulos válidos. Terminando...`);
                    break;
                }

                let addedToCurrentBatch = 0;
                for (const ch of chaptersOnPage) {
                    if (seenUrls.has(ch.url)) {
                        repeatCount++;
                        // console.log(`🔁 Capítulo repetido: ${ch.name} (${repeatCount}/${REPEAT_LIMIT})`);
                        if (repeatCount >= REPEAT_LIMIT) {
                            console.warn(`🛑 Demasiados capítulos repetidos. Terminando la paginación.`);
                            break; // Rompe el bucle interno de capítulos
                        }
                    } else {
                        repeatCount = 0; // Reinicia el contador si se encuentra un capítulo nuevo
                        seenUrls.add(ch.url);
                        allChapters.push(ch);
                        addedToCurrentBatch++;
                    }
                }

                if (repeatCount >= REPEAT_LIMIT || addedToCurrentBatch === 0) {
                    // Si se alcanzaron los límites de repetición o no se añadió nada nuevo en esta página, termina el bucle principal.
                    break;
                }

                // Pequeño retardo para evitar sobrecargar el servidor
                await new Promise(resolve => setTimeout(resolve, 300));

            } catch (error) {
                console.error(`❌ Error al obtener capítulos de la página ${page}:`, error);
                break; // Sale del bucle en caso de error
            }
        }

        // Tu script externo no ordena los capítulos. Mangayomi espera capítulos ascendentes.
        // Si los capítulos vienen en orden descendente (el más nuevo primero), los invertimos.
        // Si tu _parseChaptersFromPage los recoge desordenados, la ordenación numérica es buena.
        allChapters.sort((a, b) => {
            // Intenta extraer el número del capítulo para una mejor ordenación
            const numA = parseFloat(a.name.match(/(\d+(\.\d+)?)/)?.[1] || 0);
            const numB = parseFloat(b.name.match(/(\d+(\.\d+)?)/)?.[1] || 0);
            if (numA !== numB) return numA - numB;
            // Si los números son iguales, ordena alfabéticamente (fallback)
            return a.name.localeCompare(b.name);
        });
    }

    async getHtmlContent(name, url) {
        const client = new Client();
        const res = await client.get(url, this.headers);
        return await this.cleanHtmlContent(res.body);
    }

    async cleanHtmlContent(html) {
        const doc = new Document(html);

        // Buscar el título del capítulo desde el meta tag
        const title = doc.selectFirst("meta[property='og:title']")?.attr("content") ||
            doc.selectFirst("h1.entry-title")?.text.trim() ||
            doc.selectFirst("title")?.text.trim() || "";

        // Limpiar el título (remover "- Devilnovels" si existe)
        const cleanTitle = title.replace(/ - Devilnovels$/i, "").trim();

        // Buscar el contenido del capítulo
        // En Devil Novels, el contenido parece estar en el meta description o en elementos específicos
        let content = doc.selectFirst("meta[name='description']")?.attr("content") || "";

        // Si no hay contenido en meta description, buscar en elementos típicos de WordPress
        if (!content) {
            content = doc.selectFirst("div.entry-content")?.innerHtml ||
                doc.selectFirst("div.post-content")?.innerHtml ||
                doc.selectFirst("div.chapter-content")?.innerHtml ||
                doc.selectFirst("article .content")?.innerHtml ||
                doc.selectFirst("main .content")?.innerHtml ||
                doc.selectFirst("div.content")?.innerHtml || "";
        }

        // Limpiar contenido innecesario
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

        // Si aún no hay contenido, intentar extraer desde el HTML completo
        if (!cleanContent || cleanContent.length < 50) {
            // Buscar párrafos con contenido sustancial
            const paragraphs = doc.select("p");
            let extractedContent = "";

            for (const p of paragraphs) {
                const text = p.text.trim();
                if (text.length > 50 && !text.includes("devilnovels.com") && !text.includes("Copyright")) {
                    extractedContent += `<p>${text}</p>\n`;
                }
            }

            return `<h2>${cleanTitle}</h2><hr><br>${extractedContent || "<p>No se pudo extraer el contenido del capítulo.</p>"}`;
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
        throw new Error("getSourcePreferences not implemented");
    }
}


