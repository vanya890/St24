
import React from 'react';
import ArticleItem from './ArticleItem';
import DismissibleError from './DismissibleError';
import StreamingArticlePreview from './StreamingArticlePreview';
import type { Article, GroundingChunk } from '../types';
import { slugify } from '../utils/slugify';

interface GeneratedArticlesProps {
    generatedArticles: Article[];
    toggleGeneratedArticleExpansion: (index: number) => void;
    handleDownloadAllArticles: () => void;
    isLoading: boolean;
    isDownloading: boolean;
    error: string | null;
    onDismissError: () => void;
    apiKeyError: boolean;
    currentGeneratingTopic: string | null;
    streamingArticleContent: string;
    currentSearchCitations: GroundingChunk[];
    generationProgress: { current: number, total: number };
}

const GeneratedArticles: React.FC<GeneratedArticlesProps> = ({
    generatedArticles,
    toggleGeneratedArticleExpansion,
    handleDownloadAllArticles,
    isLoading,
    isDownloading,
    error,
    onDismissError,
    apiKeyError,
    currentGeneratingTopic,
    streamingArticleContent,
    currentSearchCitations,
    generationProgress,
}) => {
    const showOverallInitialLoading = isLoading && !currentGeneratingTopic && generatedArticles.length === 0;

    return (
        <section className="card" aria-labelledby="generated-articles-title">
            <div className="section-header-with-button">
                <h2 id="generated-articles-title">Сгенерированные Статьи</h2>
                <button
                    onClick={handleDownloadAllArticles}
                    disabled={isDownloading || apiKeyError || generatedArticles.length === 0}
                    className="download-button"
                    aria-busy={isDownloading}
                >
                    {isDownloading && <span className="loading-spinner" aria-hidden="true"></span>}
                    {isDownloading ? 'Архивация...' : 'Скачать все в ZIP архиве'}
                </button>
            </div>

            <DismissibleError error={error} onDismiss={onDismissError} />

            {isLoading && generationProgress.total > 0 && (
                <div className="generation-progress" aria-live="polite">
                    <span className="loading-spinner" aria-hidden="true"></span>
                    <span>Генерация статьи: {generationProgress.current} из {generationProgress.total}</span>
                </div>
            )}

            {currentGeneratingTopic && (
                <StreamingArticlePreview
                    topic={currentGeneratingTopic}
                    content={streamingArticleContent}
                    citations={currentSearchCitations}
                />
            )}

            {showOverallInitialLoading && !currentGeneratingTopic && (
                 <p>Подготовка к генерации HTML-статей... <span className="loading-spinner" aria-hidden="true"></span></p>
            )}

            <div className="article-display" aria-live="polite">
                {generatedArticles.length > 0 && generatedArticles.map((article, index) => (
                    <ArticleItem
                        key={`${slugify(article.topic)}-html-${index}`}
                        article={article}
                        onToggle={() => toggleGeneratedArticleExpansion(index)}
                        idPrefix={`gen-html-article-${index}`}
                        itemClassName="article-item-card"
                    />
                ))}
                {!isLoading && !currentGeneratingTopic && generatedArticles.length === 0 && !error && (
                    <p className="no-articles-message">HTML-статьи еще не сгенерированы. Введите темы или используйте Фид и нажмите "Сгенерировать Статьи".</p>
                )}
                 {!isLoading && !currentGeneratingTopic && generatedArticles.length === 0 && error && !error.startsWith("Критическая ошибка:") && (
                    <p className="no-articles-message">Не удалось сгенерировать HTML-статьи. Попробуйте снова или измените параметры.</p>
                )}
            </div>
        </section>
    );
};

export default GeneratedArticles;
