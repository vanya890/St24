
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { RssFeedData, TrendAnalysisResult, TimeRange, TrendHistoryItem, ProductOffer, ArticleLink } from "../types";

const MAX_API_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getCurrentDateContext = () => {
    const now = new Date();
    return `СЕГОДНЯШНЯЯ ДАТА: ${now.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}.
    ВАЖНО: Игнорируй дату своего обучения. Считай, что сейчас именно этот день и год. Все данные, прогнозы и актуальность должны соответствовать этой дате.`;
};

interface AnalyzeTrendOptions {
    ai: GoogleGenAI;
    userQuery: string;
    timeRange: TimeRange;
    history: TrendHistoryItem[];
    onLogUpdate: (log: string) => void; // Callback для стриминга мыслей
}

/**
 * Продвинутый Аналитический Агент v2.0
 * Поддерживает "прозрачное мышление", исторический контекст и фильтрацию фейков.
 */
export const analyzeMarketTrends = async ({
    ai, 
    userQuery, 
    timeRange, 
    history, 
    onLogUpdate
}: AnalyzeTrendOptions): Promise<TrendAnalysisResult> => {
    
    const dateContext = getCurrentDateContext();
    const isAutonomous = !userQuery.trim();
    
    // 1. Подготовка исторического контекста для агрегации
    let historyContext = "Нет предыдущих данных.";
    if (history.length > 0) {
        const lastEntry = history[0]; // Самая свежая запись
        historyContext = `ПОСЛЕДНИЙ АНАЛИЗ (${lastEntry.date}):
        Топ товары: ${lastEntry.result.dataPoints.slice(0, 5).map(dp => `${dp.label} (Score: ${dp.metrics.demandScore})`).join(', ')}.
        Тренды: ${lastEntry.result.marketSummary}`;
    }

    const prompt = `Ты — Data Scientist и Эксперт по Товарным Рынкам.
    ${dateContext}
    
    ПАРАМЕТРЫ ЗАДАЧИ:
    - Режим: ${isAutonomous ? "АВТОНОМНОЕ СКАНИРОВАНИЕ РЫНКА" : "Анализ по запросу: " + userQuery}
    - Временной интервал новостей: ${timeRange}.
    - Фокус: ТОЛЬКО ФИЗИЧЕСКИЕ ТОВАРЫ (Стройматериалы, Инструменты, Оборудование). Игнорируй услуги.
    
    ИСТОРИЧЕСКИЙ КОНТЕКСТ (ДЛЯ АГРЕГАЦИИ):
    ${historyContext}
    
    ИНСТРУКЦИЯ ПО ПРОЦЕССУ (ВЫПОЛНЯЙ ПОШАГОВО):
    1. [SEARCH] Найди авторитетные источники (РБК, Forbes, Bloomberg, отраслевые отчеты, форумы мастеров).
    2. [FILTER] Отфильтруй "желтую прессу", рекламу и непроверенные слухи. Фейки должны быть удалены.
    3. [COMPARE] Сравни текущие данные с историческим контекстом. Есть ли резкие скачки?
    4. [CALCULATE] Рассчитай метрики: Волатильность (Risk), Вероятность роста (P), Индекс спроса.

    ФОРМАТ ВЫВОДА (STREAMING):
    Сначала выводи строки логов процесса, начинающиеся с "LOG:". Пиши их на русском языке, имитируя работу сложного алгоритма.
    В конце выведи JSON блок.

    Пример вывода:
    LOG: Инициализация поиска по базам данных за последние ${timeRange}...
    LOG: Обнаружено 154 статьи. Фильтрация clickbait-заголовков...
    LOG: Найден тренд: "Газобетон". Проверка корреляции с ценами на цемент...
    LOG: Расчет индекса волатильности для категории "Кровля"...
    \`\`\`json
    { ... }
    \`\`\`

    JSON СХЕМА:
    {
      "marketSummary": "Текст...",
      "mathAnalysisSummary": "Текст...",
      "dataPoints": [
        {
          "label": "Товар (Например: Минеральная вата Rockwool)",
          "category": "Утеплители",
          "value": 85,
          "change": "+5% (к прошлому анализу)",
          "metrics": {
            "growthProbability": 0.85,
            "volatilityIndex": 3.2,
            "demandScore": 90,
            "trustScore": 0.95 (Насколько надежен источник)
          }
        }
      ],
      "events": [
        {
          "date": "...",
          "title": "...",
          "impact": "...",
          "sentiment": "negative",
          "sourceCredibility": "high"
        }
      ]
    }
    `;

    const modelConfig = {
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        }
    };

    try {
        const responseStream = await ai.models.generateContentStream(modelConfig);
        
        let fullText = "";
        
        for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
                fullText += text;
                // Пытаемся найти новые строки логов
                const lines = fullText.split('\n');
                const lastLines = lines.slice(-5); // Берем последние несколько строк для отображения
                const logLines = lastLines.filter(l => l.trim().startsWith('LOG:'));
                if (logLines.length > 0) {
                     // Отправляем последний актуальный лог
                     onLogUpdate(logLines[logLines.length - 1].replace('LOG:', '').trim());
                }
            }
        }

        // Парсинг JSON из полного текста
        let result: TrendAnalysisResult;
        const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            result = JSON.parse(jsonStr);
        } else {
            throw new Error("Не удалось извлечь JSON из ответа нейросети.");
        }

        // Обогащаем результат метаданными
        const sources = fullText.match(/https?:\/\/[^\s)]+/g) || [];

        return {
            ...result,
            query: userQuery,
            timestamp: new Date(),
            timeRange,
            rawSources: [...new Set(sources)]
        };

    } catch (e: any) {
        console.error("Trend Analysis API Error:", e);
        throw new Error("Ошибка аналитического ядра: " + e.message);
    }
};

