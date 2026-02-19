
import React, { useState, useEffect } from 'react';

function getStorageValue<T>(key: string, defaultValue: T): T {
    const saved = localStorage.getItem(key);
    if (saved === null) {
        return defaultValue;
    }
    try {
        return JSON.parse(saved);
    } catch (e) {
        // Если парсинг JSON не удался, это может означать, что значение сохранено как "сырая" строка
        // (например, старая версия приложения или ручное изменение).
        // В таком случае возвращаем само строковое значение, чтобы не потерять данные.
        // Это исправляет ошибки вида "Unexpected token..." при загрузке.
        return saved as unknown as T;
    }
}

export const useLocalStorage = <T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [value, setValue] = useState<T>(() => {
        return getStorageValue(key, defaultValue);
    });

    // 1. Сохранение изменений стейта в LocalStorage (обычная работа)
    useEffect(() => {
        try {
            // Всегда сохраняем как JSON строку, даже если это обычная строка.
            // Это со временем автоматически "исправит" формат данных в хранилище пользователя.
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error setting localStorage key "${key}":`, e);
        }
    }, [key, value]);

    // 2. Прослушивание события восстановления бэкапа (для загрузки файла)
    useEffect(() => {
        const handleRestoreEvent = () => {
            // Перечитываем значение из хранилища, так как оно было обновлено сервисом backupService
            const newValue = getStorageValue(key, defaultValue);
            setValue(newValue);
        };

        window.addEventListener('project-data-restored', handleRestoreEvent);

        return () => {
            window.removeEventListener('project-data-restored', handleRestoreEvent);
        };
    }, [key, defaultValue]);

    return [value, setValue];
};
