const mangayomiSources = [{
  "name": "Devil Novels (Test)",
  "lang": "es",
  "baseUrl": "https://devilnovels.com",
  "apiUrl": "",
  "iconUrl": "https://github.com/kodjodevf/mangayomi-extensions/blob/main/javascript/icon/es.devilnovels.png",
  "typeSource": "single",
  "itemType": 2,
  "version": "0.0.2-test",
  "dateFormat": "",
  "dateFormatLocale": "",
  "pkgPath": "novel/src/es/test_devilnovels.js",
  "isNsfw": false,
  "hasCloudflare": true,
  "notes": "Versión de prueba - Y esperemos q no falle"
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

  getHeaders(url) {
    throw new Error("getHeaders not implemented");
  }

  mangaListFromPage(res) {
    const doc = new Document(res.body);
    
    // Buscar elementos de novelas en diferentes secciones
    const mangaElements = doc.select("a[href*='devilnovels.com/']").filter(el => {
      const href = el.getHref;
      return href && href.includes('devilnovels.com/') && 
             !href.includes('facebook') && !href.includes('twitter') && 
             !href.includes('instagram') && !href.includes('contacto') &&
             !href.includes('dmca') && !href.includes('politica') &&
             !href.includes('copyright') && !href.includes('feed') &&
             !href.includes('lista-de-novelas') && !href.includes('registro') &&
             !href.includes('iniciar-sesion') && !href.includes('perfil') &&
             !href.includes('marcadores') && !href.includes('page/') &&
             href !== 'https://devilnovels.com/' && href !== 'https://devilnovels.com';
    });
    
    const list = [];
    const processedUrls = new Set();
    
    for (const element of mangaElements) {
      const link = element.getHref;
      if (processedUrls.has(link)) continue;
      
      const name = element.text.trim();
      
      // Filtrar enlaces que no son novelas (muy cortos, números, etc.)
      if (!name || name.length < 3 || /^\d+$/.test(name) || 
          name.includes('vistas') || name.includes('Capítulo') || 
          name.includes('Chapter') || name.includes('página') ||
          name.includes('Página') || name.includes('→') ||
          name.includes('Copyright') || name.includes('Politicas')) {
        continue;
      }
      
      processedUrls.add(link);
      
      // Buscar imagen asociada
      let imageUrl = "";
      const parentElement = element.parent();
      if (parentElement) {
        const imageElement = parentElement.selectFirst("img");
        if (imageElement) {
          imageUrl = imageElement.getSrc;
        }
      }
      
      list.push({ name, imageUrl, link });
    }
    
    // Remover duplicados por nombre
    const uniqueList = [];
    const seenNames = new Set();
    
    for (const item of list) {
      if (!seenNames.has(item.name)) {
        seenNames.add(item.name);
        uniqueList.push(item);
      }
    }
    
    // Buscar paginación
    const hasNextPage = doc.selectFirst("a.next") !== null || 
                       doc.selectFirst("a[href*='page/']") !== null ||
                       doc.selectFirst("a[href*='e-page']") !== null;
    
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
    const res = await new Client().get(
      `${this.source.baseUrl}/`,
      this.headers
    );
    return this.mangaListFromPage(res);
  }

  async getLatestUpdates(page) {
    const res = await new Client().get(
      `${this.source.baseUrl}/`,
      this.headers
    );
    return this.mangaListFromPage(res);
  }

  async search(query, page, filters) {
    const url = `${this.source.baseUrl}/?s=${encodeURIComponent(query)}`;
    const res = await new Client().get(url, this.headers);
    return this.mangaListFromPage(res);
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(url, this.headers);
    const doc = new Document(res.body);
    
    // Buscar imagen de la novela
    const imageUrl = doc.selectFirst("meta[property='og:image']")?.attr("content") || "";
    
    // Buscar descripción
    const description = doc.selectFirst("meta[property='og:description']")?.attr("content") || "";
    
    // Información básica
    const author = "Desconocido";
    const artist = "";
    const status = 0; // En curso por defecto
    const genre = [];

    // Buscar capítulos
    const chapters = [];
    
    // Buscar por selectores específicos de Devil Novels
    let chapterElements = doc.select("h3 > a[href*='devilnovels.com/']");
    
    // Si no encontramos capítulos, buscar de forma más general
    if (chapterElements.length === 0) {
      chapterElements = doc.select("a[href*='devilnovels.com/'][href*='capitulo'], a[href*='devilnovels.com/'][href*='chapter']");
    }
    
    // Si aún no encontramos capítulos, buscar todos los enlaces que parezcan capítulos
    if (chapterElements.length === 0) {
      chapterElements = doc.select("a[href*='devilnovels.com/']").filter(el => {
        const text = el.text.trim().toLowerCase();
        const href = el.getHref;
        return (text.includes('capítulo') || text.includes('capitulo') || text.includes('chapter')) &&
               !href.includes('page/') && !href.includes('e-page');
      });
    }
    
    for (const el of chapterElements) {
      const chapterName = el.text.trim();
      const chapterUrl = el.getHref;
      const dateUpload = String(Date.now());
      
      if (chapterName && chapterUrl && chapterName.length > 3) {
        chapters.push({
          name: chapterName,
          url: chapterUrl,
          dateUpload: dateUpload,
          scanlator: null,
        });
      }
    }

    chapters.reverse();

    return {
      imageUrl,
      description,
      genre,
      author,
      artist,
      status,
      chapters,
    };
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
