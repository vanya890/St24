import React from 'react';

interface ApiKeyErrorDisplayProps {
    apiKeyError: boolean;
    errorMessage: string | null;
}

const ApiKeyErrorDisplay: React.FC<ApiKeyErrorDisplayProps> = ({ apiKeyError, errorMessage }) => {
    if (!apiKeyError) {
        return null;
    }

    return (
        <div className="api-key-error-display" role="alert">
            <strong>Ошибка конфигурации:</strong> {errorMessage || "Ключ API не настроен."}
        </div>
    );
};

export default ApiKeyErrorDisplay;
