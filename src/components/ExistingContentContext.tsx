
import React from 'react';

interface ExistingContentContextProps {
    existingContentInput: string;
    setExistingContentInput: (value: string) => void;
    isLoading: boolean; // Covers article generation and topic idea generation
    isDownloading: boolean;
    apiKeyError: boolean;
}

const ExistingContentContext: React.FC<ExistingContentContextProps> = ({
    existingContentInput,
    setExistingContentInput,
    isLoading, // This prop now indicates if *any* generation is happening (articles or ideas)
    isDownloading,
    apiKeyError,
}) => {
    const isDisabled = isLoading || isDownloading || apiKeyError;

    return (
        <section className="card" aria-labelledby="existing-content-title">
            <h2 id="existing-content-title">Контекст для Уникальности</h2>
            <div className="form-group">
                <label htmlFor="existing-content-input">Вставьте существующие статьи (для избежания повторов)</label>
                <textarea
                    id="existing-content-input"
                    value={existingContentInput}
                    onChange={(e) => setExistingContentInput(e.target.value)}
                    placeholder="Вставьте сюда текст уже существующих статей. ИИ постарается создать новый контент, отличающийся от этого."
                    rows={8}
                    disabled={isDisabled}
                />
            </div>
        </section>
    );
};

export default ExistingContentContext;
