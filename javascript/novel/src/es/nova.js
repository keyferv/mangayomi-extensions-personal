const mangayomiSources = [{
    "name": "Novelas Ligeras",
    "lang": "es",
    "baseUrl": "https://novelasligeras.net",
    "apiUrl": "",
    "iconUrl": "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.nova.png",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.0.6",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "novel/src/es/nova.js",
    "isNsfw": false,
    "hasCloudflare": true,
    "notes": "Extensión para NovelasLigeras.net con sistema anti-Cloudflare ultra-avanzado, detección inteligente y estrategias múltiples de bypass"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cloudflareRetryCount = 0;
        this.lastRequestTime = 0;
        this.sessionCookies = new Map();
        this.userAgentRotation = 0;
        this.preferMobile = true; // NUEVO: Preferir móviles
        this.fingerprint = this._generateFingerprint();
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "DNT": "1"
    };

    // ==================== FINGERPRINT Y USER-AGENTS MÓVILES ====================

    /**
     * Genera fingerprint de navegador consistente
     */
    _generateFingerprint() {
        return {
            screen: { width: 360, height: 780, colorDepth: 24 }, // Móvil típico
            timezone: "Europe/Madrid",
            language: "es-ES",
            platform: "Linux armv8l", // Android típico
            cookieEnabled: true,
            doNotTrack: "1",
            hardwareConcurrency: 8,
            deviceMemory: 4,
            maxTouchPoints: 5 // Móvil
        };
    }

    /**
     * Pool de User-Agents móviles realistas y actualizados
     */
    _getMobileUserAgents() {
        return [
            // Android Chrome (más común y confiable)
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36",
            
            // iPhone Safari (también muy común)
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
            
            // Firefox móvil (menos común pero válido)
            "Mozilla/5.0 (Mobile; rv:121.0) Gecko/121.0 Firefox/121.0",
            "Mozilla/5.0 (Android 12; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0"
        ];
    }

    /**
     * Pool de User-Agents de escritorio (fallback)
     */
    _getDesktopUserAgents() {
        return [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        ];
    }

    /**
     * Obtiene User-Agent rotado con preferencia móvil
     */
    _getRotatedUserAgent(forceMobile = null) {
        const useMobile = forceMobile !== null ? forceMobile : 
                         (this.preferMobile && this.userAgentRotation < 6); // Primeros 6 intentos móvil
        
        const userAgents = useMobile ? this._getMobileUserAgents() : this._getDesktopUserAgents();
        
        this.userAgentRotation = (this.userAgentRotation + 1) % userAgents.length;
        return userAgents[this.userAgentRotation];
    }

    /**
     * Detecta si un User-Agent es móvil
     */
    _isMobileUserAgent(userAgent) {
        return userAgent.includes('Mobile') || 
               userAgent.includes('Android') || 
               userAgent.includes('iPhone') ||
               userAgent.includes('iPad');
    }

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

    // ==================== FUNCIONES AUXILIARES ANTI-CLOUDFLARE TURNSTILE ====================
    
    /**
     * Headers optimizados para móviles vs escritorio con detección Turnstile
     */
    _generateTurnstileHeaders(attempt = 0, isFirstVisit = true, forceMobile = null) {
        const userAgent = this._getRotatedUserAgent(forceMobile);
        const isMobile = this._isMobileUserAgent(userAgent);
        const isFirefox = userAgent.includes('Firefox');
        const isIPhone = userAgent.includes('iPhone');
        
        console.log(`📱 Usando ${isMobile ? 'MÓVIL' : 'ESCRITORIO'}: ${userAgent.substring(0, 50)}...`);

        const headers = {
            "User-Agent": userAgent,
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "DNT": "1"
        };

        // Accept específico por dispositivo
        if (isIPhone) {
            headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
            headers["Accept-Language"] = "es-ES,es;q=0.9";
            headers["Accept-Encoding"] = "gzip, deflate, br";
        } else if (isMobile) {
            headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
            headers["Accept-Language"] = "es-ES,es;q=0.9,en;q=0.8";
            headers["Accept-Encoding"] = "gzip, deflate, br, zstd";
        } else {
            headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
            headers["Accept-Language"] = "es-ES,es;q=0.9,en;q=0.8,en-US;q=0.7";
            headers["Accept-Encoding"] = "gzip, deflate, br, zstd";
        }

        // Headers Sec-Fetch (solo para Chrome no-móvil y algunos móviles)
        if (!isFirefox && !isIPhone) {
            headers["Sec-Fetch-Dest"] = "document";
            headers["Sec-Fetch-Mode"] = isFirstVisit ? "navigate" : "same-origin";
            headers["Sec-Fetch-Site"] = isFirstVisit ? "none" : "same-origin";
            headers["Sec-Fetch-User"] = "?1";
        }

        // Headers Sec-Ch-Ua (SOLO para Chrome de escritorio)
        if (!isMobile && !isFirefox && userAgent.includes('Chrome')) {
            if (userAgent.includes('Chrome/121')) {
                headers["Sec-Ch-Ua"] = '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"';
                headers["Sec-Ch-Ua-Mobile"] = "?0";
                headers["Sec-Ch-Ua-Platform"] = '"Windows"';
            } else if (userAgent.includes('Chrome/120')) {
                headers["Sec-Ch-Ua"] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
                headers["Sec-Ch-Ua-Mobile"] = "?0";
                headers["Sec-Ch-Ua-Platform"] = userAgent.includes('Mac') ? '"macOS"' : '"Windows"';
            }
        }
        
        // Headers Sec-Ch-Ua para móviles (MUY IMPORTANTE: Mobile = ?1)
        if (isMobile && !isFirefox && !isIPhone && userAgent.includes('Chrome')) {
            headers["Sec-Ch-Ua-Mobile"] = "?1"; // CLAVE para móviles
            if (userAgent.includes('Chrome/138')) {
                headers["Sec-Ch-Ua"] = '"Chromium";v="138", "Not=A?Brand";v="99", "Google Chrome";v="138"';
                headers["Sec-Ch-Ua-Platform"] = '"Android"';
            } else if (userAgent.includes('Chrome/137')) {
                headers["Sec-Ch-Ua"] = '"Chromium";v="137", "Not=A?Brand";v="99", "Google Chrome";v="137"';
                headers["Sec-Ch-Ua-Platform"] = '"Android"';
            }
        }

        // Estrategias por intento
        if (attempt === 0) {
            headers["Cache-Control"] = "no-cache";
            headers["Pragma"] = "no-cache";
        } else if (attempt === 1) {
            headers["Cache-Control"] = "max-age=0";
        } else if (attempt >= 3) {
            // Headers ultra-mínimos para intentos tardíos
            delete headers["Cache-Control"];
            delete headers["Pragma"];
            delete headers["DNT"];
            if (headers["Sec-Ch-Ua"]) delete headers["Sec-Ch-Ua"];
            if (headers["Sec-Ch-Ua-Platform"]) delete headers["Sec-Ch-Ua-Platform"];
        }

        // Referer solo después del primer intento
        if (!isFirstVisit && attempt > 0) {
            headers["Referer"] = this.source.baseUrl + "/";
        }

        return headers;
    }

    /**
     * Detecta Cloudflare Turnstile y otros sistemas modernos
     */
    _detectModernCloudflare(response) {
        const body = response.body.toLowerCase();
        const status = response.status;
        
        // Indicadores específicos de Turnstile
        const turnstileIndicators = [
            'turnstile',
            'cf-turnstile', 
            'challenges.cloudflare.com',
            'cf-challenge',
            'cf-chl-bypass',
            'attention required',
            'checking your browser',
            'please enable javascript',
            'javascript and cookies',
            'browser integrity check',
            'ddos protection'
        ];
        
        // Headers Cloudflare
        const cfHeaders = response.headers || {};
        const hasCfHeaders = !!(
            cfHeaders['cf-ray'] ||
            cfHeaders['cf-cache-status'] ||
            cfHeaders['cf-request-id'] ||
            cfHeaders['server']?.toLowerCase().includes('cloudflare')
        );
        
        // Estados críticos 
        const criticalStatuses = [403, 429, 503, 520, 521, 522, 523, 524, 525, 526, 527, 530];
        
        const hasTurnstile = turnstileIndicators.some(indicator => body.includes(indicator));
        const hasCriticalStatus = criticalStatuses.includes(status);
        
        // Detectar tipo específico
        let type = 'unknown';
        let severity = 'medium';
        
        if (body.includes('turnstile') || body.includes('cf-turnstile')) {
            type = 'turnstile';
            severity = 'high';
        } else if (body.includes('checking your browser')) {
            type = 'browser_check';
            severity = 'medium';
        } else if (body.includes('javascript and cookies')) {
            type = 'js_challenge'; 
            severity = 'medium';
        } else if (status === 403) {
            type = 'forbidden';
            severity = 'high';
        } else if (status === 429) {
            type = 'rate_limit';
            severity = 'medium';
        } else if (hasCriticalStatus) {
            type = 'server_error';
            severity = 'critical';
        }

        return {
            isBlocked: hasTurnstile || hasCriticalStatus || hasCfHeaders,
            type: type,
            status: status,
            hasHeaders: hasCfHeaders,
            severity: severity
        };
    }

    /**
     * Delays inteligentes según tipo y dispositivo
     */
    async _smartDelay(attempt, blockType = 'unknown', isMobile = true) {
        // Móviles pueden ser más agresivos, escritorio más conservador
        const mobileDelays = {
            'turnstile': [1500, 3000, 5000, 8000, 12000, 18000],
            'rate_limit': [2000, 4000, 8000, 15000, 25000, 40000],
            'forbidden': [3000, 6000, 12000, 20000, 35000, 50000],
            'js_challenge': [1000, 2000, 4000, 7000, 11000, 16000],
            'unknown': [1500, 3000, 5500, 9000, 14000, 20000]
        };
        
        const desktopDelays = {
            'turnstile': [2000, 5000, 8000, 12000, 18000, 25000],
            'rate_limit': [3000, 6000, 12000, 20000, 30000, 45000],
            'forbidden': [4000, 8000, 15000, 25000, 40000, 60000],
            'js_challenge': [1500, 3000, 5000, 8000, 12000, 18000],
            'unknown': [2000, 4000, 7000, 11000, 16000, 22000]
        };
        
        const delays = isMobile ? mobileDelays : desktopDelays;
        const delayArray = delays[blockType] || delays['unknown'];
        const baseDelay = delayArray[Math.min(attempt, delayArray.length - 1)];
        
        // Variación aleatoria
        const variation = (Math.random() - 0.5) * 0.3 * baseDelay;
        const finalDelay = Math.max(500, baseDelay + variation);
        
        console.log(`⏳ Espera ${isMobile ? '📱 móvil' : '💻 escritorio'} (${blockType}): ${Math.round(finalDelay)}ms`);
        await this._delay(finalDelay);
        
        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minInterval = isMobile ? (attempt > 2 ? 2000 : 1500) : (attempt > 2 ? 3000 : 2000);
        
        if (timeSinceLastRequest < minInterval) {
            const additionalWait = minInterval - timeSinceLastRequest;
            console.log(`⏳ Rate limiting: ${additionalWait}ms`);
            await this._delay(additionalWait);
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Bypass principal con estrategia móvil-primero mejorada
     */
    async _fetchWithAdvancedBypass(url, options = {}) {
        const maxRetries = 10; // Aumentado para incluir más estrategias móviles
        let lastError = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`🔄 Bypass Móvil-Primero - Intento ${attempt + 1}/${maxRetries} para: ${url}`);
                
                // Determinar estrategia por intento
                let forceMobile = null;
                if (attempt < 6) {
                    forceMobile = true;  // Primeros 6 intentos: SOLO móvil
                } else if (attempt < 8) {
                    forceMobile = false; // Intentos 7-8: SOLO escritorio  
                } else {
                    forceMobile = attempt % 2 === 0; // Intentos 9-10: alternar
                }
                
                const headers = this._generateTurnstileHeaders(attempt, attempt === 0, forceMobile);
                const isMobile = this._isMobileUserAgent(headers["User-Agent"]);
                
                if (attempt > 0) {
                    await this._smartDelay(attempt, 'unknown', isMobile);
                }
                
                const client = new Client({
                    timeout: isMobile ? 25000 : 30000, // Móvil más rápido
                    followRedirects: true,
                    maxRedirects: 5
                });
                
                const response = await client.get(url, headers);
                const check = this._detectModernCloudflare(response);
                
                if (!check.isBlocked) {
                    console.log(`✅ Bypass exitoso - Intento ${attempt + 1} (${isMobile ? '📱 móvil' : '💻 escritorio'})`);
                    this.cloudflareRetryCount = 0;
                    return response;
                }
                
                console.warn(`🛡️ Bloqueado: ${check.type} (${check.status}) - Intento ${attempt + 1} ${isMobile ? '📱' : '💻'}`);
                await this._smartDelay(attempt, check.type, isMobile);
                lastError = new Error(`${check.type} ${check.status} (${isMobile ? 'móvil' : 'escritorio'})`);
                
            } catch (error) {
                console.error(`❌ Error intento ${attempt + 1}:`, error.message);
                lastError = error;
                
                if (error.message.includes('timeout')) {
                    await this._delay(3000);
                }
            }
        }
        
        this.cloudflareRetryCount++;
        
        const errorMessage = `🚫 Bypass móvil-primero fallido después de ${maxRetries} intentos. ` +
                           `Error: ${lastError?.message || 'Desconocido'}. ` +
                           `Fallos consecutivos: ${this.cloudflareRetryCount}`;
        
        console.error(errorMessage);
        
        if (this.cloudflareRetryCount > 5) {
            throw new Error(`${errorMessage}. CRÍTICO: Considera usar VPN o esperar 30+ minutos.`);
        }
        
        throw new Error(errorMessage);
    }
    
    /**
     * Función principal para bypass de Cloudflare con estrategias múltiples móvil-primero
     */
    async _fetchWithCloudflareHandling(url, options = {}) {
        return await this._fetchWithAdvancedBypass(url, options);
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