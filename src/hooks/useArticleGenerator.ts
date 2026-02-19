
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Article, HistoryEntry, GroundingChunk, RssFeedData, ProductFeedData, ProductGenerationCounts, ProductOffer, ArticleLink } from '../types';
import { slugify } from '../utils/slugify';
import { downloadArticlesAsZip } from '../services/zipService';
import { generateArticleStreamWithRetries, generateTopicIdeasWithRetries } from '../services/geminiService';
import { fetchAndParseRss } from '../services/rssService';
import { fetchAndParseYmlFeed, parseYmlContent } from '../services/xmlParser';
import { useLocalStorage } from './useLocalStorage';
import { cleanGeneratedHtml } from '../utils/htmlUtils';
import {
    LOCAL_STORAGE_TOPICS_KEY,
    LOCAL_STORAGE_SYSTEM_INSTRUCTIONS_KEY,
    LOCAL_STORAGE_EXISTING_CONTENT_KEY,
    LOCAL_STORAGE_USE_WEB_SEARCH_KEY,
    LOCAL_STORAGE_NUM_TOPIC_IDEAS_KEY,
    LOCAL_STORAGE_HISTORY_KEY,
    LOCAL_STORAGE_RSS_URL_KEY,
    LOCAL_STORAGE_MODEL_KEY,
    LOCAL_STORAGE_TOPIC_IDEAS_PROMPT_KEY,
    LOCAL_STORAGE_PRODUCT_FEED_URL_KEY,
    LOCAL_STORAGE_PRODUCT_FEED_DATA_KEY,
    LOCAL_STORAGE_PRODUCT_COUNTS_KEY,
    LOCAL_STORAGE_USE_FEED_MODE_KEY,
    LOCAL_STORAGE_FEED_BATCH_SIZE_KEY,
    LOCAL_STORAGE_AUTO_SWITCH_KEY,
    DEFAULT_SYSTEM_INSTRUCTIONS,
    DEFAULT_RSS_URL,
    DEFAULT_PRODUCT_FEED_URL,
    DEFAULT_MODEL,
    AVAILABLE_MODELS,
    MAX_ARTICLE_GENERATION_ATTEMPTS
} from '../constants';

