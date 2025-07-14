const mangayomiSources = [{
    "name": "Novelas Ligeras",
    "lang": "es",
    "baseUrl": "https://novelasligeras.net",
    "apiUrl": "",
    "iconUrl": "https://keyferv.github.io/mangayomi-extensions-personal/javascript/icon/es.nova.png",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.0.7",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "novel/src/es/nova.js",
    "isNsfw": false,
    "hasCloudflare": true,
    "notes": "Extensión para NovelasLigeras.net con técnicas Patchright-inspired: anti-detección avanzada, fingerprinting realista, timing humano y estrategias progresivas contra Cloudflare Turnstile"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cloudflareRetryCount = 0;
        this.lastRequestTime = 0;
        this.sessionCookies = new Map();
        this.userAgentRotation = 0;
        this.preferMobile = true;
        this.fingerprint = this._generateFingerprint();
        this.sessionId = this._generateSessionId();
        this.browserEntropy = this._generateBrowserEntropy();
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
     * Headers optimizados con anti-detección Patchright-style
     */
    _generateTurnstileHeaders(attempt = 0, isFirstVisit = true, forceMobile = null) {
        const userAgent = this._getRotatedUserAgent(forceMobile);
        const isMobile = this._isMobileUserAgent(userAgent);
        const isFirefox = userAgent.includes('Firefox');
        const isIPhone = userAgent.includes('iPhone');
        const isChrome = userAgent.includes('Chrome');
        
        console.log(`📱 Usando ${isMobile ? 'MÓVIL' : 'ESCRITORIO'}: ${userAgent.substring(0, 50)}...`);

        // Base headers con orden específico (crítico para Patchright-style)
        const headers = {};
        
        // Orden estricto para evitar detección
        headers["User-Agent"] = userAgent;
        headers["Accept"] = this._getAcceptHeader(isMobile, isIPhone, isFirefox);
        headers["Accept-Language"] = this._getAcceptLanguageHeader(isMobile, isIPhone);
        headers["Accept-Encoding"] = this._getAcceptEncodingHeader(isMobile, isIPhone);
        headers["Connection"] = "keep-alive";
        headers["Upgrade-Insecure-Requests"] = "1";

        // Headers Sec-Fetch (orden específico)
        if (!isFirefox && !isIPhone) {
            headers["Sec-Fetch-Dest"] = "document";
            headers["Sec-Fetch-Mode"] = isFirstVisit ? "navigate" : "same-origin";
            headers["Sec-Fetch-Site"] = isFirstVisit ? "none" : "same-origin";
            headers["Sec-Fetch-User"] = "?1";
        }

        // Headers Client Hints (Chrome específico)
        if (isChrome && !isFirefox) {
            const clientHints = this._generateClientHints(userAgent, isMobile);
            Object.assign(headers, clientHints);
        }

        // Cache control estratégico
        if (attempt === 0) {
            headers["Cache-Control"] = "no-cache";
            headers["Pragma"] = "no-cache";
        } else if (attempt === 1) {
            headers["Cache-Control"] = "max-age=0";
        } else if (attempt >= 3) {
            // Headers mínimos para intentos avanzados
            delete headers["Cache-Control"];
            delete headers["Pragma"];
        }

        // DNT (Do Not Track) - realista
        if (Math.random() > 0.3) { // 70% de navegadores tienen DNT
            headers["DNT"] = "1";
        }

        // Referer con timing realista
        if (!isFirstVisit && attempt > 0) {
            headers["Referer"] = this.source.baseUrl + "/";
        }

        // Headers experimentales (Patchright-style)
        if (attempt >= 2 && isMobile) {
            headers["Sec-CH-UA-Arch"] = '"arm"';
            headers["Sec-CH-UA-Bitness"] = '"64"';
        }

        return headers;
    }

    /**
     * Accept header específico por dispositivo y navegador
     */
    _getAcceptHeader(isMobile, isIPhone, isFirefox) {
        if (isIPhone) {
            return "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
        } else if (isFirefox) {
            return "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
        } else if (isMobile) {
            return "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
        } else {
            return "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
        }
    }

    /**
     * Accept-Language con variaciones regionales realistas
     */
    _getAcceptLanguageHeader(isMobile, isIPhone) {
        const variants = [
            "es-ES,es;q=0.9,en;q=0.8",
            "es-ES,es;q=0.9,en;q=0.8,en-US;q=0.7",
            "es,es-ES;q=0.9,en;q=0.8",
            "es-ES,es;q=0.8,en;q=0.7"
        ];
        
        if (isIPhone) {
            return "es-ES,es;q=0.9";
        }
        
        return variants[Math.floor(Math.random() * variants.length)];
    }

    /**
     * Accept-Encoding con soporte moderno
     */
    _getAcceptEncodingHeader(isMobile, isIPhone) {
        if (isIPhone) {
            return "gzip, deflate, br";
        } else if (isMobile) {
            return Math.random() > 0.5 ? "gzip, deflate, br, zstd" : "gzip, deflate, br";
        } else {
            return "gzip, deflate, br, zstd";
        }
    }

    /**
     * Client Hints modernos y realistas
     */
    _generateClientHints(userAgent, isMobile) {
        const hints = {};
        
        if (isMobile) {
            hints["Sec-Ch-Ua-Mobile"] = "?1";
            hints["Sec-Ch-Ua-Platform"] = '"Android"';
            
            if (userAgent.includes('Chrome/138')) {
                hints["Sec-Ch-Ua"] = '"Chromium";v="138", "Not=A?Brand";v="99", "Google Chrome";v="138"';
                hints["Sec-Ch-Ua-Full-Version-List"] = '"Chromium";v="138.0.7000.0", "Not=A?Brand";v="99.0.0.0", "Google Chrome";v="138.0.7000.0"';
            } else if (userAgent.includes('Chrome/137')) {
                hints["Sec-Ch-Ua"] = '"Chromium";v="137", "Not=A?Brand";v="99", "Google Chrome";v="137"';
            }
        } else {
            hints["Sec-Ch-Ua-Mobile"] = "?0";
            hints["Sec-Ch-Ua-Platform"] = userAgent.includes('Mac') ? '"macOS"' : '"Windows"';
            
            if (userAgent.includes('Chrome/121')) {
                hints["Sec-Ch-Ua"] = '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"';
                hints["Sec-Ch-Ua-Full-Version-List"] = '"Not A(Brand";v="99.0.0.0", "Google Chrome";v="121.0.6167.160", "Chromium";v="121.0.6167.160"';
            }
        }

        return hints;
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
     * Bypass principal con técnicas Patchright-inspired
     */
    async _fetchWithAdvancedBypass(url, options = {}) {
        const maxRetries = 12; // Aumentado para más estrategias
        let lastError = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`🔄 Bypass Patchright-Style - Intento ${attempt + 1}/${maxRetries} para: ${url}`);
                
                // Estrategia progresiva más sofisticada
                let forceMobile = null;
                let strategy = 'normal';
                
                if (attempt < 4) {
                    forceMobile = true;
                    strategy = 'mobile_aggressive';
                } else if (attempt < 7) {
                    forceMobile = true;
                    strategy = 'mobile_stealth';
                } else if (attempt < 10) {
                    forceMobile = false;
                    strategy = 'desktop_fallback';
                } else {
                    forceMobile = attempt % 2 === 0;
                    strategy = 'desperate';
                }
                
                const headers = this._generateTurnstileHeaders(attempt, attempt === 0, forceMobile);
                const isMobile = this._isMobileUserAgent(headers["User-Agent"]);
                
                // Timing humano realista (Patchright-style)
                if (attempt > 0) {
                    const timing = this._calculateNetworkTiming(isMobile);
                    await this._smartDelay(attempt, 'unknown', isMobile);
                    
                    // Simular tiempo de pensamiento humano
                    if (attempt >= 3) {
                        const thinkTime = 500 + Math.random() * 2000;
                        console.log(`🤔 Tiempo de pensamiento humano: ${Math.round(thinkTime)}ms`);
                        await this._delay(thinkTime);
                    }
                }
                
                // Configuración de cliente con anti-detección
                const clientConfig = {
                    timeout: this._calculateTimeout(isMobile, strategy),
                    followRedirects: true,
                    maxRedirects: strategy === 'desperate' ? 8 : 5
                };
                
                // Headers adicionales para estrategias específicas
                if (strategy === 'mobile_stealth') {
                    headers["Sec-CH-Prefers-Color-Scheme"] = "light";
                    headers["Sec-CH-Prefers-Reduced-Motion"] = "no-preference";
                } else if (strategy === 'desktop_fallback') {
                    headers["Sec-CH-UA-Arch"] = '"x86"';
                    headers["Sec-CH-UA-Bitness"] = '"64"';
                }
                
                const client = new Client(clientConfig);
                
                // Pre-request: simular navegación humana
                if (attempt >= 5 && Math.random() > 0.5) {
                    console.log("🎭 Simulando navegación previa...");
                    try {
                        await client.get(this.source.baseUrl, {
                            "User-Agent": headers["User-Agent"],
                            "Accept": "text/html",
                            "Connection": "keep-alive"
                        });
                        await this._delay(800 + Math.random() * 1200);
                    } catch (e) {
                        console.log("⚠️ Pre-navegación falló, continuando...");
                    }
                }
                
                const response = await client.get(url, headers);
                const check = this._detectModernCloudflare(response);
                
                if (!check.isBlocked) {
                    console.log(`✅ Bypass exitoso - Intento ${attempt + 1} (${strategy}, ${isMobile ? '📱 móvil' : '💻 escritorio'})`);
                    this.cloudflareRetryCount = 0;
                    
                    // Simular tiempo de lectura humano
                    if (response.body.length > 10000) {
                        const readTime = 300 + Math.random() * 500;
                        await this._delay(readTime);
                    }
                    
                    return response;
                }
                
                console.warn(`🛡️ Bloqueado: ${check.type} (${check.status}) - ${strategy} ${isMobile ? '📱' : '💻'}`);
                await this._smartDelay(attempt, check.type, isMobile);
                lastError = new Error(`${check.type} ${check.status} (${strategy})`);
                
                // Estrategia de reset para intentos tardíos
                if (attempt >= 8) {
                    console.log("🔄 Reset de estado para intentos finales...");
                    this.userAgentRotation = 0;
                    this.sessionCookies.clear();
                }
                
            } catch (error) {
                console.error(`❌ Error intento ${attempt + 1}:`, error.message);
                lastError = error;
                
                // Manejo específico de errores
                if (error.message.includes('timeout')) {
                    await this._delay(2000 + attempt * 1000);
                } else if (error.message.includes('network')) {
                    await this._delay(3000);
                } else if (error.message.includes('SSL') || error.message.includes('TLS')) {
                    await this._delay(5000);
                }
            }
        }
        
        this.cloudflareRetryCount++;
        
        const errorMessage = `🚫 Bypass Patchright-style fallido después de ${maxRetries} intentos. ` +
                           `Error: ${lastError?.message || 'Desconocido'}. ` +
                           `Fallos consecutivos: ${this.cloudflareRetryCount}`;
        
        console.error(errorMessage);
        
        if (this.cloudflareRetryCount > 5) {
            throw new Error(`${errorMessage}. CRÍTICO: IP posiblemente bloqueada. Usar VPN o esperar 1+ hora.`);
        }
        
        throw new Error(errorMessage);
    }

    /**
     * Calcula timeout dinámico según estrategia
     */
    _calculateTimeout(isMobile, strategy) {
        const timeouts = {
            'mobile_aggressive': 20000,
            'mobile_stealth': 35000,
            'desktop_fallback': 45000,
            'desperate': 60000
        };
        
        return timeouts[strategy] || (isMobile ? 25000 : 30000);
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

    // ==================== PATCHRIGHT-INSPIRED ANTI-DETECTION ====================

    /**
     * Genera ID de sesión único para simular sesión persistente
     */
    _generateSessionId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Genera entropía de navegador realista (inspirado en Patchright)
     */
    _generateBrowserEntropy() {
        return {
            canvas: this._generateCanvasFingerprint(),
            webgl: this._generateWebGLFingerprint(),
            audio: this._generateAudioFingerprint(),
            fonts: this._generateFontList(),
            plugins: this._generatePluginList(),
            permissions: this._generatePermissions()
        };
    }

    /**
     * Canvas fingerprint simulado
     */
    _generateCanvasFingerprint() {
        // Simular hash de canvas típico de Android Chrome
        const androidHashes = [
            "a1b2c3d4e5f6789012345678901234567890abcd",
            "b2c3d4e5f6789012345678901234567890abcdef1",
            "c3d4e5f6789012345678901234567890abcdef12",
            "d4e5f6789012345678901234567890abcdef123",
            "e5f6789012345678901234567890abcdef1234"
        ];
        return androidHashes[Math.floor(Math.random() * androidHashes.length)];
    }

    /**
     * WebGL fingerprint simulado
     */
    _generateWebGLFingerprint() {
        return {
            vendor: "ARM",
            renderer: "Mali-G76 MP12",
            version: "WebGL 2.0",
            extensions: [
                "WEBGL_compressed_texture_s3tc",
                "WEBGL_compressed_texture_etc",
                "OES_texture_float",
                "OES_standard_derivatives"
            ]
        };
    }

    /**
     * Audio fingerprint simulado
     */
    _generateAudioFingerprint() {
        return Math.random().toString(36).substring(2, 10);
    }

    /**
     * Lista de fuentes típicas de Android
     */
    _generateFontList() {
        return [
            "Roboto", "Noto Sans", "Droid Sans", "Ubuntu",
            "Arial", "Helvetica", "sans-serif", "monospace"
        ];
    }

    /**
     * Lista de plugins típicos de móvil
     */
    _generatePluginList() {
        return [
            "Chrome PDF Plugin",
            "Chrome PDF Viewer",
            "Native Client"
        ];
    }

    /**
     * Permisos típicos de navegador móvil
     */
    _generatePermissions() {
        return {
            camera: "prompt",
            microphone: "prompt",
            notifications: "default",
            geolocation: "prompt"
        };
    }

    /**
     * TLS fingerprint avanzado (inspirado en Patchright)
     */
    _generateTLSFingerprint() {
        return {
            version: "TLS 1.3",
            cipherSuites: [
                "TLS_AES_128_GCM_SHA256",
                "TLS_AES_256_GCM_SHA384",
                "TLS_CHACHA20_POLY1305_SHA256"
            ],
            extensions: [
                "server_name",
                "supported_groups", 
                "signature_algorithms",
                "renegotiation_info"
            ]
        };
    }

    /**
     * Headers HTTP/2 con priorización realista
     */
    _generateHTTP2Headers(userAgent, isMobile) {
        const headers = {};
        
        // Orden específico de headers (crítico para anti-detección)
        const headerOrder = isMobile ? [
            ":method", ":authority", ":scheme", ":path",
            "cache-control", "sec-ch-ua", "sec-ch-ua-mobile", 
            "sec-ch-ua-platform", "upgrade-insecure-requests",
            "user-agent", "accept", "sec-fetch-site", "sec-fetch-mode",
            "sec-fetch-user", "sec-fetch-dest", "accept-encoding", 
            "accept-language"
        ] : [
            ":method", ":authority", ":scheme", ":path",
            "cache-control", "sec-ch-ua", "sec-ch-ua-mobile",
            "sec-ch-ua-platform", "upgrade-insecure-requests", 
            "user-agent", "accept", "sec-fetch-site", "sec-fetch-mode",
            "sec-fetch-user", "sec-fetch-dest", "accept-encoding",
            "accept-language"
        ];

        return { headers, order: headerOrder };
    }

    /**
     * Timing realista de red (simula latencia humana)
     */
    _calculateNetworkTiming(isMobile = true) {
        const base = isMobile ? 
            { dns: 12, connect: 45, tls: 67, ttfb: 156, total: 234 } :
            { dns: 8, connect: 32, tls: 54, ttfb: 123, total: 189 };
        
        // Agregar variación realista (+/- 15%)
        const variation = () => 0.85 + (Math.random() * 0.3);
        
        return {
            dnsLookup: Math.round(base.dns * variation()),
            tcpConnect: Math.round(base.connect * variation()),
            tlsHandshake: Math.round(base.tls * variation()),
            timeToFirstByte: Math.round(base.ttfb * variation()),
            totalTime: Math.round(base.total * variation())
        };
    }
}