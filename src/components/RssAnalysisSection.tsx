
import React from 'react';
import { RssFeedData } from '../types';

interface RssAnalysisSectionProps {
    rssUrl: string;
    setRssUrl: (url: string) => void;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    rssFeedData: RssFeedData | null;
    analysisError: string | null;
    disabled: boolean;
}

const RssAnalysisSection: React.FC<RssAnalysisSectionProps> = ({
    rssUrl,
    setRssUrl,
    onAnalyze,
    isAnalyzing,
    rssFeedData,
    analysisError,
    disabled
}) => {
    return (
        <div className="topic-ideas-section rss-section" style={{ border: '1px solid #8e44ad', backgroundColor: '#f4ecf7' }}>
            <label style={{ color: '#8e44ad', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2em' }}>📡</span>
                Авто-Анализ Сайта (RSS/Atom)
            </label>
            <small style={{ marginBottom: '10px' }}>
                Введите URL ленты (Atom/RSS), чтобы ИИ изучил стиль сайта и нашел недостающие темы.
            </small>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <input 
                    type="text" 
                    value={rssUrl}
                    onChange={(e) => setRssUrl(e.target.value)}
                    placeholder="https://site.ru/feed.rss"
                    disabled={disabled || isAnalyzing}
                    style={{ flexGrow: 1, minWidth: '200px' }}
                />
                <button 
                    onClick={onAnalyze}
                    disabled={disabled || isAnalyzing || !rssUrl}
                    style={{ backgroundColor: '#9b59b6', flexGrow: 1, minWidth: '140px' }}
                >
                    {isAnalyzing ? 'Анализ...' : 'Анализировать'}
                </button>
            </div>

            {analysisError && (
                <div style={{ color: '#c0392b', fontSize: '0.9em', marginTop: '5px' }}>
                    Ошибка: {analysisError}
                </div>
            )}

            {rssFeedData && (
                <div className="rss-stats" style={{ marginTop: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '4px', borderLeft: '4px solid #9b59b6' }}>
                    <div style={{ fontWeight: 'bold', color: '#8e44ad' }}>✅ Анализ выполнен успешно</div>
                    <div style={{ fontSize: '0.9em', color: '#555', margin: '5px 0' }}>
                        <strong>Блог:</strong> {rssFeedData.title}<br/>
                        <strong>Изучено статей:</strong> {rssFeedData.items.length}<br/>
                        <strong>Последняя статья:</strong> "{rssFeedData.items[0]?.title}"
                    </div>
                    <div style={{ fontSize: '0.85em', fontStyle: 'italic', color: '#7f8c8d' }}>
                        Теперь ИИ знает, о чем вы уже писали, и предложит новые темы.
                    </div>
                </div>
            )}
        </div>
    );
};

export default RssAnalysisSection;