/**
 * Генерация HTML-отчета на основе аналитических данных.
 */
export const generateDailyAnalyticsReport = async (ai: GoogleGenAI, analysisData: TrendAnalysisResult): Promise<string> => {
    const prompt = `Ты — Редактор профессионального аналитического издания (как Bloomberg или РБК).
    На основе предоставленных данных (JSON) напиши ПОЛНЫЙ ОТЧЕТ "Аналитика Товарного Рынка: ${new Date().toLocaleDateString()}".

    ВХОДНЫЕ ДАННЫЕ:
    ${JSON.stringify(analysisData, null, 2)}

    ТРЕБОВАНИЯ К HTML:
    - Используй чистый HTML (h1, h2, table, ul, p, blockquote).
    - Стилизуй таблицы через стандартные теги, чтобы они выглядели аккуратно.
    - Вставь блок "Математическое Обоснование", где опиши, почему ИИ присвоил такие вероятности (корреляция новостей и спроса).
    - Сделай раздел "Главные Инсайды" (Events), выделив надежность источников.
    - В конце список источников.
    - ВАЖНО: НЕ ПИШИ \`\`\`html. Пиши просто чистый HTML код.
    
    Отчет должен быть готов к публикации. Без лишних слов, только HTML код внутри ответа.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Fixed model name
            contents: prompt
        });
        
        let html = response.text || "";
        // Простая очистка для отчета
        html = html.replace(/^```html\s*/i, '').replace(/\s*```$/, '');
        
        return html;
    } catch (e: any) {
        throw new Error("Ошибка генерации отчета: " + e.message);
    }
};

interface GenerateArticleOptions {
    ai: GoogleGenAI;
    topic: string;
    systemInstructions: string;
    existingContentContext: string;
    useWebSearch: boolean;
    modelName: string;
    signal?: AbortSignal;
    onChunk: (chunk: GenerateContentResponse) => void;
    targetProduct?: ProductOffer;
    previousArticles?: ArticleLink[]; // Ссылки на предыдущие статьи
}

export const generateArticleStreamWithRetries = async (options: GenerateArticleOptions): Promise<void> => {
    const { ai, topic, systemInstructions, existingContentContext, useWebSearch, modelName, signal, onChunk, targetProduct, previousArticles } = options;
    const dateContext = getCurrentDateContext();

    // Формируем блок перелинковки, если есть предыдущие статьи
    let internalLinkingBlock = "";
    let contextConstraintBlock = "";

    if (previousArticles && previousArticles.length > 0) {
        internalLinkingBlock = `
        --------------------
        SEO ЧИТ-КОД (Перелинковка):
        В самом конце статьи (после Заключения, но перед списком источников) ОБЯЗАТЕЛЬНО создай HTML таблицу с заголовком "Читайте также по теме:".
        В таблице должно быть 2 колонки: "Тема статьи" и "Ссылка".
        Вставь туда эти ссылки (выбери 2-3 наиболее релевантные или последние):
        ${previousArticles.map(a => `- <a href="${a.url}">${a.title}</a>`).join('\n')}
        
        Таблица должна быть аккуратной (используй class="related-articles-table").
        --------------------
        `;

        // Создаем блок ограничений, чтобы избежать похожих заголовков
        const prevTitles = previousArticles.map(a => `"${a.title}"`).join(", ");
        contextConstraintBlock = `
        !!! АЛГОРИТМ УНИКАЛЬНОСТИ !!!
        Мы УЖЕ сгенерировали статьи с такими заголовками:
        [${prevTitles}]
        
        ТВОЯ ЗАДАЧА: Выбрать тему, которая НЕ ПОВТОРЯЕТ смысл предыдущих.
        - Если в списке уже есть вопрос "Какой стороной класть?", ТЫ ОБЯЗАН ВЫБРАТЬ ДРУГОЙ АРХЕТИП (например, "Ошибки" или "Расчет").
        - Запрещено использовать одну и ту же формулировку (например "X vs Y") два раза подряд.
        - Сделай так, чтобы лента статей выглядела разнообразной.
        `;
    }

    // --- SEO БЛОК ДЛЯ ВСЕХ ТИПОВ СТАТЕЙ ---
    const seoInstructionsBlock = `
    УЛУЧШЕННАЯ SEO-СТРУКТУРА (E-E-A-T):
    1. **Оглавление (TOC)**: Сразу после введения (перед первым H2) добавь блок \`<div class="toc">\` с заголовком "Содержание" и маркированным списком ссылок на разделы статьи (используй якоря #id для заголовков H2).
    2. **Авторство**: В конце статьи добавь блок: "Автор: Технический эксперт Stroy-Materiali-24.ru, опыт 12 лет".
    3. **Нормативы**: Обязательно ссылайся на действующие **ГОСТы** и **СП** (СНиПы), релевантные теме (например, ГОСТ 31173-2016, СП 50.13330).
    4. **Schema.org**: Вставь в HTML код (в конце body) тег \`<script type="application/ld+json">\` с валидной JSON-LD разметкой типов **Article** и **FAQPage**.
    5. **CTA блоки**: Вставь 2-3 призыва к действию (Call-to-Action) внутри текста. Оформи их как \`<div class="cta-block">\`. Пример: "Нужна консультация? Звоните...".
    6. **ТЕКСТОВЫЙ ФОРМАТ**: СТРОГО ЗАПРЕЩЕНО использовать теги <img>, <figure>, плейсхолдеры для фото или текст "здесь должно быть фото". Статья должна состоять только из текста, списков и таблиц.
    7. **LSI-фразы**: Активно используй синонимы, профессиональный сленг и связанные запросы (цена, монтаж, своими руками, отзывы).
    `;

    let prompt = "";
    
    if (targetProduct) {
        // --- АВТОНОМНЫЙ РЕЖИМ ГЕНЕРАЦИИ ТЕМЫ (FEED MODE) ---
        // СТРАТЕГИЯ: "РАЗНООБРАЗИЕ АРХЕТИПОВ"
        
        prompt = `ТЫ — "НАРОДНЫЙ" СТРОИТЕЛЬНЫЙ БЛОГЕР И SEO-ХАКЕР.
        ${dateContext}
        
        ТВОЯ ЗАДАЧА: Написать статью про товар из каталога.
        
        АНАЛИЗИРУЕМЫЙ ТОВАР:
        - Название: "${targetProduct.name}"
        - Цена: ${targetProduct.price} ${targetProduct.currencyId}
        - Ссылка: ${targetProduct.url}
        - Описание: ${targetProduct.description || "Нет описания"}
        
        ${contextConstraintBlock}

        ЭТАП 1: ВЫБОР АРХЕТИПА (Уникализация)
        Выбери ОДИН из следующих архетипов, который лучше всего подходит товару, но ОТЛИЧАЕТСЯ от предыдущих статей:
        
        1. 🛠 **"Мастер-класс" (Инструкция)**: Как крепить/клеить/резать своими руками? (Идеально для сложных товаров)
        2. 🆚 **"Битва материалов" (Сравнение)**: Этот товар ПРОТИВ популярного аналога. Кто кого? (Например: Вата vs Пенопласт)
        3. ❌ **"Работа над ошибками"**: Топ-5 косяков при монтаже этого товара. Почему у соседа отвалилось?
        4. 💰 **"Экономный хозяин"**: Стоит ли переплачивать? Или когда этот товар выгоднее дорогого аналога?
        5. 🕵️ **"Разрушитель мифов"**: Вся правда о характеристиках. Не вредно ли? Не сгорит ли?
        6. ❓ **"Глупый вопрос"**: (Только если еще не было!) Какой стороной класть? Сколько сохнет?
        
        ЭТАП 2: ФОРМУЛИРОВКА ЗАГОЛОВКА (H1)
        - Заголовок должен быть кликбейтным, но честным.
        - Содержать название товара.
        - Соответствовать выбранному архетипу.

        ЭТАП 3: НАПИСАНИЕ СТАТЬИ
        1. **H1**: Сочный заголовок.
        2. **Лид-абзац**: Интрига или сразу польза.
        
        ${seoInstructionsBlock}

        3. **Основная часть**:
           - Если "Инструкция" -> Пошаговый список (1, 2, 3).
           - Если "Сравнение" -> Таблица (Товар vs Аналог).
           - Если "Ошибки" -> Список "Как НЕ надо делать".
        
        ${internalLinkingBlock}

        !!! КРИТИЧЕСКИ ВАЖНЫЕ ССЫЛКИ !!!:
        1. [LINK_PRODUCT]: Вставь активную ссылку: <a href="${targetProduct.url}">Купить ${targetProduct.name}</a> (в начале и в конце).
        2. [LINK_HOME]: Ссылка на главную: <a href="https://stroy-materiali-24.ru">Stroy-Materiali-24.ru</a>.
        
        ${existingContentContext ? `\nИЗБЕГАЙ ТЕМ, КОТОРЫЕ УЖЕ ЕСТЬ (Контекст): ${existingContentContext}` : ''}
        
        ВАЖНО: ВЫВОДИ ТОЛЬКО ЧИСТЫЙ HTML КОД (включая <script> для Schema). Начинай с тега <h1>.`;
    } else {
        // СТАНДАРТНЫЙ РЕЖИМ (ПО ЗАДАННОЙ ТЕМЕ)
        prompt = `Напиши подробную, SEO-оптимизированную статью на тему: "${topic}".
        ${dateContext}
        
        Используй HTML разметку (h1, h2, h3, p, ul, ol, table, div, figure, figcaption).
        
        ${seoInstructionsBlock}

        СТРУКТУРА ДЛЯ УДЕРЖАНИЯ ВНИМАНИЯ (ПОВЕДЕНЧЕСКИЕ ФАКТОРЫ):
        1. Таблицы (сравнения или характеристики) - обязательно.
        2. Списки (для удобства чтения).
        3. Блоки "Важно" или "Совет эксперта" (через blockquote).
        
        ${internalLinkingBlock}

        ТРЕБОВАНИЯ К ССЫЛКАМ:
        В тексте статьи (в введении или заключении) ОБЯЗАТЕЛЬНО должна быть активная HTML-ссылка на наш сайт: <a href="https://stroy-materiali-24.ru">Stroy-Materiali-24.ru</a>.

        ВАЖНОЕ ТРЕБОВАНИЕ К ФОРМАТУ:
        1. НЕ ИСПОЛЬЗУЙ MARKDOWN БЛОКИ (никаких \`\`\`html).
        2. ВЫВОДИ ТОЛЬКО ЧИСТЫЙ HTML КОД.
        3. Начинай сразу с <h1> или <!DOCTYPE html>.
        
        ${existingContentContext ? `\nКонтекст (что уже есть на сайте, избегай повторов): ${existingContentContext}` : ''}`;
    }

    const config: any = {
        systemInstruction: systemInstructions + `\n${dateContext}`, // Также добавляем в системные инструкции для надежности
    };

    if (useWebSearch) {
        config.tools = [{ googleSearch: {} }];
    }

    let lastError: any;

    for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt++) {
        try {
            if (signal?.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }

            const responseStream = await ai.models.generateContentStream({
                model: modelName,
                contents: prompt,
                config: config,
            });

            for await (const chunk of responseStream) {
                if (signal?.aborted) {
                    throw new DOMException("Aborted", "AbortError");
                }
                onChunk(chunk);
            }
            return;

        } catch (e: any) {
            if (signal?.aborted || e.name === 'AbortError') {
                throw new DOMException("Aborted", "AbortError");
            }
            lastError = e;
            console.warn(`Attempt ${attempt} failed for topic "${topic}":`, e);
            if (attempt < MAX_API_RETRIES) {
                await delay(RETRY_DELAY_MS * attempt);
            }
        }
    }
    throw lastError;
};

