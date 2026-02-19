
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App'; // Импорт основного компонента App из директории src

const rootElement = document.getElementById('root');

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
} else {
    console.error("Корневой элемент 'root' не найден в документе. Приложение не может быть смонтировано.");
}
