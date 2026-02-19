
// localStorage keys
export const LOCAL_STORAGE_TOPICS_KEY = 'aiArticleGenerator_topicsInput';
export const LOCAL_STORAGE_SYSTEM_INSTRUCTIONS_KEY = 'aiArticleGenerator_systemInstructionsInput';
export const LOCAL_STORAGE_EXISTING_CONTENT_KEY = 'aiArticleGenerator_existingContentInput';
export const LOCAL_STORAGE_USE_WEB_SEARCH_KEY = 'aiArticleGenerator_useWebSearch';
export const LOCAL_STORAGE_NUM_TOPIC_IDEAS_KEY = 'aiArticleGenerator_numTopicIdeas';
export const LOCAL_STORAGE_HISTORY_KEY = 'generationHistory';
export const LOCAL_STORAGE_RSS_URL_KEY = 'aiArticleGenerator_rssUrl';
export const LOCAL_STORAGE_MODEL_KEY = 'aiArticleGenerator_selectedModel';
export const LOCAL_STORAGE_TOPIC_IDEAS_PROMPT_KEY = 'aiArticleGenerator_topicIdeasPrompt';
export const LOCAL_STORAGE_TREND_HISTORY_KEY = 'trendAnalytics_history';
// New Keys for Product Feed
export const LOCAL_STORAGE_PRODUCT_FEED_URL_KEY = 'aiArticleGenerator_productFeedUrl';
export const LOCAL_STORAGE_PRODUCT_FEED_DATA_KEY = 'aiArticleGenerator_productFeedData';
export const LOCAL_STORAGE_PRODUCT_COUNTS_KEY = 'aiArticleGenerator_productCounts';
export const LOCAL_STORAGE_USE_FEED_MODE_KEY = 'aiArticleGenerator_useFeedMode';
export const LOCAL_STORAGE_FEED_BATCH_SIZE_KEY = 'aiArticleGenerator_feedBatchSize';
export const LOCAL_STORAGE_AUTO_SWITCH_KEY = 'aiArticleGenerator_autoSwitchModels';

// Backup
export const BACKUP_FILE_VERSION = '1.1'; // Bumped version
export const BACKUP_FILE_NAME_PREFIX = 'stroy_ai_project_data';

// Default values
export const DEFAULT_RSS_URL = 'https://stroy-materiali-24.ru/blogs/blog.atom';
export const DEFAULT_PRODUCT_FEED_URL = 'https://stroy-materiali-24.ru/marketplace/101282.xml';

export const AVAILABLE_MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Максимальный интеллект + Thinking)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Новый стандарт скорости)' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Стабильная версия)' },
    { id: 'gemini-flash-lite-latest', name: 'Gemini 2.0 Flash Lite (Мгновенная и экономная)' }
];

export const DEFAULT_MODEL = 'gemini-3-flash-preview';

export const DEFAULT_SYSTEM_INSTRUCTIONS = `Роль: Ты — Ведущий SEO-стратег и Главный редактор портала Stroy-Materiali-24.ru. Твой опыт — 15 лет в контент-маркетинге строительных материалов.

ТВОЯ ЦЕЛЬ: Создать экспертный контент, который вытеснит конкурентов из ТОП-3 выдачи Яндекса и Google, и конвертирует читателя в покупателя.

КОНТЕКСТ САЙТА:
Ты пишешь для блога интернет-магазина, который продает строительные материалы. Тон должен быть экспертным, но доверительным ("от прораба к прорабу" или "от эксперта к домовладельцу").

СТРУКТУРА СТАТЬИ (СТРОГО):
1. H1: Кликабельный, содержит основной ключ. (Пример: "Как выбрать утеплитель: Полный гид 2025")
2. Лид (Введение): Боли читателя -> Решение -> Что будет в статье.
3. Основной контент (H2, H3):
   - Максимум пользы, минимум воды.
   - Таблицы характеристик (обязательно сравнительные).
   - Списки (маркированные для преимуществ, нумерованные для инструкций).
   - Блоки "Совет эксперта" (выделенные визуально).
4. FAQ блок: 3-5 частых вопросов с краткими ответами (для сниппетов).
5. Заключение + CTA: Мягкий призыв купить материалы в интернет-магазине <a href="https://stroy-materiali-24.ru">Stroy-Materiali-24.ru</a>. Телефон: +79261637507.

SEO ТРЕБОВАНИЯ:
- LSI-фразы: использовать синонимы, профессиональный сленг.
- Читабельность: Абзацы не более 4-5 строк.
- Перелинковка: Если уместно, упоминай категории товаров (утеплители, смеси, инструменты).
- ОБЯЗАТЕЛЬНО: В тексте статьи (лучше всего в первом абзаце или в призыве к действию) должна быть активная HTML-ссылка на главную страницу: <a href="https://stroy-materiali-24.ru">Stroy-Materiali-24.ru</a>.

ВАЖНО: Если предоставлен контекст существующих статей (RSS), ты ЗАПРЕЩАЕШЬ себе повторять их темы. Ты ищешь "Голубой океан" — темы, которые еще не раскрыты на сайте, но важны для ЦА.`;

// Generation settings
export const MAX_ARTICLE_GENERATION_ATTEMPTS = 3;
