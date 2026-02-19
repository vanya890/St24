
export interface GroundingChunkWeb {
    uri?: string;
    title?: string;
}
export interface GroundingChunk {
    web?: GroundingChunkWeb;
}

export interface Article {
    topic: string;
    content: string; 
    isExpanded: boolean;
    searchCitations?: GroundingChunk[];
    relatedProductId?: string; // ID товара, если статья о товаре
}

export interface ArticleLink {
    title: string;
    url: string;
}

export interface HistoryEntry {
    id: string;
    topics: string[];
    systemInstructions: string;
    existingContentContext?: string; 
    articles: Article[];
    timestamp: Date;
    wasWebSearchUsed?: boolean;
    mode?: 'manual' | 'feed';
}

export interface RssItem {
    title: string;
    link: string;
    description: string;
    pubDate?: string;
}

export interface RssFeedData {
    title: string;
    description: string;
    items: RssItem[];
    url: string;
}

// --- НОВЫЕ ТИПЫ ДЛЯ АНАЛИТИКИ v2.0 ---

export type TimeRange = '24h' | '7d' | '30d' | '90d';

export interface TrendMathMetrics {
    growthProbability: number; // 0.0 - 1.0
    volatilityIndex: number; // 0 - 10
    demandScore: number; // 0 - 100
    trustScore: number; // 0.0 - 1.0 (Достоверность данных)
}

export interface TrendEvent {
    date: string;
    title: string;
    impact: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    sourceUrl?: string;
    sourceCredibility: 'high' | 'medium' | 'low'; // Фильтр источников
}

export interface TrendDataPoint {
    id?: string; // Уникальный ID для БД
    label: string; // Название товара
    category: string; // Категория товара
    value: number; // Индекс спроса
    description?: string;
    change?: string;
    metrics: TrendMathMetrics;
    timestamp: string; // Дата записи
}

export interface TrendAnalysisResult {
    query: string;
    timestamp: Date;
    timeRange: TimeRange;
    marketSummary: string;
    mathAnalysisSummary: string;
    dataPoints: TrendDataPoint[];
    events: TrendEvent[];
    recommendations: string[];
    rawSources?: string[];
}

// Элемент истории для накопительного анализа
export interface TrendHistoryItem {
    id: string;
    date: string;
    result: TrendAnalysisResult;
}

// --- ТИПЫ ДЛЯ ТОВАРНОГО ФИДА (YML) ---

export interface ProductOffer {
    id: string;
    name: string;
    url: string;
    price: string;
    currencyId: string;
    categoryId: string;
    picture?: string;
    description?: string;
    vendor?: string;
    available: boolean;
}

export interface ProductCategory {
    id: string;
    parentId?: string;
    name: string;
}

export interface ProductFeedData {
    shopName: string;
    company: string;
    url: string;
    date: string;
    currencies: string[];
    categories: ProductCategory[];
    offers: ProductOffer[];
}

// Словарь счетчиков генераций: { "productId": количество_статей }
export type ProductGenerationCounts = Record<string, number>;
