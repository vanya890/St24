import React from 'react';

interface DismissibleErrorProps {
    error: string | null;
    onDismiss: () => void;
}

const DismissibleError: React.FC<DismissibleErrorProps> = ({ error, onDismiss }) => {
    if (!error) {
        return null;
    }

    // Check for specific keywords to apply different styling
    const isDownloadError = error.includes("скачать статью");
    const isCriticalError = error.startsWith("Критическая ошибка:");

    const style: React.CSSProperties = {};
    if (isDownloadError) {
        style.backgroundColor = '#e67e22'; // Orange for non-critical download errors
    }
    if (isCriticalError) {
        style.backgroundColor = '#c0392b'; // Darker red for critical errors
    }


    return (
        <div className="error-message" role="alert" style={style}>
            <span style={{ whiteSpace: 'pre-line', flexGrow: 1 }}>{error}</span>
            <button onClick={onDismiss} className="close-button" aria-label="Закрыть">&times;</button>
        </div>
    );
};

export default DismissibleError;
