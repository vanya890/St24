
import { createBackup, restoreBackup } from './backupService';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILE_NAME = 'stroy_ai_project_data_cloud.json';

interface GoogleDriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string; // Added size for validation
}

/**
 * Инициализирует клиента OAuth 2.0 (Token Model)
 */
export const initTokenClient = (clientId: string, callback: (tokenResponse: any) => void) => {
    // @ts-ignore
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        throw new Error("Google Identity Services script not loaded.");
    }
    // @ts-ignore
    return google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: callback,
    });
};

/**
 * Ищет файл бэкапа в Google Drive
 */
export const findBackupFile = async (accessToken: string): Promise<GoogleDriveFile | null> => {
    const query = `name = '${BACKUP_FILE_NAME}' and trashed = false`;
    // Added 'size' to requested fields
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, size)`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Google Drive API Error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
        return data.files[0];
    }
    return null;
};

/**
 * Создает или обновляет файл на Google Drive
 */
export const uploadBackupToDrive = async (accessToken: string, existingFileId: string | null): Promise<void> => {
    const backupData = createBackup();
    const fileContent = JSON.stringify(backupData, null, 2);
    
    const fileMetadata = {
        name: BACKUP_FILE_NAME,
        mimeType: 'application/json'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileContent], { type: 'application/json' }));

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (existingFileId) {
        // Update existing file
        url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
        method = 'PATCH';
    }

    const response = await fetch(url, {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        body: form
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Upload Error: ${err}`);
    }
};

/**
 * Скачивает и восстанавливает бэкап из Google Drive
 */
export const downloadAndRestoreFromDrive = async (accessToken: string, fileId: string): Promise<void> => {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Download Error: ${response.statusText}`);
    }

    const json = await response.json();
    restoreBackup(json);
};
