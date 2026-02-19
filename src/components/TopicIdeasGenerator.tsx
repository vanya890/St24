
import React from 'react';

interface TopicIdeasGeneratorProps {
    numTopicIdeas: number;
    setNumTopicIdeas: (value: number) => void;
    topicIdeasPrompt: string;
    setTopicIdeasPrompt: (value: string) => void;
    handleGenerateTopicIdeas: () => void;
    isGeneratingIdeas: boolean;
    isAnyMajorOperationInProgress: boolean;
    apiKeyError: boolean;
}

const TopicIdeasGenerator: React.FC<TopicIdeasGeneratorProps> = ({
    numTopicIdeas,
    setNumTopicIdeas,
    topicIdeasPrompt,
    setTopicIdeasPrompt,
    handleGenerateTopicIdeas,
    isGeneratingIdeas,
    isAnyMajorOperationInProgress,
    apiKeyError,
}) => {
    return (
        <div className="form-group topic-ideas-section">
            <label htmlFor="topic-ideas-prompt">Генерация Идей Тем</label>
            
            <textarea
                id="topic-ideas-prompt"
                value={topicIdeasPrompt}
                onChange={(e) => setTopicIdeasPrompt(e.target.value)}
                placeholder="Например: тренды 2025, ошибки при ремонте, обзор новинок..."
                rows={2}
                style={{ 
                    width: '100%', 
                    marginBottom: '10px', 
                    padding: '8px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px', 
                    fontSize: '0.95em',
                    resize: 'vertical'
                }}
                disabled={isAnyMajorOperationInProgress || apiKeyError}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <input
                    type="number"
                    id="num-topic-ideas-input"
                    value={numTopicIdeas}
                    onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setNumTopicIdeas(val > 0 ? val : 1);
                    }}
                    min="1"
                    style={{ width: '80px', padding: '10px' }}
                    disabled={isAnyMajorOperationInProgress || apiKeyError}
                    aria-label="Количество идей для генерации"
                />
                <button
                    onClick={handleGenerateTopicIdeas}
                    disabled={isAnyMajorOperationInProgress || apiKeyError || numTopicIdeas <= 0}
                    aria-busy={isGeneratingIdeas}
                    style={{ flexGrow: 1 }}
                >
                    {isGeneratingIdeas && <span className="loading-spinner" aria-hidden="true"></span>}
                    {isGeneratingIdeas ? 'Генерация идей...' : 'Сгенерировать Идеи Тем'}
                </button>
            </div>
            <small>Идеи будут добавлены в поле "Темы" ниже. Вы можете указать общую тематику в поле выше для более релевантных идей.</small>
        </div>
    );
};

export default TopicIdeasGenerator;
