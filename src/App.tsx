
import React, { useState } from 'react';
import {
    GenerationSettings,
    ExistingContentContext,
    GeneratedArticles,
    HistoryDisplay
} from './components';
import TrendDashboard from './components/TrendsAnalysis/TrendDashboard';
import ProductDashboard from './components/ProductDashboard';
import PromoDashboard from './components/PromoGenerator/PromoDashboard';
import DataPersistenceControl from './components/DataPersistenceControl';
import CloudStorageControl from './components/CloudStorageControl';
import { useArticleGenerator } from './hooks/useArticleGenerator';

type TabType = 'generator' | 'trends' | 'products' | 'promo';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('generator');
    const {
        topicsInput,
        setTopicsInput,
        systemInstructionsInput,
        setSystemInstructionsInput,
        existingContentContext,
        setExistingContentContext,
        useWebSearch,
        setUseWebSearch,
        numTopicIdeas,
        setNumTopicIdeas,
        topicIdeasPrompt,
        setTopicIdeasPrompt,
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
        rssUrl,
        setRssUrl,
        handleAnalyzeRss,
        isAnalyzingRss,
        rssFeedData,
        rssAnalysisError,
        selectedModel,
        setSelectedModel,
        autoSwitchModels,
        setAutoSwitchModels,
        // Product Feed Props
        productFeedUrl, setProductFeedUrl,
        productFeedData,
        handleLoadProductFeed,
        handleFileUploadProductFeed,
        isAnalyzingFeed,
        feedAnalysisError,
        useFeedMode, setUseFeedMode,
        feedBatchSize, setFeedBatchSize, // New Props
        productGenerationCounts,
        feedDownloadProgress
    } = useArticleGenerator();

    return (
        <>
            <header>
                <div className="container header-container">
                    <h1 className="header-title">Аналитическая Платформа Stroy-Materiali-24.ru</h1>
                    
                    <div className="header-controls">
                        <CloudStorageControl />
                        <div className="header-divider"></div>
                        <DataPersistenceControl />
                    </div>
                </div>
            </header>
            
            <nav className="tabs-navigation">
                <button 
                    className={`tab-button ${activeTab === 'generator' ? 'active' : ''}`}
                    onClick={() => setActiveTab('generator')}
                >
                    📝 Генератор
                </button>
                <button 
                    className={`tab-button ${activeTab === 'products' ? 'active' : ''}`}
                    onClick={() => setActiveTab('products')}
                >
                    📦 Товары (Feed)
                </button>
                <button 
                    className={`tab-button ${activeTab === 'promo' ? 'active' : ''}`}
                    onClick={() => setActiveTab('promo')}
                >
                    🎨 Промо-Студия
                </button>
                <button 
                    className={`tab-button ${activeTab === 'trends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trends')}
                >
                    📊 Тренды
                </button>
            </nav>

            <div className="container">
                <main>
                    {activeTab === 'generator' && (
                        <div className="columns-container">
                            <div className="input-column">
                                <GenerationSettings
                                    topicsInput={topicsInput}
                                    setTopicsInput={setTopicsInput}
                                    systemInstructionsInput={systemInstructionsInput}
                                    setSystemInstructionsInput={setSystemInstructionsInput}
                                    handleGenerateArticles={handleGenerateArticles}
                                    handleCancelGeneration={handleCancelGeneration}
                                    isLoading={isLoading}
                                    isDownloading={isDownloading}
                                    apiKeyError={apiKeyError}
                                    apiErrorMessage={apiErrorMessage}
                                    numTopicIdeas={numTopicIdeas}
                                    setNumTopicIdeas={setNumTopicIdeas}
                                    topicIdeasPrompt={topicIdeasPrompt}
                                    setTopicIdeasPrompt={setTopicIdeasPrompt}
                                    handleGenerateTopicIdeas={handleGenerateTopicIdeas}
                                    isGeneratingIdeas={isGeneratingIdeas}
                                    useWebSearch={useWebSearch}
                                    setUseWebSearch={setUseWebSearch}
                                    rssUrl={rssUrl}
                                    setRssUrl={setRssUrl}
                                    handleAnalyzeRss={handleAnalyzeRss}
                                    isAnalyzingRss={isAnalyzingRss}
                                    rssFeedData={rssFeedData}
                                    rssAnalysisError={rssAnalysisError}
                                    selectedModel={selectedModel}
                                    setSelectedModel={setSelectedModel}
                                    autoSwitchModels={autoSwitchModels}
                                    setAutoSwitchModels={setAutoSwitchModels}
                                    // Feed props
                                    useFeedMode={useFeedMode}
                                    setUseFeedMode={setUseFeedMode}
                                    productFeedData={productFeedData}
                                    feedBatchSize={feedBatchSize}
                                    setFeedBatchSize={setFeedBatchSize}
                                />
                                <ExistingContentContext
                                    existingContentInput={existingContentContext}
                                    setExistingContentInput={setExistingContentContext}
                                    isLoading={isLoading || isGeneratingIdeas || isAnalyzingRss || isAnalyzingFeed}
                                    isDownloading={isDownloading}
                                    apiKeyError={apiKeyError}
                                />
                            </div>
                            <div className="output-column">
                                <GeneratedArticles
                                    generatedArticles={generatedArticles}
                                    toggleGeneratedArticleExpansion={toggleGeneratedArticleExpansion}
                                    handleDownloadAllArticles={handleDownloadAllArticles}
                                    isLoading={isLoading}
                                    isDownloading={isDownloading}
                                    error={error}
                                    onDismissError={dismissError}
                                    apiKeyError={apiKeyError}
                                    currentGeneratingTopic={currentGeneratingTopic}
                                    streamingArticleContent={streamingArticleContent}
                                    currentSearchCitations={currentSearchCitations}
                                    generationProgress={generationProgress}
                                />
                                <HistoryDisplay
                                    generationHistory={generationHistory}
                                    toggleHistoryArticleExpansion={toggleHistoryArticleExpansion}
                                />
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'products' && (
                        <ProductDashboard 
                            feedData={productFeedData}
                            generationCounts={productGenerationCounts}
                            feedUrl={productFeedUrl}
                            setFeedUrl={setProductFeedUrl}
                            onLoadFeed={handleLoadProductFeed}
                            onFileUpload={handleFileUploadProductFeed}
                            isLoading={isAnalyzingFeed}
                            error={feedAnalysisError}
                            downloadProgress={feedDownloadProgress}
                        />
                    )}

                    {activeTab === 'promo' && (
                        <PromoDashboard feedData={productFeedData} />
                    )}

                    {activeTab === 'trends' && (
                        <TrendDashboard />
                    )}
                </main>
            </div>
            <footer>
                <p>&copy; {new Date().getFullYear()} Stroy-Materiali-24.ru Hub. Все права защищены.</p>
            </footer>
        </>
    );
};

export default App;
