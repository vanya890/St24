
import React, { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { 
    initTokenClient, 
    findBackupFile, 
    uploadBackupToDrive, 
    downloadAndRestoreFromDrive 
} from '../services/googleDriveService';
import { createBackup } from '../services/backupService';
import { 
    LOCAL_STORAGE_HISTORY_KEY, 
    LOCAL_STORAGE_PRODUCT_FEED_DATA_KEY 
} from '../constants';

const LOCAL_STORAGE_GOOGLE_CLIENT_ID = 'stroy_ai_google_client_id';
const LOCAL_STORAGE_MANUAL_TOKEN = 'stroy_ai_manual_token';
const LOCAL_STORAGE_TOKEN_EXPIRY = 'stroy_ai_token_expiry';

const CloudStorageControl: React.FC = () => {
    const [clientId, setClientId] = useLocalStorage<string>(LOCAL_STORAGE_GOOGLE_CLIENT_ID, '');
    
    // Persist manual token and expiry so it survives page reloads
    const [manualToken, setManualToken] = useLocalStorage<string>(LOCAL_STORAGE_MANUAL_TOKEN, '');
    const [tokenExpiry, setTokenExpiry] = useLocalStorage<number>(LOCAL_STORAGE_TOKEN_EXPIRY, 0);

    const [tokenClient, setTokenClient] = useState<any>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'auth' | 'uploading' | 'downloading' | 'success' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isGoogleLibLoaded, setIsGoogleLibLoaded] = useState(false);
    
    const [authMode, setAuthMode] = useState<'oauth' | 'manual'>('oauth');
    const [manualTokenInput, setManualTokenInput] = useState('');

    const popoverRef = useRef<HTMLDivElement>(null);

    // Restore manual token if valid
    useEffect(() => {
        if (manualToken && tokenExpiry > Date.now()) {
            setAccessToken(manualToken);
            setManualTokenInput(manualToken);
            setAuthMode('manual');
        }
    }, []);

    // 1. Ждем загрузки скрипта gsi/client
    useEffect(() => {
        const checkGoogleLib = () => {
            if ((window as any).google && (window as any).google.accounts && (window as any).google.accounts.oauth2) {
                setIsGoogleLibLoaded(true);
            } else {
                setTimeout(checkGoogleLib, 300);
            }
        };
        checkGoogleLib();
    }, []);

    // 2. Инициализируем клиент (только для OAuth режима)
    useEffect(() => {
        if (authMode === 'oauth' && clientId && isGoogleLibLoaded && !tokenClient) {
            try {
                const client = initTokenClient(clientId, (response) => {
                    if (response.access_token) {
                        setAccessToken(response.access_token);
                        setStatus('success');
                        setStatusMsg('Авторизовано!');
                        setTimeout(() => setStatus('idle'), 2000);
                    } else {
                        setStatus('error');
                        setStatusMsg('Ошибка авторизации');
                    }
                });
                setTokenClient(client);
            } catch (e) {
                console.error("Error init token client", e);
            }
        }
    }, [clientId, isGoogleLibLoaded, tokenClient, authMode]);

    // Handle clicks outside to close popover
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isConfigOpen && popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                // Check if the click was on the settings button itself to prevent immediate toggle loop
                const target = event.target as HTMLElement;
                if (!target.closest('.cloud-btn.settings')) {
                    setIsConfigOpen(false);
                }
            }
        };

        if (isConfigOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isConfigOpen]);


    const handleAuth = () => {
        if (authMode === 'manual') {
            const token = manualTokenInput.trim();
            if (!token) {
                alert("Вставьте токен в поле ввода.");
                return;
            }
            // Save token and set expiry to 59 minutes from now (to be safe)
            const expiry = Date.now() + (59 * 60 * 1000);
            
            setAccessToken(token);
            setManualToken(token);
            setTokenExpiry(expiry);
            
            setStatus('success');
            setStatusMsg('Токен сохранен!');
            setTimeout(() => setStatus('idle'), 2000);
            return;
        }

        // OAuth Mode
        if (!clientId) {
            setIsConfigOpen(true);
            return;
        }
        if (!isGoogleLibLoaded) {
            alert("Библиотека Google еще загружается...");
            return;
        }
        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
            setIsConfigOpen(true);
        }
    };

    const handleAction = async (action: 'save' | 'load') => {
        // Check expiry for manual mode
        if (authMode === 'manual' && tokenExpiry > 0 && Date.now() > tokenExpiry) {
            alert("Срок действия токена истек (1 час). Пожалуйста, получите новый токен.");
            setIsConfigOpen(true);
            return;
        }

        if (!accessToken) {
            setIsConfigOpen(true);
            return;
        }

        const isSave = action === 'save';
        setStatus(isSave ? 'uploading' : 'downloading');
        setStatusMsg(isSave ? 'Сохранение...' : 'Загрузка...');

        try {
            // 1. Сначала проверяем, есть ли файл в облаке
            const existingFile = await findBackupFile(accessToken);
            
            if (isSave) {
                // --- ЗАЩИТА ОТ ПЕРЕЗАПИСИ ---
                const currentData = createBackup();
                const history = currentData.data[LOCAL_STORAGE_HISTORY_KEY];
                const feed = currentData.data[LOCAL_STORAGE_PRODUCT_FEED_DATA_KEY];
                
                const isLocalEmpty = (!history || history.length === 0) && (!feed || !feed.offers);
                
                if (existingFile) {
                    const remoteSize = parseInt(existingFile.size || '0', 10);
                    const localJSON = JSON.stringify(currentData);
                    const localSize = new Blob([localJSON]).size;

                    // Сценарий 1: Локально пусто, а в облаке что-то есть (размер > 1KB)
                    if (isLocalEmpty && remoteSize > 1024) {
                        const confirmOverwrite = window.confirm(
                            `⚠️ ОПАСНОЕ ДЕЙСТВИЕ!\n\n` +
                            `В облаке есть сохранение (${(remoteSize / 1024).toFixed(1)} KB), а текущее приложение ПУСТОЕ.\n\n` +
                            `Если вы нажмете ОК, вы УДАЛИТЕ данные из облака и замените их пустым файлом.\n\n` +
                            `Вы точно хотите это сделать? (Скорее всего вы хотели нажать кнопку Загрузить ☁ ⬇)`
                        );
                        if (!confirmOverwrite) {
                            setStatus('idle');
                            setStatusMsg('');
                            return;
                        }
                    } 
                    // Сценарий 2: Локальный файл подозрительно меньше облачного (более чем в 2 раза)
                    else if (remoteSize > localSize * 2 && remoteSize > 1024) {
                        const confirmSizeDiff = window.confirm(
                            `⚠️ ПРЕДУПРЕЖДЕНИЕ\n\n` +
                            `Новое сохранение (${(localSize / 1024).toFixed(1)} KB) значительно меньше файла в облаке (${(remoteSize / 1024).toFixed(1)} KB).\n\n` +
                            `Возможна потеря данных. Перезаписать?`
                        );
                        if (!confirmSizeDiff) {
                             setStatus('idle');
                             setStatusMsg('');
                             return;
                        }
                    }
                }
                // --- КОНЕЦ ЗАЩИТЫ ---

                await uploadBackupToDrive(accessToken, existingFile ? existingFile.id : null);
                setStatusMsg('Сохранено в Drive!');
            } else {
                if (!existingFile) throw new Error("Файл бэкапа не найден в Google Drive.");
                await downloadAndRestoreFromDrive(accessToken, existingFile.id);
                setStatusMsg('Восстановлено!');
            }
            
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (e: any) {
            console.error(e);
            if (e.message && e.message.includes('401')) {
                setAccessToken(null);
                setManualToken(''); // Clear invalid token
                setStatus('error');
                setStatusMsg('Токен истек. Обновите его.');
                setIsConfigOpen(true);
            } else {
                setStatus('error');
                setStatusMsg('Ошибка: ' + e.message);
            }
        }
    };

    const getTimeRemaining = () => {
        if (!tokenExpiry) return null;
        const diff = tokenExpiry - Date.now();
        if (diff <= 0) return "Истек";
        const minutes = Math.floor(diff / 60000);
        return `${minutes} мин.`;
    };

    const isExpired = tokenExpiry > 0 && Date.now() > tokenExpiry;

    return (
        <div className="cloud-control-container">
            {status !== 'idle' && (
                <span style={{
                    color: status === 'success' ? '#2ecc71' : status === 'error' ? '#e74c3c' : '#f1c40f',
                    fontSize: '0.8em',
                    fontWeight: 'bold',
                    animation: 'fadeIn 0.3s'
                }}>
                    {statusMsg}
                </span>
            )}
            
            {/* Expiry Badge */}
            {authMode === 'manual' && accessToken && (
                <span 
                    title="Время действия токена"
                    style={{
                        fontSize: '0.75em', 
                        backgroundColor: isExpired ? '#e74c3c' : '#2ecc71',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        cursor: 'help'
                    }}
                >
                    {isExpired ? 'Токен истек' : `⏱ ${getTimeRemaining()}`}
                </span>
            )}

            <div style={{display: 'flex', gap: '5px'}}>
                <button 
                    onClick={() => handleAction('save')}
                    disabled={status === 'uploading' || status === 'downloading'}
                    className="cloud-btn"
                    title="Сохранить в Google Drive"
                    style={{backgroundColor: '#3498db'}}
                >
                    ☁ ⬆
                </button>
                <button 
                    onClick={() => handleAction('load')}
                    disabled={status === 'uploading' || status === 'downloading'}
                    className="cloud-btn"
                    title="Загрузить из Google Drive"
                    style={{backgroundColor: '#9b59b6'}}
                >
                    ☁ ⬇
                </button>
                <button 
                    onClick={() => setIsConfigOpen(!isConfigOpen)}
                    className="cloud-btn settings"
                    title="Настройки облака"
                    style={{backgroundColor: (!clientId && !accessToken) ? '#e74c3c' : (isExpired ? '#e67e22' : '#7f8c8d')}}
                >
                    ⚙
                </button>
            </div>

            {/* Config Popover */}
            {isConfigOpen && (
                <div className="cloud-config-popover" ref={popoverRef}>
                    <h4 style={{margin: '0 0 15px 0', borderBottom: '1px solid #eee', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span>Подключение Drive</span>
                        <button onClick={() => setIsConfigOpen(false)} style={{border:'none', background:'none', cursor:'pointer', fontSize: '1.5em', lineHeight: '1', padding: '0 5px', color: '#333'}}>×</button>
                    </h4>
                    
                    {/* Tabs */}
                    <div style={{display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '15px'}}>
                        <button 
                            style={{
                                flex: 1, 
                                padding: '8px', 
                                border: 'none', 
                                background: authMode === 'oauth' ? '#f0f0f0' : 'white',
                                borderBottom: authMode === 'oauth' ? '2px solid #3498db' : 'none',
                                fontWeight: authMode === 'oauth' ? 'bold' : 'normal',
                                cursor: 'pointer',
                                fontSize: '0.9em',
                                color: '#333'
                            }}
                            onClick={() => setAuthMode('oauth')}
                        >
                            Client ID
                        </button>
                        <button 
                            style={{
                                flex: 1, 
                                padding: '8px', 
                                border: 'none', 
                                background: authMode === 'manual' ? '#f0f0f0' : 'white',
                                borderBottom: authMode === 'manual' ? '2px solid #3498db' : 'none',
                                fontWeight: authMode === 'manual' ? 'bold' : 'normal',
                                cursor: 'pointer',
                                fontSize: '0.9em',
                                color: '#333'
                            }}
                            onClick={() => setAuthMode('manual')}
                        >
                             Ручной ввод
                        </button>
                    </div>

                    {authMode === 'oauth' ? (
                        /* OAUTH MODE */
                        <div>
                            <div style={{fontSize: '0.85em', color: '#555', marginBottom: '15px', lineHeight: '1.4'}}>
                                Настройка домена в GCP. 
                                <br/>Origin: <b>{window.location.origin}</b>
                            </div>

                            <div style={{marginBottom: '15px'}}>
                                <label style={{display: 'block', fontWeight: 'bold', fontSize: '0.8em', marginBottom: '5px'}}>Client ID:</label>
                                <input 
                                    type="text" 
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    placeholder="... .apps.googleusercontent.com"
                                    style={{width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'}}
                                />
                            </div>

                            {!accessToken ? (
                                <button 
                                    onClick={handleAuth}
                                    disabled={!isGoogleLibLoaded || !clientId}
                                    style={{
                                        width: '100%', 
                                        backgroundColor: isGoogleLibLoaded && clientId ? '#4285F4' : '#bdc3c7', 
                                        color: 'white', 
                                        border: 'none', 
                                        padding: '10px', 
                                        borderRadius: '4px', 
                                        cursor: isGoogleLibLoaded && clientId ? 'pointer' : 'not-allowed',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {isGoogleLibLoaded ? 'Войти через Google' : 'Загрузка...'}
                                </button>
                            ) : (
                                <div style={{color: '#27ae60', fontSize: '0.9em', textAlign: 'center', fontWeight: 'bold', padding: '10px', border: '1px solid #27ae60', borderRadius: '4px'}}>
                                    ✓ Аккаунт подключен
                                </div>
                            )}
                        </div>
                    ) : (
                        /* MANUAL TOKEN MODE */
                        <div>
                            <div style={{fontSize: '0.85em', color: '#555', marginBottom: '10px', lineHeight: '1.3'}}>
                                Токен действует <b>1 час</b>. Получите его в OAuth Playground.
                            </div>
                            
                            <div style={{
                                backgroundColor: '#f9f9f9', 
                                padding: '10px', 
                                borderRadius: '4px', 
                                border: '1px solid #eee', 
                                marginBottom: '15px',
                                maxHeight: '120px',
                                overflowY: 'auto'
                            }}>
                                <ol style={{paddingLeft: '15px', fontSize: '0.8em', color: '#333', lineHeight: '1.4', margin: 0}}>
                                    <li style={{marginBottom: '5px'}}>
                                        Перейдите в <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" style={{color: '#3498db'}}>OAuth Playground</a>.
                                    </li>
                                    <li style={{marginBottom: '5px'}}>
                                        В <b>"Input your own scopes"</b> вставьте:
                                        <code style={{display: 'block', padding: '2px', backgroundColor: '#eef', borderRadius: '3px', margin: '2px 0', wordBreak: 'break-all'}}>https://www.googleapis.com/auth/drive.file</code>
                                    </li>
                                    <li style={{marginBottom: '5px'}}>Нажмите <b>"Authorize APIs"</b>.</li>
                                    <li style={{marginBottom: '5px'}}>Нажмите <b>"Exchange authorization code"</b>.</li>
                                    <li>Скопируйте <b>Access token</b>.</li>
                                </ol>
                            </div>

                            <div style={{marginBottom: '15px'}}>
                                <label style={{display: 'block', fontWeight: 'bold', fontSize: '0.8em', marginBottom: '5px'}}>Вставьте Access Token:</label>
                                <input 
                                    type="text" 
                                    value={manualTokenInput}
                                    onChange={(e) => setManualTokenInput(e.target.value)}
                                    placeholder="ya29.a0..."
                                    style={{width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'}}
                                />
                            </div>

                            <button 
                                onClick={handleAuth}
                                style={{
                                    width: '100%', 
                                    backgroundColor: '#27ae60', 
                                    color: 'white', 
                                    border: 'none', 
                                    padding: '10px', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                {accessToken ? 'Обновить Токен' : 'Сохранить Токен'}
                            </button>
                            
                            {accessToken && authMode === 'manual' && (
                                <div style={{marginTop: '15px', padding: '8px', backgroundColor: isExpired ? '#ffebee' : '#e8f8f5', borderRadius: '4px', border: `1px solid ${isExpired ? '#e74c3c' : '#2ecc71'}`}}>
                                    <div style={{fontWeight: 'bold', color: isExpired ? '#c0392b' : '#27ae60', textAlign: 'center', fontSize: '0.9em'}}>
                                        {isExpired ? 'СРОК ИСТЕК' : 'ТОКЕН АКТИВЕН'}
                                    </div>
                                    <div style={{fontSize: '0.8em', textAlign: 'center', marginTop: '2px', color: '#555'}}>
                                        Осталось: <b>{getTimeRemaining()}</b>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CloudStorageControl;
