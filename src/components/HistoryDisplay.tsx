import React from 'react';
import HistoryItem from './HistoryItem';
import type { HistoryEntry } from '../types';

interface HistoryDisplayProps {
    generationHistory: HistoryEntry[];
    toggleHistoryArticleExpansion: (historyEntryId: string, articleIndex: number) => void;
}

const HistoryDisplay: React.FC<HistoryDisplayProps> = ({ generationHistory, toggleHistoryArticleExpansion }) => {
    return (
        <section className="card" aria-labelledby="history-title">
            <h2 id="history-title">История Генераций</h2>
            {generationHistory.length > 0 ? (
                <div className="history-list">
                    {generationHistory.map(entry => (
                        <HistoryItem
                            key={entry.id}
                            entry={entry}
                            onToggleArticle={toggleHistoryArticleExpansion}
                        />
                    ))}
                </div>
            ) : (
                <p className="no-history-message">История генераций пока пуста.</p>
            )}
        </section>
    );
};

export default HistoryDisplay;
