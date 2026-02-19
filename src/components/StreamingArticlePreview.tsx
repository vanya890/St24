import React from 'react';
import type { GroundingChunk } from '../types';
import { extractBodyContent } from '../utils/htmlUtils';

interface StreamingArticlePreviewProps {
    topic: string;
    content: string; // This will be a stream of HTML
    citations: GroundingChunk[];
}

const StreamingArticlePreview: React.FC<StreamingArticlePreviewProps> = ({ topic, content, citations }) => {
    const streamingDisplayHtml = extractBodyContent(content);

    return (
        <div className="streaming-article-preview article-item-card" aria-live="assertive">
            <h3>Сейчас генерируется (HTML): {topic}</h3>
            <div
                className="article-content-collapsible"
                style={{
                    display: 'block',
                    paddingTop: '10px',
                    marginTop: '10px',
                    borderTop: '1px dashed #e0e0e0',
                }}
            >
                <div dangerouslySetInnerHTML={{ __html: streamingDisplayHtml }} />
                <span className="streaming-cursor"></span>
            </div>
            {citations && citations.length > 0 && (
                <div className="search-citations">
                    <strong>Источники (Поиск Google):</strong>
                    <ul>
                        {citations.map((citation, idx) => (
                            citation.web && citation.web.uri && (
                                <li key={`stream-cite-${idx}`}>
                                    <a href={citation.web.uri} target="_blank" rel="noopener noreferrer">
                                        {citation.web.title || citation.web.uri}
                                    </a>
                                </li>
                            )
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default StreamingArticlePreview;
