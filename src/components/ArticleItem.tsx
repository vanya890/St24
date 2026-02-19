
import React from 'react';
import type { Article } from '../types'; // Article type now includes searchCitations
import { extractBodyContent } from '../utils/htmlUtils';

interface ArticleItemProps {
    article: Article;
    onToggle: () => void;
    idPrefix: string; 
    itemClassName?: string; 
    headerContent?: React.ReactNode; 
}

const ArticleItem: React.FC<ArticleItemProps> = ({ article, onToggle, idPrefix, itemClassName = "article-item-card", headerContent }) => {
    const contentId = `${idPrefix}-content-${article.topic.replace(/\s+/g, '-')}`;
    const headerId = `${idPrefix}-header-${article.topic.replace(/\s+/g, '-')}`;

    const displayHtml = extractBodyContent(article.content);

    return (
        <article className={itemClassName}>
            <div
                className="article-header"
                onClick={onToggle}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
                role="button"
                tabIndex={0}
                aria-expanded={article.isExpanded}
                aria-controls={contentId}
                id={headerId}
            >
                {headerContent || <h3>{article.topic}</h3>}
                <span className={`toggle-icon ${article.isExpanded ? 'expanded' : ''}`} aria-hidden="true">▶</span>
            </div>
            {article.isExpanded && (
                <>
                    <div 
                        className="article-content-collapsible"
                        id={contentId}
                        role="region"
                        aria-labelledby={headerId}
                        dangerouslySetInnerHTML={{ __html: displayHtml }}
                    />
                    {article.searchCitations && article.searchCitations.length > 0 && (
                        <div className="search-citations">
                            <strong>Источники (Поиск Google):</strong>
                            <ul>
                                {article.searchCitations.map((citation, idx) => (
                                    citation.web && citation.web.uri && ( // Ensure web and uri exist
                                        <li key={`${idPrefix}-cite-${idx}`}>
                                            <a href={citation.web.uri} target="_blank" rel="noopener noreferrer">
                                                {citation.web.title || citation.web.uri}
                                            </a>
                                        </li>
                                    )
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </article>
    );
};

export default ArticleItem;