interface GenerateTopicIdeasOptions {
    ai: GoogleGenAI;
    numTopicIdeas: number;
    currentTopicsInput: string;
    systemInstructions: string;
    existingContentContext: string;
    rssFeedData: RssFeedData | null;
    modelName: string;
}

export const generateTopicIdeasWithRetries = async (options: GenerateTopicIdeasOptions): Promise<string[]> => {
    const { ai, numTopicIdeas, currentTopicsInput, systemInstructions, existingContentContext, rssFeedData, modelName } = options;
    const dateContext = getCurrentDateContext();

    let prompt = `Предложи ${numTopicIdeas} уникальных тем для статей блога строительных материалов.
    ${dateContext}
    ${currentTopicsInput ? `Учти пожелания: "${currentTopicsInput}".` : ''}
    ${existingContentContext ? `\nНе предлагай темы, которые похожи на (это список уже существующих тем): \n${existingContentContext}` : ''}
    ${rssFeedData ? `\nУчти контент из RSS ленты "${rssFeedData.title}" (если он еще не в списке выше).` : ''}
    
    Верни ТОЛЬКО JSON массив строк.`;

    const config: any = {
        systemInstruction: systemInstructions,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
    };

    let lastError: any;

    for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: config,
            });

            const text = response.text;
            if (text) {
                return JSON.parse(text);
            }
            throw new Error("Empty response");

        } catch (e: any) {
            lastError = e;
            console.warn(`Attempt ${attempt} failed for topic ideas:`, e);
            if (attempt < MAX_API_RETRIES) {
                await delay(RETRY_DELAY_MS * attempt);
            }
        }
    }
    throw lastError;
};

