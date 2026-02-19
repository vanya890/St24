
import React from 'react';
import ApiKeyErrorDisplay from './ApiKeyErrorDisplay';
import TopicIdeasGenerator from './TopicIdeasGenerator';
import RssAnalysisSection from './RssAnalysisSection';
import { RssFeedData, ProductFeedData } from '../types';
import { AVAILABLE_MODELS } from '../constants';

interface GenerationSettingsProps {
    topicsInput: string;
    setTopicsInput: (value: string) => void;
    systemInstructionsInput: string;
    setSystemInstructionsInput: (value: string) => void;
    handleGenerateArticles: () => void;
    handleCancelGeneration: () => void;
    isLoading: boolean;
    isDownloading: boolean;
    apiKeyError: boolean;
    apiErrorMessage: string | null;
    numTopicIdeas: number;
    setNumTopicIdeas: (value: number) => void;
    topicIdeasPrompt: string;
    setTopicIdeasPrompt: (value: string) => void;
    handleGenerateTopicIdeas: () => void;
    isGeneratingIdeas: boolean;
    useWebSearch: boolean;
    setUseWebSearch: (value: boolean) => void;
    
    // RSS Props
    rssUrl: string;
    setRssUrl: (url: string) => void;
    handleAnalyzeRss: () => void;
    isAnalyzingRss: boolean;
    rssFeedData: RssFeedData | null;
    rssAnalysisError: string | null;

    // Model Props
    selectedModel: string;
    setSelectedModel: (value: string) => void;
    autoSwitchModels: boolean;
    setAutoSwitchModels: (value: boolean) => void;

    // Feed Mode Props
    useFeedMode: boolean;
    setUseFeedMode: (val: boolean) => void;
    productFeedData: ProductFeedData | null;
    feedBatchSize: number;
    setFeedBatchSize: (val: number) => void;
}

