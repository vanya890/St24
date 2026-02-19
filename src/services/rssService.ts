
import { RssFeedData, RssItem } from "../types";

export const fetchAndParseRss = async (initialUrl: string): Promise<RssFeedData> => {
    let currentUrl: string | null = initialUrl;
    let allItems: RssItem[] = [];
    let feedTitle = "";
    let feedDescription = "";
    
    // Лимит страниц. 
    const MAX_PAGES = 1000;
    let pagesFetched = 0;
    const visitedUrls = new Set<string>();

    while (currentUrl && pagesFetched < MAX_PAGES) {
        // Нормализация URL для проверки дублей
        // Некоторые CMS могут менять порядок параметров, но для нас это одна и та же ссылка
        const normalizeUrl = (u: string) => {
            try {
                const urlObj = new URL(u);
                urlObj.searchParams.sort();
                return urlObj.toString();
            } catch { return u; }
        };

        const normalizedCurrent = normalizeUrl(currentUrl);

        if (visitedUrls.has(normalizedCurrent)) {
            console.log("Обнаружен цикл в пагинации RSS или повтор URL, остановка.");
            break;
        }
        visitedUrls.add(normalizedCurrent);
        pagesFetched++;

        try {
            console.log(`Загрузка RSS страницы ${pagesFetched}: ${currentUrl}`);
            const xmlString = await fetchXmlText(currentUrl);
            const { title, description, items, nextUrl } = parseXmlInternal(xmlString);

            if (pagesFetched === 1) {
                feedTitle = title;
                feedDescription = description;
            }

            allItems = [...allItems, ...items];
            
            if (nextUrl) {
                try {
                    // Разрешаем относительные URL относительно текущего
                    const nextUrlObj = new URL(nextUrl, currentUrl);
                    currentUrl = nextUrlObj.href;
                } catch (e) {
                    console.warn("Некорректный URL следующей страницы:", nextUrl);
                    currentUrl = null;
                }
            } else {
                currentUrl = null;
            }

        } catch (e: any) {
            console.error(`Ошибка загрузки страницы ${pagesFetched} (${currentUrl}):`, e);
            if (pagesFetched === 1) throw e;
            break;
        }
    }

    if (allItems.length === 0) {
        throw new Error("Лента пуста или не удалось загрузить записи.");
    }

    // Удаление дубликатов по ссылке
    const seenLinks = new Set();
    const uniqueItems: RssItem[] = [];
    for (const item of allItems) {
        if (!seenLinks.has(item.link)) {
            seenLinks.add(item.link);
            uniqueItems.push(item);
        }
    }
    
    console.log(`Анализ завершен. Загружено страниц: ${pagesFetched}, Найдено уникальных статей: ${uniqueItems.length}`);

    return {
        title: feedTitle,
        description: feedDescription,
        items: uniqueItems,
        url: initialUrl
    };
};

const strategies = [
    {
        name: "AllOrigins",
        url: (target: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
        extract: async (res: Response) => {
            const data = await res.json();
            return data.contents;
        }
    },
    {
        name: "CorsProxy.io",
        url: (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
        extract: async (res: Response) => await res.text()
    },
    {
        name: "CodeTabs",
        url: (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
        extract: async (res: Response) => await res.text()
    }
];

const fetchXmlText = async (url: string): Promise<string> => {
    let lastError: any = null;
    for (const strategy of strategies) {
        try {
            const proxyUrl = strategy.url(url);
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const xmlString = await strategy.extract(response);
            
            if (!xmlString || (!xmlString.includes('<rss') && !xmlString.includes('<feed'))) {
                throw new Error("Ответ не похож на XML/RSS");
            }

            return xmlString;

        } catch (e: any) {
            console.warn(`Прокси ${strategy.name} не сработал для ${url}:`, e);
            lastError = e;
        }
    }
    throw new Error(`Не удалось загрузить данные. Последняя ошибка: ${lastError?.message || 'Unknown'}`);
};

const parseXmlInternal = (xmlString: string): { title: string, description: string, items: RssItem[], nextUrl: string | null } => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
        throw new Error("Ошибка парсинга XML.");
    }

    let title = "";
    let description = "";
    let items: RssItem[] = [];
    let nextUrl: string | null = null;

    // Универсальный поиск тега с rel="next"
    // Мы перебираем ВСЕ элементы, у которых есть атрибут href и rel,
    // игнорируя неймспейсы (link vs atom:link), что часто ломает стандартные селекторы.
    const allElements = xmlDoc.getElementsByTagName("*");
    for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        // Проверяем, похоже ли это на link
        if (el.tagName.toLowerCase().includes("link")) {
            const rel = el.getAttribute("rel");
            if (rel === "next") {
                nextUrl = el.getAttribute("href");
                if (nextUrl) break; // Нашли ссылку, выходим
            }
        }
    }

    // Определяем тип фида для парсинга контента
    const isAtom = xmlDoc.getElementsByTagName("feed").length > 0;

    if (isAtom) {
        const feed = xmlDoc.getElementsByTagName("feed")[0];
        const titleNode = feed.getElementsByTagName("title")[0];
        title = titleNode ? titleNode.textContent || "Без названия" : "Без названия";
        
        const subNode = feed.getElementsByTagName("subtitle")[0];
        description = subNode ? subNode.textContent || "" : "";
        
        const entries = Array.from(xmlDoc.getElementsByTagName("entry"));
        items = entries.map(entry => {
            const t = entry.getElementsByTagName("title")[0];
            const s = entry.getElementsByTagName("summary")[0];
            const c = entry.getElementsByTagName("content")[0];
            const u = entry.getElementsByTagName("updated")[0];
            
            let linkHref = "";
            const entryLinks = entry.getElementsByTagName("link");
            for(let i=0; i<entryLinks.length; i++) {
                // Ищем alternate или берем первую попавшуюся
                const rel = entryLinks[i].getAttribute("rel");
                if (rel === "alternate" || !rel) {
                    linkHref = entryLinks[i].getAttribute("href") || "";
                    break;
                }
            }
            if (!linkHref && entryLinks.length > 0) linkHref = entryLinks[0].getAttribute("href") || "";

            return {
                title: t ? t.textContent || "Без заголовка" : "Без заголовка",
                link: linkHref,
                description: s ? s.textContent || "" : (c ? c.textContent || "" : ""),
                pubDate: u ? u.textContent || "" : ""
            };
        });

    } else {
        // RSS
        const channel = xmlDoc.getElementsByTagName("channel")[0];
        if (channel) {
             const t = channel.getElementsByTagName("title")[0];
             const d = channel.getElementsByTagName("description")[0];
             title = t ? t.textContent || "Без названия" : "Без названия";
             description = d ? d.textContent || "" : "";
        }
       
        const rssItems = Array.from(xmlDoc.getElementsByTagName("item"));
        items = rssItems.map(item => {
            const t = item.getElementsByTagName("title")[0];
            const l = item.getElementsByTagName("link")[0];
            const d = item.getElementsByTagName("description")[0];
            const p = item.getElementsByTagName("pubDate")[0];

            return {
                title: t ? t.textContent || "Без заголовка" : "Без заголовка",
                link: l ? l.textContent || "" : "",
                description: d ? d.textContent || "" : "",
                pubDate: p ? p.textContent || "" : ""
            };
        });
    }

    items = items.map(item => ({
        ...item,
        description: item.description.replace(/<[^>]*>?/gm, '').substring(0, 300) + (item.description.length > 300 ? "..." : "")
    }));

    return { title, description, items, nextUrl };
};