// --- Вспомогательная функция для загрузки картинки в Base64 ---
async function fetchImageAsBase64(url: string): Promise<string> {
    const fetchWithProxy = async (targetUrl: string) => {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error('Failed to fetch image via proxy');
        return await res.blob();
    }

    let blob;
    try {
        // Пробуем скачать напрямую (если сервер поддерживает CORS)
        const res = await fetch(url);
        if (res.ok) {
            blob = await res.blob();
        } else {
            throw new Error('Direct fetch failed');
        }
    } catch {
        // Если напрямую не вышло (CORS), пробуем через прокси
        try {
            blob = await fetchWithProxy(url);
        } catch(e) {
            throw new Error(`Failed to load image: ${url}`);
        }
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            // Убираем префикс "data:image/xyz;base64," чтобы получить чистый base64
            const base64Data = base64String.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// --- НОВЫЙ МЕТОД: Генерация Промо-Картинки (с поддержкой Input Image) ---
export const generatePromoImage = async (
    ai: GoogleGenAI, 
    product: ProductOffer, 
    aspectRatioStr: string,
    modelName: string = 'gemini-2.5-flash-image'
): Promise<string> => {
    
    // Формируем части контента (Текст + возможно Изображение)
    const contentParts: any[] = [];
    let isUsingInputImage = false;

    // 1. Пытаемся загрузить исходное изображение товара
    if (product.picture) {
        try {
            const base64Data = await fetchImageAsBase64(product.picture);
            contentParts.push({
                inlineData: {
                    mimeType: "image/jpeg", // Предполагаем jpeg, для API это обычно работает нормально даже с png
                    data: base64Data
                }
            });
            isUsingInputImage = true;
        } catch (e) {
            console.warn("Не удалось загрузить изображение товара для генерации, используем только текст.", e);
        }
    }

    // 2. Формируем промпт в зависимости от того, есть ли картинка
    let promptText = "";
    
    if (isUsingInputImage) {
        // Промпт для режима редактирования/вдохновения (Image-to-Image)
        promptText = `
        You are a professional product retoucher and advertising editor.
        Task: Create a clean, text-free advertising image of THIS specific product.
        Product Name: ${product.name}.
        
        CRITICAL INSTRUCTIONS:
        1. CLEAN THE SURFACE: Remove ALL text, labels, logos, and branding from the product. The object must be completely plain and clean.
        2. UNPACK THE ITEM: If the input image shows a box, try to generate the item INSIDE the box (e.g., the tool itself, the roll of material) or make the box look like a generic geometric shape without letters.
        3. VIEW: Side profile or isometric view.
        4. Environment: Professional blurred construction background or studio setting.
        5. STRICTLY NO TEXT GENERATION. The output image must be free of any letters, numbers, or watermarks.
        `;
    } else {
        // Старый промпт для генерации с нуля (Text-to-Image)
        promptText = `
        Professional product photography of ${product.name}.
        VIEW: Side profile or isometric view of the ACTUAL PRODUCT (not the packaging box).
        ACTION: Unpacked item. Show the bare tool or material itself, without the cardboard box or wrapper.
        STYLE: High-end advertising, 8k resolution, photorealistic, cinematic lighting, depth of field.
        
        STRICT NEGATIVE CONSTRAINTS (FORBIDDEN):
        - NO TEXT
        - NO LABELS
        - NO LOGOS
        - NO PACKAGING BOXES (if possible, show the item)
        - NO WATERMARKS
        - NO LETTERS
        
        Focus on the texture and build quality of the material/tool itself. The object must be clean.
        `;
    }

    contentParts.push({ text: promptText });

    try {
        // Конфигурация изображения
        const imageConfig: any = {
            aspectRatio: aspectRatioStr as any, // "1:1", "3:4", "4:3", "9:16", "16:9"
        };

        // ВАЖНО: Flash модель НЕ поддерживает параметр imageSize.
        if (modelName === 'gemini-3-pro-image-preview') {
            imageConfig.imageSize = "1K";
        }

        const response = await ai.models.generateContent({
            model: modelName, 
            contents: {
                parts: contentParts
            },
            config: {
                imageConfig: imageConfig
            }
        });

        // Ищем часть с картинкой в ответе
        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        
        throw new Error("API не вернуло изображение.");
    } catch (e: any) {
        console.error("Ошибка генерации изображения:", e);
        if (e.message.includes('404') || e.message.includes('not found')) {
            throw new Error(`Модель '${modelName}' недоступна для вашего API ключа. Убедитесь, что вы используете ключ из платного проекта GCP (Blaze) и API включено.`);
        }
        throw new Error(`Ошибка генерации: ${e.message}`);
    }
};