const GenerationSettings: React.FC<GenerationSettingsProps> = ({
    topicsInput,
    setTopicsInput,
    systemInstructionsInput,
    setSystemInstructionsInput,
    handleGenerateArticles,
    handleCancelGeneration,
    isLoading,
    isDownloading,
    apiKeyError,
    apiErrorMessage,
    numTopicIdeas,
    setNumTopicIdeas,
    topicIdeasPrompt,
    setTopicIdeasPrompt,
    handleGenerateTopicIdeas,
    isGeneratingIdeas,
    useWebSearch,
    setUseWebSearch,
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
    useFeedMode,
    setUseFeedMode,
    productFeedData,
    feedBatchSize,
    setFeedBatchSize
}) => {
    const isAnyMajorOperationInProgress = isLoading || isDownloading || isGeneratingIdeas || isAnalyzingRss;
    const isControlDisabled = (isDownloading || isGeneratingIdeas || isAnalyzingRss) || apiKeyError;

    return (
        <section className="card" aria-labelledby="generation-settings-title">
            <h2 id="generation-settings-title">Настройки Генерации v24.0</h2>
            <ApiKeyErrorDisplay apiKeyError={apiKeyError} errorMessage={apiErrorMessage} />

            <div className="form-group">
                <label htmlFor="model-select">Модель ИИ</label>
                <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isControlDisabled}
                    style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '1em',
                        backgroundColor: '#fff',
                        cursor: isControlDisabled ? 'not-allowed' : 'pointer'
                    }}
                >
                    {AVAILABLE_MODELS.map(model => (
                        <option key={model.id} value={model.id}>
                            {model.name}
                        </option>
                    ))}
                </select>
                
                {/* Auto Switch Checkbox */}
                <div style={{ marginTop: '10px' }}>
                    <label 
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            cursor: isControlDisabled ? 'not-allowed' : 'pointer',
                            fontSize: '0.9em',
                            color: '#4a5568'
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={autoSwitchModels}
                            onChange={(e) => setAutoSwitchModels(e.target.checked)}
                            disabled={isControlDisabled}
                        />
                        🔄 Автопереключение моделей при ошибках лимитов (Quota/429)
                    </label>
                </div>

                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                    Если текущая модель перегрузится, система автоматически попробует следующую из списка, чтобы не останавливать генерацию.
                </small>
            </div>

            {/* FEED MODE TOGGLE */}
            <div className="form-group" style={{ 
                backgroundColor: useFeedMode ? '#e8f8f5' : '#f9f9f9', 
                padding: '15px', 
                borderRadius: '8px',
                border: useFeedMode ? '1px solid #2ecc71' : '1px solid #eee'
            }}>
                <label 
                    htmlFor="feed-mode-toggle" 
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '1.1em', color: '#2c3e50' }}
                >
                    <input 
                        type="checkbox" 
                        id="feed-mode-toggle"
                        checked={useFeedMode}
                        onChange={(e) => setUseFeedMode(e.target.checked)}
                        disabled={isControlDisabled}
                    />
                    🛍️ Режим "Генерация по Фиду"
                </label>
                <p style={{ fontSize: '0.9em', color: '#666', marginTop: '5px', marginLeft: '25px' }}>
                    Если включено, ИИ будет автоматически брать товары из загруженного фида (о которых еще не писал), знать их цену и <strong>вставлять ссылку на товар</strong>. Поле "Темы" игнорируется.
                </p>
                {useFeedMode && (
                    <div style={{ marginLeft: '25px', marginTop: '15px' }}>
                        <label htmlFor="feed-batch-size" style={{ display: 'block', marginBottom: '5px', fontWeight: 600 }}>Количество статей за один запуск:</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                                type="number" 
                                id="feed-batch-size"
                                value={feedBatchSize}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setFeedBatchSize(val > 0 ? val : 1);
                                }}
                                min="1"
                                max="20"
                                style={{ width: '80px', padding: '8px' }}
                                disabled={isControlDisabled}
                            />
                            <span style={{ fontSize: '0.9em', color: '#666' }}>шт.</span>
                        </div>
                        <small style={{ color: '#7f8c8d' }}>ИИ выберет товары, для которых еще не было создано статей.</small>
                    </div>
                )}
                
                {useFeedMode && !productFeedData && (
                    <div style={{ color: '#c0392b', fontWeight: 'bold', marginTop: '10px', marginLeft: '25px' }}>
                        ⚠ Фид не загружен! Перейдите во вкладку "Товары" и загрузите XML.
                    </div>
                )}
                {useFeedMode && productFeedData && (
                    <div style={{ color: '#27ae60', marginTop: '10px', marginLeft: '25px', fontSize: '0.9em' }}>
                        ✅ Фид активен: {productFeedData.offers.length} товаров.
                    </div>
                )}
            </div>

            {!useFeedMode && (
                <>
                    <RssAnalysisSection 
                        rssUrl={rssUrl}
                        setRssUrl={setRssUrl}
                        onAnalyze={handleAnalyzeRss}
                        isAnalyzing={isAnalyzingRss}
                        rssFeedData={rssFeedData}
                        analysisError={rssAnalysisError}
                        disabled={isControlDisabled}
                    />

                    <TopicIdeasGenerator
                        numTopicIdeas={numTopicIdeas}
                        setNumTopicIdeas={setNumTopicIdeas}
                        topicIdeasPrompt={topicIdeasPrompt}
                        setTopicIdeasPrompt={setTopicIdeasPrompt}
                        handleGenerateTopicIdeas={handleGenerateTopicIdeas}
                        isGeneratingIdeas={isGeneratingIdeas}
                        isAnyMajorOperationInProgress={isAnyMajorOperationInProgress}
                        apiKeyError={apiKeyError}
                    />

                    <div className="form-group">
                        <label htmlFor="topics-input">Темы (разделяйте точкой с запятой)</label>
                        <textarea
                            id="topics-input"
                            value={topicsInput}
                            onChange={(e) => setTopicsInput(e.target.value)}
                            placeholder="Например: Гидроизоляция фундамента; Виды кровельных материалов"
                            rows={4}
                            aria-required="true"
                            disabled={isAnyMajorOperationInProgress || apiKeyError}
                        />
                    </div>
                </>
            )}
            
            <details className="form-group" style={{ marginBottom: '20px' }}>
                <summary style={{ cursor: 'pointer', color: '#4a5568', fontWeight: 600 }}>Редактировать Системные Инструкции</summary>
                <textarea
                    id="system-instructions-input"
                    value={systemInstructionsInput}
                    onChange={(e) => setSystemInstructionsInput(e.target.value)}
                    placeholder="Инструкции для ИИ..."
                    rows={6}
                    style={{ marginTop: '10px' }}
                    disabled={isAnyMajorOperationInProgress || apiKeyError}
                />
            </details>

            <div className="form-group">
                <label
                    htmlFor="use-web-search-checkbox"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 'normal',
                        cursor: isControlDisabled ? 'not-allowed' : 'pointer'
                    }}
                >
                    <input
                        type="checkbox"
                        id="use-web-search-checkbox"
                        checked={useWebSearch}
                        onChange={(e) => setUseWebSearch(e.target.checked)}
                        disabled={isControlDisabled}
                    />
                    Использовать Google Search (Актуальные данные)
                </label>
            </div>

            <button
                onClick={isLoading ? handleCancelGeneration : handleGenerateArticles}
                disabled={!isLoading && (isControlDisabled || (!useFeedMode && !topicsInput.trim()) || (useFeedMode && !productFeedData))}
                aria-busy={isLoading}
                className={isLoading ? 'cancel-button' : ''}
            >
                {isLoading ? (
                    <>
                        <span className="stop-icon" aria-hidden="true">■</span>
                        <span>Остановить</span>
                    </>
                ) : useFeedMode ? '🚀 Запустить Авто-Генерацию (Фид)' : 'Сгенерировать Статьи'}
            </button>
        </section>
    );
};

export default GenerationSettings;
