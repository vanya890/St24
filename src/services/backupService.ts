
import * as CONSTANTS from '../constants';

interface AppBackupData {
    version: string;
    timestamp: number;
    data: Record<string, any>;
}

/**
 * Собирает все данные приложения из localStorage в один объект.
 */
export const createBackup = (): AppBackupData => {
    const data: Record<string, any> = {};
    
    // Список всех ключей, которые мы используем в приложении
    const keysToSave = [
        CONSTANTS.LOCAL_STORAGE_TOPICS_KEY,
        CONSTANTS.LOCAL_STORAGE_SYSTEM_INSTRUCTIONS_KEY,
        CONSTANTS.LOCAL_STORAGE_EXISTING_CONTENT_KEY,
        CONSTANTS.LOCAL_STORAGE_USE_WEB_SEARCH_KEY,
        CONSTANTS.LOCAL_STORAGE_NUM_TOPIC_IDEAS_KEY,
        CONSTANTS.LOCAL_STORAGE_HISTORY_KEY,
        CONSTANTS.LOCAL_STORAGE_RSS_URL_KEY,
        CONSTANTS.LOCAL_STORAGE_MODEL_KEY,
        CONSTANTS.LOCAL_STORAGE_TOPIC_IDEAS_PROMPT_KEY,
        CONSTANTS.LOCAL_STORAGE_TREND_HISTORY_KEY,
        // Product Feed Keys
        CONSTANTS.LOCAL_STORAGE_PRODUCT_FEED_URL_KEY,
        CONSTANTS.LOCAL_STORAGE_PRODUCT_FEED_DATA_KEY,
        CONSTANTS.LOCAL_STORAGE_PRODUCT_COUNTS_KEY,
        CONSTANTS.LOCAL_STORAGE_USE_FEED_MODE_KEY
    ];

    keysToSave.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            try {
                data[key] = JSON.parse(value);
            } catch (e) {
                // Если данные не JSON (что странно для нашего аппа), сохраняем как строку
                data[key] = value;
            }
        }
    });

    return {
        version: CONSTANTS.BACKUP_FILE_VERSION,
        timestamp: Date.now(),
        data: data
    };
};

/**
 * Восстанавливает данные из объекта бэкапа в localStorage.
 * Генерирует событие 'project-data-restored' для обновления React стейта.
 */
export const restoreBackup = (backup: AppBackupData): void => {
    if (!backup || !backup.data) {
        throw new Error("Некорректный файл резервной копии.");
    }

    // Здесь можно добавить миграцию версий, если backup.version < CURRENT_VERSION
    
    Object.entries(backup.data).forEach(([key, value]) => {
        if (typeof value === 'object') {
            localStorage.setItem(key, JSON.stringify(value));
        } else {
            localStorage.setItem(key, String(value));
        }
    });

    // Уведомляем приложение о том, что данные в LocalStorage изменились извне
    window.dispatchEvent(new Event('project-data-restored'));
};

/**
 * Функция сохранения файла.
 * Изменено: теперь всегда используется скачивание через Blob (стандартная загрузка браузера),
 * без использования File System Access API (window.showSaveFilePicker), чтобы избежать
 * диалогового окна выбора папки.
 */
export const saveProjectToFile = async () => {
    const backupData = createBackup();
    const jsonString = JSON.stringify(backupData, null, 2);
    const fileName = `${CONSTANTS.BACKUP_FILE_NAME_PREFIX}_${new Date().toISOString().split('T')[0]}.json`;

    try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    } catch (e: any) {
        console.error("Save error:", e);
        throw e;
    }
};

/**
 * Загрузка проекта из файла.
 */
export const loadProjectFromFile = async (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) {
                resolve(false);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);
                    restoreBackup(json);
                    resolve(true);
                } catch (err) {
                    reject(new Error("Ошибка чтения файла проекта. Файл поврежден или имеет неверный формат."));
                }
            };
            reader.readAsText(file);
        };

        input.click();
    });
};
