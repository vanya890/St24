
import React, { useState } from 'react';
import { saveProjectToFile, loadProjectFromFile } from '../services/backupService';

const DataPersistenceControl: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'saving' | 'loading' | 'success' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');

    const handleSave = async () => {
        setStatus('saving');
        try {
            await saveProjectToFile();
            setStatus('success');
            setStatusMsg('Проект сохранен!');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (e: any) {
            setStatus('error');
            setStatusMsg('Ошибка сохранения');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const handleLoad = async () => {
        setStatus('loading');
        try {
            const success = await loadProjectFromFile();
            if (success) {
                setStatus('success');
                setStatusMsg('Данные успешно загружены!');
                setTimeout(() => {
                    setStatus('idle');
                    setStatusMsg('');
                }, 3000);
            } else {
                setStatus('idle');
            }
        } catch (e: any) {
            setStatus('error');
            setStatusMsg('Ошибка: ' + e.message);
            setTimeout(() => setStatus('idle'), 4000);
        }
    };

    return (
        <div className="data-persistence-control">
            <span style={{ color: '#ecf0f1', fontWeight: 500, marginRight: '5px' }}>
                📂 База Данных Проекта:
            </span>
            
            <button 
                onClick={handleSave} 
                disabled={status !== 'idle' && status !== 'success'}
                style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                }}
                title="Сохранить весь прогресс (историю, настройки, тренды) в файл на диск"
            >
                💾 Сохранить на диск
            </button>

            <button 
                onClick={handleLoad} 
                disabled={status !== 'idle' && status !== 'success'}
                style={{
                    backgroundColor: '#e67e22',
                    color: 'white',
                }}
                title="Загрузить прогресс из файла"
            >
                📂 Открыть файл
            </button>

            {status !== 'idle' && (
                <span style={{
                    color: status === 'success' ? '#2ecc71' : status === 'error' ? '#e74c3c' : '#f1c40f',
                    fontWeight: 'bold',
                    animation: 'fadeIn 0.3s'
                }}>
                    {statusMsg}
                </span>
            )}
        </div>
    );
};

export default DataPersistenceControl;
