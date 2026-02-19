import React from 'react';
import ArticleItem from './ArticleItem';
import type { HistoryEntry } from '../types';
import { slugify } from '../utils/slugify';

interface HistoryItemProps {
    entry: HistoryEntry;
    onToggleArticle: (historyEntryId: string, articleIndex: number) => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ entry, onToggleArticle }) => {
    return (
        <div className="history-item">
            <h4>Сгенерировано: {new Date(entry.timestamp).toLocaleString('ru-RU')}</h4>
            <p className="history-item-meta">
                <strong>Темы (запрос):</strong> {entry.topics.join('; ')}
            </p>
            {entry.systemInstructions && (
                <p className="history-item-meta">
                    <strong>Инструкции:</strong> {entry.systemInstructions}
                </p>
            )}
            {entry.existingContentContext && (
                <details className="history-item-meta">
                    <summary>Использованный контекст для уникальности</summary>
                    <p style={{ whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto', fontSize: '0.9em', backgroundColor: '#f0f0f0', padding: '5px', border: '1px solid #ddd' }}>
                        {entry.existingContentContext}
                    </p>
                </details>
            )}
            {entry.articles.length > 0 ? (
                <details className="history-item-articles-container">
                    <summary>Посмотреть успешно сгенерированные статьи ({entry.articles.length})</summary>
                    <div className="history-articles-list">
                        {entry.articles.map((article, index) => (
                            <ArticleItem
                                key={`${entry.id}-${slugify(article.topic)}-${index}`}
                                article={article}
                                onToggle={() => onToggleArticle(entry.id, index)}
                                idPrefix={`hist-${entry.id}-article-${index}`}
                                itemClassName="history-article-item"
                                headerContent={<strong>{article.topic}</strong>}
                            />
                        ))}
                    </div>
                </details>
            ) : (
                <p className="history-item-meta"><em>Для данного запроса статьи не были успешно сгенерированы.</em></p>
            )}
        </div>
    );
};

export default HistoryItem;
