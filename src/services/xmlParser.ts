
import { ProductFeedData, ProductOffer, ProductCategory } from "../types";
import { XMLParser } from 'fast-xml-parser';

type ProgressCallback = (percent: number, loadedBytes: number, totalBytes: number | null) => void;

interface ProxyStrategy {
    name: string;
    url: (target: string) => string;
    /**
     * 'stream': ожидает сырой text/xml поток.
     * 'json': ожидает { contents: "string_data" } (для AllOrigins JSON API).
     */
    responseType: 'stream' | 'json'; 
}

const strategies: ProxyStrategy[] = [
    // 1. AllOrigins Raw (Часто самый надежный для XML)
    {
        name: "AllOrigins (Raw)",
        url: (target: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
        responseType: 'stream'
    },
    // 2. AllOrigins JSON (Альтернативный эндпоинт)
    {
        name: "AllOrigins (JSON)",
        url: (target: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
        responseType: 'json'
    },
    // 3. CorsProxy.io (Быстрый, но может блочить)
    {
        name: "CorsProxy.io",
        url: (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
        responseType: 'stream'
    },
    // 4. Yacdn
    {
        name: "Yacdn",
        url: (target: string) => `https://yacdn.org/proxy/${target}`,
        responseType: 'stream'
    },
    // 5. ThingProxy
    {
        name: "ThingProxy",
        url: (target: string) => `https://thingproxy.freeboard.io/fetch/${target}`,
        responseType: 'stream'
    },
    // 6. Direct (Попытка прямого соединения, если CORS разрешен на сервере)
    {
        name: "Direct (Прямое)",
        url: (target: string) => target,
        responseType: 'stream'
    }
];

/**
 * Polyfill for Promise.any
 */
const safePromiseAny = <T>(promises: Promise<T>[]): Promise<T> => {
    return new Promise((resolve, reject) => {
        let errors: any[] = new Array(promises.length).fill(null);
        let rejectedCount = 0;
        
        if (promises.length === 0) {
            return reject(new Error("No promises provided"));
        }

        promises.forEach((p, index) => {
            Promise.resolve(p)
                .then(resolve)
                .catch(e => {
                    errors[index] = e;
                    rejectedCount++;
                    if (rejectedCount === promises.length) {
                        const error: any = new Error("All promises rejected");
                        error.errors = errors;
                        reject(error);
                    }
                });
        });
    });
};

/**
 * Читает ReadableStream и преобразует его в строку.
 * Также вызывает колбэк прогресса.
 */
const readStreamToText = async (
    response: Response, 
    onProgress?: (loaded: number, total: number | null) => void
): Promise<string> => {
    const reader = response.body?.getReader();
    const contentLengthHeader = response.headers.get('Content-Length');
    const totalLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;

    // Определение кодировки
    const contentType = response.headers.get('Content-Type');
    let charset = 'utf-8';
    if (contentType) {
        const match = contentType.match(/charset=([^;]+)/i);
        if (match && match[1]) {
            charset = match[1].trim().toLowerCase();
        }
    }

    if (!reader) {
        const text = await response.text();
        onProgress?.(text.length, text.length);
        return text;
    }

    let receivedLength = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;
        onProgress?.(receivedLength, totalLength);
    }

    // Собираем чанки
    const combined = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
        combined.set(chunk, position);
        position += chunk.length;
    }

    try {
        const decoder = new TextDecoder(charset);
        return decoder.decode(combined);
    } catch (e) {
        console.warn(`TextDecoder не поддерживает кодировку ${charset}, используем utf-8.`);
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(combined);
    }
};

const fetchXmlWithRaceAndProgress = async (targetUrl: string, onProgress?: ProgressCallback): Promise<string> => {
    // Добавляем timestamp чтобы избежать кеширования прокси-серверами
    const separator = targetUrl.includes('?') ? '&' : '?';
    const urlWithCacheBust = `${targetUrl}${separator}_t=${Date.now()}`;

    const controllers = strategies.map(() => new AbortController());
    
    // Переменная для отслеживания макс. прогресса
    let maxLoaded = 0;

    const downloadPromises = strategies.map(async (strategy, index) => {
        const controller = controllers[index];
        // Увеличиваем таймаут, так как некоторые прокси могут быть медленными с большими файлами
        const timeoutId = setTimeout(() => controller.abort(), 60000); 

        try {
            const proxyUrl = strategy.url(urlWithCacheBust);
            
            console.log(`[${strategy.name}] Старт загрузки...`);
            
            const response = await fetch(proxyUrl, { 
                signal: controller.signal,
                method: 'GET'
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Status ${response.status}`);
            }

            let resultText = "";

            if (strategy.responseType === 'json') {
                // Обработка JSON стратегии (AllOrigins JSON)
                const data = await response.json();
                if (!data.contents || typeof data.contents !== 'string') {
                    throw new Error("JSON ответ не содержит валидного поля 'contents'");
                }
                resultText = data.contents;

                // Эмулируем 100% прогресс
                if (resultText.length > maxLoaded) {
                    maxLoaded = resultText.length;
                    onProgress?.(100, resultText.length, resultText.length);
                }
            } else {
                // Обработка потоковой стратегии
                resultText = await readStreamToText(response, (loaded, total) => {
                    if (loaded > maxLoaded) {
                        maxLoaded = loaded;
                        const percent = total ? (loaded / total) * 100 : 0;
                        onProgress?.(percent, loaded, total);
                    }
                });
            }

            if (!resultText || resultText.trim().length === 0) {
                throw new Error("Скачанный контент пуст");
            }
            
            // Продвинутая валидация контента
            const trimStart = resultText.trim().substring(0, 300).toLowerCase();
            
            // Проверка 1: Явные ошибки прокси в HTML
            if (trimStart.includes('access denied') || 
                trimStart.includes('403 forbidden') || 
                trimStart.includes('error') || 
                trimStart.includes('cloudflare')) {
                // Если это не похоже на XML, но содержит слова ошибки
                if (!trimStart.includes('<?xml') && !trimStart.includes('<yml_catalog') && !trimStart.includes('<rss')) {
                    throw new Error(`Ответ похож на страницу ошибки прокси: "${trimStart.substring(0, 50)}..."`);
                }
            }

            // Проверка 2: Это вообще XML?
            const isXmlLike = trimStart.includes('<yml_catalog') || trimStart.includes('<?xml') || trimStart.includes('<rss') || trimStart.includes('<feed');
            
            if (!isXmlLike) {
                 // Если это просто HTML страница, считаем ошибкой
                 if (trimStart.startsWith('<!doctype html') || trimStart.startsWith('<html')) {
                     throw new Error("Получена HTML страница вместо XML фида.");
                 }
                 console.warn(`[${strategy.name}] Warning: Response does not look like standard YML/XML.`);
            }

            console.log(`[${strategy.name}] ✅ Успешно загружено ${resultText.length} байт.`);
            return resultText;

        } catch (e: any) {
            clearTimeout(timeoutId);
            if (e.name !== 'AbortError') {
                console.warn(`[${strategy.name}] Ошибка:`, e.message);
            }
            throw e;
        }
    });

    try {
        const finalContent = await safePromiseAny(downloadPromises);
        controllers.forEach(c => c.abort());
        return finalContent;

    } catch (aggregateError: any) {
        const errors = aggregateError.errors || [aggregateError];
        
        // Формирование читаемого списка ошибок
        const errorDetails = strategies.map((s, i) => {
            const err = errors[i];
            let msg = 'Unknown Error';
            if (err) {
                if (err instanceof Error) msg = err.message;
                else if (typeof err === 'object') msg = JSON.stringify(err);
                else msg = String(err);
            }
            return `${s.name}: ${msg}`;
        }).join('\n');
        
        console.error("Все методы загрузки не сработали. Детали:\n", errorDetails);

        throw new Error(`Не удалось загрузить фид ни одним способом (вероятно, блокировка CORS или защиты сайта).\n\nПожалуйста, скачайте файл вручную и используйте загрузку с диска.`);
    }
};

export const parseYmlContent = (xmlString: string): ProductFeedData => {
    if (!xmlString || xmlString.trim().length === 0) {
        throw new Error("Содержимое файла пусто (Parse Error).");
    }

    console.time("parse_feed_json");
    
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_", 
        parseAttributeValue: true,
        isArray: (name) => {
            if (name === 'offer') return true;
            if (name === 'category') return true;
            if (name === 'currency') return true;
            return false;
        }
    });

    let jsonObj;
    try {
        jsonObj = parser.parse(xmlString);
    } catch (e: any) {
        throw new Error("Ошибка синтаксиса XML: " + e.message);
    }
    console.timeEnd("parse_feed_json");

    // Маппинг данных
    const root = jsonObj.yml_catalog || jsonObj["yml_catalog"];
    if (!root) throw new Error("Неверный формат YML: нет корневого тега <yml_catalog>. Убедитесь, что ссылка ведет на YML файл.");

    const shop = root.shop;
    if (!shop) throw new Error("Неверный формат: нет тега <shop>");

    const shopName = shop.name || "";
    const company = shop.company || "";
    const shopUrl = shop.url || "";
    const catalogDate = root["@_date"] || new Date().toISOString();

    const categories: ProductCategory[] = [];
    const rawCategories = shop.categories?.category || [];
    
    for (let i = 0; i < rawCategories.length; i++) {
        const cat = rawCategories[i];
        categories.push({
            id: String(cat["@_id"]),
            parentId: cat["@_parentId"] ? String(cat["@_parentId"]) : undefined,
            name: String(cat["#text"] || cat) 
        });
    }

    const offers: ProductOffer[] = [];
    let rawOffers = [];
    if (shop.offers && shop.offers.offer) {
        rawOffers = shop.offers.offer;
    } else if (Array.isArray(shop.offers)) {
         rawOffers = shop.offers;
    }

    for (let i = 0; i < rawOffers.length; i++) {
        const off = rawOffers[i];
        offers.push({
            id: String(off["@_id"] || ""),
            available: off["@_available"] === true || off["@_available"] === "true",
            url: off.url || "",
            price: String(off.price || "0"),
            currencyId: String(off.currencyId || "RUB"),
            categoryId: String(off.categoryId || ""),
            picture: off.picture || "",
            name: off.name || off.model || "Без названия",
            description: off.description || "",
            vendor: off.vendor || ""
        });
    }

    if (offers.length === 0) {
        throw new Error("Файл валиден, но товары не найдены (тег offers пуст).");
    }

    return {
        shopName,
        company,
        url: shopUrl,
        date: catalogDate,
        currencies: ["RUB"], 
        categories,
        offers
    };
};

export const fetchAndParseYmlFeed = async (url: string, onProgress?: ProgressCallback): Promise<ProductFeedData> => {
    console.time("download_feed");
    const xmlString = await fetchXmlWithRaceAndProgress(url, onProgress);
    console.timeEnd("download_feed");
    return parseYmlContent(xmlString);
};