export const useArticleGenerator = () => {
    const [aiInstance, setAiInstance] = useState<GoogleGenAI | null>(null);
    const [apiKeyError, setApiKeyError] = useState<boolean>(false);
    const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

    // Inputs managed by LocalStorage
    const [topicsInput, setTopicsInput] = useLocalStorage<string>(LOCAL_STORAGE_TOPICS_KEY, '');
    const [systemInstructionsInput, setSystemInstructionsInput] = useLocalStorage<string>(LOCAL_STORAGE_SYSTEM_INSTRUCTIONS_KEY, DEFAULT_SYSTEM_INSTRUCTIONS);
    const [existingContentContext, setExistingContentContext] = useLocalStorage<string>(LOCAL_STORAGE_EXISTING_CONTENT_KEY, '');
    const [useWebSearch, setUseWebSearch] = useLocalStorage<boolean>(LOCAL_STORAGE_USE_WEB_SEARCH_KEY, false);
    const [numTopicIdeas, setNumTopicIdeas] = useLocalStorage<number>(LOCAL_STORAGE_NUM_TOPIC_IDEAS_KEY, 3);
    const [topicIdeasPrompt, setTopicIdeasPrompt] = useLocalStorage<string>(LOCAL_STORAGE_TOPIC_IDEAS_PROMPT_KEY, '');
    const [generationHistory, setGenerationHistory] = useLocalStorage<HistoryEntry[]>(LOCAL_STORAGE_HISTORY_KEY, []);
    
    // RSS State
    const [rssUrl, setRssUrl] = useLocalStorage<string>(LOCAL_STORAGE_RSS_URL_KEY, DEFAULT_RSS_URL);
    const [rssFeedData, setRssFeedData] = useState<RssFeedData | null>(null);
    const [isAnalyzingRss, setIsAnalyzingRss] = useState<boolean>(false);
    const [rssAnalysisError, setRssAnalysisError] = useState<string | null>(null);

    // PRODUCT FEED STATE (YML)
    const [productFeedUrl, setProductFeedUrl] = useLocalStorage<string>(LOCAL_STORAGE_PRODUCT_FEED_URL_KEY, DEFAULT_PRODUCT_FEED_URL);
    const [productFeedData, setProductFeedData] = useLocalStorage<ProductFeedData | null>(LOCAL_STORAGE_PRODUCT_FEED_DATA_KEY, null);
    const [productGenerationCounts, setProductGenerationCounts] = useLocalStorage<ProductGenerationCounts>(LOCAL_STORAGE_PRODUCT_COUNTS_KEY, {});
    const [useFeedMode, setUseFeedMode] = useLocalStorage<boolean>(LOCAL_STORAGE_USE_FEED_MODE_KEY, false);
    const [feedBatchSize, setFeedBatchSize] = useLocalStorage<number>(LOCAL_STORAGE_FEED_BATCH_SIZE_KEY, 5); // Default 5 articles
    const [isAnalyzingFeed, setIsAnalyzingFeed] = useState<boolean>(false);
    const [feedAnalysisError, setFeedAnalysisError] = useState<string | null>(null);
    // NEW: Feed Download Progress
    const [feedDownloadProgress, setFeedDownloadProgress] = useState<{percent: number, loaded: number, total: number | null} | null>(null);

    // Model State
    const [selectedModel, setSelectedModel] = useLocalStorage<string>(LOCAL_STORAGE_MODEL_KEY, DEFAULT_MODEL);
    const [autoSwitchModels, setAutoSwitchModels] = useLocalStorage<boolean>(LOCAL_STORAGE_AUTO_SWITCH_KEY, true);

    const [generatedArticles, setGeneratedArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingIdeas, setIsGeneratingIdeas] = useState<boolean>(false);
    
    const [currentGeneratingTopic, setCurrentGeneratingTopic] = useState<string | null>(null);
    const [streamingArticleContent, setStreamingArticleContent] = useState<string>('');
    const [currentSearchCitations, setCurrentSearchCitations] = useState<GroundingChunk[]>([]);
    
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });

    // --- Validation Effect for Model ---
    // Если в localStorage записана модель, которой нет в списке (например, старая версия), сбрасываем на дефолтную
    useEffect(() => {
        const isModelValid = AVAILABLE_MODELS.some(m => m.id === selectedModel);
        if (!isModelValid) {
            console.warn(`Model ${selectedModel} is deprecated or invalid. Resetting to ${DEFAULT_MODEL}.`);
            setSelectedModel(DEFAULT_MODEL);
        }
    }, [selectedModel, setSelectedModel]);

    useEffect(() => {
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                console.error("API_KEY is not defined.");
                setApiKeyError(true);
                setApiErrorMessage(`Ключ API (API_KEY) не найден.`);
                setError("Критическая ошибка: Ключ API не настроен.");
                return;
            }
            const ai = new GoogleGenAI({ apiKey });
            setAiInstance(ai);
            setApiKeyError(false);
            setApiErrorMessage(null);
        } catch (e: any) {
            console.error("Initialization Error:", e);
            setApiKeyError(true);
            setApiErrorMessage(`Ошибка инициализации: ${e.message}.`);
            setError(`Критическая ошибка: ${e.message}`);
        }
    }, []);

    const dismissError = () => setError(null);

    // RSS Handler
    const handleAnalyzeRss = async () => {
        if (!rssUrl) return;
        setIsAnalyzingRss(true);
        setRssAnalysisError(null);
        setRssFeedData(null);
        try {
            const data = await fetchAndParseRss(rssUrl);
            setRssFeedData(data);
            const titlesList = data.items.map(item => `- ${item.title}`).join('\n');
            setExistingContentContext(prev => {
                if (!prev) return titlesList;
                if (data.items.length > 0 && prev.includes(data.items[0].title)) return prev;
                return prev + "\n" + titlesList;
            });
        } catch (e: any) {
            setRssAnalysisError(e.message);
        } finally {
            setIsAnalyzingRss(false);
        }
    };

    // Product Feed Handler (YML via URL)
    const handleLoadProductFeed = async () => {
        if (!productFeedUrl) return;
        setIsAnalyzingFeed(true);
        setFeedAnalysisError(null);
        setFeedDownloadProgress({ percent: 0, loaded: 0, total: null });
        
        try {
            const data = await fetchAndParseYmlFeed(productFeedUrl, (percent, loaded, total) => {
                setFeedDownloadProgress({ percent, loaded, total });
            });
            setProductFeedData(data);
        } catch (e: any) {
            setFeedAnalysisError(e.message);
        } finally {
            setIsAnalyzingFeed(false);
            setFeedDownloadProgress(null);
        }
    };

    // Product Feed Handler (File Upload)
    const handleFileUploadProductFeed = async (file: File) => {
        if (!file) return;
        setIsAnalyzingFeed(true);
        setFeedAnalysisError(null);
        setFeedDownloadProgress(null);

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const xmlContent = e.target?.result as string;
                if (!xmlContent) throw new Error("Файл пуст или не удалось прочитать.");
                
                const data = parseYmlContent(xmlContent);
                setProductFeedData(data);
            } catch (err: any) {
                setFeedAnalysisError("Ошибка чтения файла: " + err.message);
            } finally {
                setIsAnalyzingFeed(false);
            }
        };

        reader.onerror = () => {
            setFeedAnalysisError("Ошибка чтения файла.");
            setIsAnalyzingFeed(false);
        };

        reader.readAsText(file);
    };

    const handleGenerateTopicIdeas = async () => {
        if (!aiInstance) return;
        setIsGeneratingIdeas(true);
        setError(null);
        try {
            const ideas = await generateTopicIdeasWithRetries({
                ai: aiInstance,
                numTopicIdeas,
                currentTopicsInput: topicIdeasPrompt,
                systemInstructions: systemInstructionsInput,
                existingContentContext: existingContentContext,
                rssFeedData: rssFeedData,
                modelName: selectedModel
            });
            const newTopics = ideas.join('; ');
            setTopicsInput(prev => prev.trim() ? `${prev.trim()}; ${newTopics}` : newTopics);
        } catch (e: any) {
            setError(`Не удалось сгенерировать идеи: ${e.message}`);
        } finally {
            setIsGeneratingIdeas(false);
        }
    };

    const handleCancelGeneration = useCallback(() => {
        if (abortController) {
            abortController.abort();
        }
    }, [abortController]);

    const handleGenerateArticles = async () => {
        if (!aiInstance) return;
        setError(null);
        setIsLoading(true);
        setGeneratedArticles([]);

        let targets: { topic: string; product?: ProductOffer }[] = [];

        // --- ЛОГИКА ВЫБОРА ТЕМ ---
        if (useFeedMode && productFeedData) {
            // Режим Фида: ищем товары, о которых мало писали
            const offers = productFeedData.offers.filter(o => o.available);
            
            // Сортируем: сначала те, у кого 0 статей, потом 1 и т.д.
            const sortedOffers = [...offers].sort((a, b) => {
                const countA = productGenerationCounts[a.id] || 0;
                const countB = productGenerationCounts[b.id] || 0;
                return countA - countB;
            });

            // Используем настраиваемое количество статей (feedBatchSize)
            const batchSize = Math.max(1, feedBatchSize);
            const selectedOffers = sortedOffers.slice(0, batchSize);

            if (selectedOffers.length === 0) {
                setError("Фид пуст или нет доступных товаров.");
                setIsLoading(false);
                return;
            }

            // В режиме фида мы НЕ используем жесткие шаблоны.
            // Мы передаем название товара, а креативный H1 придумывает ИИ внутри geminiService.
            targets = selectedOffers.map((offer) => {
                return {
                    topic: offer.name, // Это временное название для UI. Настоящий H1 придумает нейросеть.
                    product: offer
                };
            });

        } else {
            // Ручной режим
            if (!topicsInput.trim()) {
                setError("Введите темы.");
                setIsLoading(false);
                return;
            }
            targets = topicsInput.split(';').map(t => t.trim()).filter(t => t).map(t => ({ topic: t }));
        }

        let successfullyGeneratedArticlesInBatch: Article[] = [];
        // SEO: Массив для хранения ссылок на уже сгенерированные статьи в этом батче
        let sessionGeneratedLinks: ArticleLink[] = [];

        const controller = new AbortController();
        setAbortController(controller);
        setGenerationProgress({ current: 0, total: targets.length });

        // Отслеживаем текущую используемую модель
        let activeModel = selectedModel;

        try {
            for (let i = 0; i < targets.length; i++) {
                const { topic, product } = targets[i];
                if (controller.signal.aborted) break;
                
                setGenerationProgress({ current: i + 1, total: targets.length });
                setCurrentGeneratingTopic(topic);
                
                // Переменные для результата
                let finalHtmlDoc = "";
                let attemptAccumulatedCitations: GroundingChunk[] = [];
                let topicSpecificError: string | null = null;
                
                // --- МОДЕЛЬНАЯ ПЕТЛЯ (Retry Loop with Model Switching) ---
                const triedModelsForThisArticle = new Set<string>();
                let articleSuccess = false;

                while (!articleSuccess && !controller.signal.aborted) {
                    
                    if (triedModelsForThisArticle.has(activeModel)) {
                         if (triedModelsForThisArticle.size >= AVAILABLE_MODELS.length) {
                             topicSpecificError = "Все доступные модели исчерпали лимит или вернули ошибку.";
                             break;
                         }
                    }
                    triedModelsForThisArticle.add(activeModel);

                    let combinedContext = existingContentContext;

                    try {
                        setStreamingArticleContent('');
                        setCurrentSearchCitations([]);
                        let currentAttemptContent = '';
                        let currentAttemptCitationsAccumulator: GroundingChunk[] = [];

                        if (triedModelsForThisArticle.size > 1) {
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        }

                        // ПЕРЕДАЕМ SEO LINKS В СЕРВИС
                        await generateArticleStreamWithRetries({
                            ai: aiInstance,
                            topic, // В режиме фида это название товара
                            systemInstructions: systemInstructionsInput,
                            existingContentContext: combinedContext,
                            useWebSearch: useWebSearch,
                            modelName: activeModel,
                            signal: controller.signal,
                            targetProduct: product, // ПЕРЕДАЕМ ТОВАР
                            previousArticles: sessionGeneratedLinks, // <-- SEO ЧИТ-КОД: Ссылки на предыдущие
                            onChunk: (chunk: GenerateContentResponse) => {
                                const textChunk = chunk.text;
                                if (textChunk) {
                                    currentAttemptContent += textChunk;
                                    setStreamingArticleContent(prev => prev + textChunk);
                                }
                                const newCitations = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter(c => c.web?.uri) ?? [];
                                if (newCitations.length > 0) {
                                    currentAttemptCitationsAccumulator.push(...newCitations);
                                    setCurrentSearchCitations([...currentAttemptCitationsAccumulator]);
                                }
                            },
                        });
                        
                        const fullStreamOutput = currentAttemptContent.trim();
                        const cleanedContent = cleanGeneratedHtml(fullStreamOutput);
                        
                        if (cleanedContent.toLowerCase().includes('<h1') || cleanedContent.toLowerCase().startsWith('<!doctype html') || cleanedContent.toLowerCase().startsWith('<html')) {
                             finalHtmlDoc = cleanedContent;
                             attemptAccumulatedCitations = [...currentAttemptCitationsAccumulator];
                             articleSuccess = true;
                        } else {
                            throw new Error(`Invalid HTML format from model ${activeModel}. Content might be empty or plain text.`);
                        }

                    } catch (e: any) {
                        if (controller.signal.aborted || e.name === 'AbortError') break;
                        
                        const isQuotaError = 
                            e.message?.includes('429') || 
                            e.message?.includes('503') || 
                            e.message?.includes('quota') || 
                            e.message?.includes('exhausted') ||
                            e.message?.includes('Overloaded');
                            
                        const isNotFoundError = e.message?.includes('404') || e.message?.includes('not found');

                        if (autoSwitchModels && (isQuotaError || isNotFoundError)) {
                            const currentModelIndex = AVAILABLE_MODELS.findIndex(m => m.id === activeModel);
                            const nextModelIndex = currentModelIndex === -1 ? 0 : (currentModelIndex + 1) % AVAILABLE_MODELS.length;
                            const nextModel = AVAILABLE_MODELS[nextModelIndex];
                            
                            if (triedModelsForThisArticle.has(nextModel.id)) {
                                topicSpecificError = `Ошибка: ${e.message}. Попробовали все модели, но безуспешно.`;
                                break;
                            }

                            const reason = isNotFoundError ? "Модель не найдена" : "Лимит исчерпан";
                            console.warn(`${activeModel}: ${reason} (${e.message}). Переключение на ${nextModel.name}...`);
                            setError(prev => `${prev ? prev + '\n' : ''}⚠ ${activeModel}: ${reason}. Авто-переключение на ${nextModel.name}...`);
                            
                            activeModel = nextModel.id;
                            setSelectedModel(activeModel);
                            continue;
                        } else {
                            topicSpecificError = `${e.message} (Model: ${activeModel})`;
                            break;
                        }
                    }
                }

                if (finalHtmlDoc) {
                    // Пытаемся извлечь реальный заголовок из H1 для отображения в списке
                    let displayTopic = topic;
                    const h1Match = finalHtmlDoc.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
                    if (h1Match && h1Match[1]) {
                        displayTopic = h1Match[1].replace(/<[^>]*>/g, '').trim(); // Очистка от тегов внутри h1
                    }

                    const newArticle: Article = { 
                        topic: displayTopic, 
                        content: finalHtmlDoc, 
                        isExpanded: false,
                        searchCitations: attemptAccumulatedCitations.length > 0 ? [...attemptAccumulatedCitations] : undefined,
                        relatedProductId: product?.id
                    };
                    
                    setGeneratedArticles(prev => [...prev, newArticle]);
                    successfullyGeneratedArticlesInBatch.push(newArticle);

                    // SEO: Добавляем эту статью в список ссылок для СЛЕДУЮЩИХ статей
                    // Мы используем slugify для создания предполагаемого URL.
                    // На реальном сайте это может быть /blog/slug-name
                    const articleSlug = slugify(displayTopic);
                    sessionGeneratedLinks.push({
                        title: displayTopic,
                        url: `/blog/${articleSlug}` // Относительная ссылка для SEO
                    });

                    // Update Context
                    setExistingContentContext(prev => {
                        const newEntry = `- ${displayTopic}`;
                        if (prev && prev.includes(newEntry)) return prev;
                        const separator = prev ? "\n" : "";
                        return `${prev}${separator}${newEntry}`;
                    });
                    
                    if (product) {
                        setProductGenerationCounts(prev => ({
                            ...prev,
                            [product.id]: (prev[product.id] || 0) + 1
                        }));
                    }

                } else if (!controller.signal.aborted) {
                     setError(prev => `${prev ? prev + '\n' : ''}Ошибка "${topic}": ${topicSpecificError}`);
                }
            }
            
            if (successfullyGeneratedArticlesInBatch.length > 0) {
                const newHistoryEntry: HistoryEntry = {
                    id: Date.now().toString(),
                    topics: successfullyGeneratedArticlesInBatch.map(a => a.topic),
                    systemInstructions: systemInstructionsInput,
                    existingContentContext: existingContentContext,
                    articles: successfullyGeneratedArticlesInBatch,
                    timestamp: new Date(),
                    wasWebSearchUsed: useWebSearch,
                    mode: useFeedMode ? 'feed' : 'manual'
                };
                setGenerationHistory(prev => [newHistoryEntry, ...prev].slice(0, 20));
            }
        } finally {
            setIsLoading(false);
            setCurrentGeneratingTopic(null);
            setStreamingArticleContent('');
            setCurrentSearchCitations([]);
            setAbortController(null);
            setGenerationProgress({ current: 0, total: 0 });
        }
    };

    const toggleGeneratedArticleExpansion = (index: number) => {
        setGeneratedArticles(prev =>
            prev.map((article, i) =>
                i === index ? { ...article, isExpanded: !article.isExpanded } : article
            )
        );
    };

    const toggleHistoryArticleExpansion = (historyEntryId: string, articleIndex: number) => {
        setGenerationHistory(prev =>
            prev.map(entry =>
                entry.id === historyEntryId
                    ? {
                          ...entry,
                          articles: entry.articles.map((article, i) =>
                              i === articleIndex ? { ...article, isExpanded: !article.isExpanded } : article
                          ),
                      }
                    : entry
            )
        );
    };

    const handleDownloadAllArticles = async () => {
        if (generatedArticles.length === 0 || isDownloading) return;
        setIsDownloading(true);
        try {
            await downloadArticlesAsZip(generatedArticles, `articles_${new Date().toISOString().split('T')[0]}.zip`);
        } catch (e: any) {
            console.error(e);
            setError("Ошибка создания ZIP архива: " + e.message);
        } finally {
            setIsDownloading(false);
        }
    };

    return {
        topicsInput, setTopicsInput,
        systemInstructionsInput, setSystemInstructionsInput,
        existingContentContext, setExistingContentContext,
        useWebSearch, setUseWebSearch,
        numTopicIdeas, setNumTopicIdeas,
        topicIdeasPrompt, setTopicIdeasPrompt,
        generatedArticles,
        isLoading,
        isDownloading,
        error,
        generationHistory,
        currentGeneratingTopic,
        streamingArticleContent,
        currentSearchCitations,
        isGeneratingIdeas,
        generationProgress,
        apiKeyError,
        apiErrorMessage,
        dismissError,
        handleGenerateTopicIdeas,
        handleCancelGeneration,
        handleGenerateArticles,
        toggleGeneratedArticleExpansion,
        toggleHistoryArticleExpansion,
        handleDownloadAllArticles,
        // RSS
        rssUrl, setRssUrl,
        handleAnalyzeRss,
        isAnalyzingRss,
        rssFeedData,
        rssAnalysisError,
        // Model
        selectedModel, setSelectedModel,
        autoSwitchModels, setAutoSwitchModels, // Экспорт новых стейтов
        // Product Feed
        productFeedUrl, setProductFeedUrl,
        productFeedData,
        handleLoadProductFeed,
        handleFileUploadProductFeed,
        isAnalyzingFeed,
        feedAnalysisError,
        useFeedMode, setUseFeedMode,
        feedBatchSize, setFeedBatchSize,
        productGenerationCounts,
        feedDownloadProgress
    };
};
