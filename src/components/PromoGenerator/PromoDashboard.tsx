
import React, { useState, useRef, useEffect } from 'react';
import { ProductOffer, ProductFeedData } from '../../types';
import { GoogleGenAI } from "@google/genai";
import { generatePromoImage } from '../../services/geminiService';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { addMetadataToPng } from '../../utils/pngMetadata';

interface PromoDashboardProps {
    feedData: ProductFeedData | null;
}

type AspectRatio = '9:16' | '1:1' | '16:9';

interface QueueItem {
    id: string; // Unique ID for queue item (timestamp + productID)
    product: ProductOffer;
    status: 'idle' | 'generating' | 'success' | 'error';
    imageUrl?: string;
    qrCodeUrl?: string; // Base64 Data URL of the QR Code
    errorMsg?: string;
}

// Функция разбивки текста на строки с учетом лимита строк
const splitText = (text: string, maxChars: number, maxLines: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        // Проверяем, влезает ли слово в текущую строку
        if (currentLine.length + 1 + words[i].length <= maxChars) {
            currentLine += ' ' + words[i];
        } else {
            // Если достигли лимита строк, и это последняя строка, просто дописываем (с обрезкой CSS/SVG потом) или обрезаем
            if (lines.length === maxLines - 1) {
                 // Последняя строка - пытаемся впихнуть сколько влезет, остальное обрезаем троеточием
                 const remaining = words.slice(i).join(' ');
                 if ((currentLine + ' ' + remaining).length <= maxChars + 5) {
                     currentLine += ' ' + remaining;
                     break; // Все влезло
                 } else {
                     // Не влезает, добавляем текущую и новую с троеточием
                     lines.push(currentLine);
                     let lastLine = words[i];
                     // Добавляем слова пока влезает
                     for(let k = i+1; k < words.length; k++) {
                         if ((lastLine + ' ' + words[k]).length < maxChars - 3) {
                             lastLine += ' ' + words[k];
                         } else {
                             lastLine += '...';
                             break;
                         }
                     }
                     lines.push(lastLine);
                     return lines; 
                 }
            }
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    lines.push(currentLine);
    return lines.slice(0, maxLines); 
};

const PromoDashboard: React.FC<PromoDashboardProps> = ({ feedData }) => {
    // Selection State (Changed to array for multi-select)
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Settings State
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
    const [shopName, setShopName] = useState('STROY-MATERIALI-24.RU');
    const [phone, setPhone] = useState('+7 (926) 163-75-07');
    const [accentColor, setAccentColor] = useState('#e67e22');
    const [imageModel, setImageModel] = useState<'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview'>('gemini-2.5-flash-image');

    // Queue State
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [activeQueueId, setActiveQueueId] = useState<string | null>(null); // Какой айтм сейчас в редакторе
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);

    const svgRef = useRef<SVGSVGElement>(null);

    // Filter products
    const filteredProducts = feedData?.offers.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    // --- Queue Management ---

    const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const values = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
        setSelectedProductIds(values);
    };

    const handleAddToQueue = () => {
        if (selectedProductIds.length === 0) return;

        const newItems: QueueItem[] = [];
        const timestamp = Date.now();

        // Iterate over all selected IDs
        selectedProductIds.forEach((id, index) => {
            const product = feedData?.offers.find(p => p.id === id);
            if (product) {
                newItems.push({
                    // Add index to timestamp to ensure unique keys even if processed in same millisecond
                    id: `${timestamp}-${index}-${product.id}`,
                    product: product,
                    status: 'idle'
                });
            }
        });

        setQueue(prev => [...prev, ...newItems]);
        
        // If nothing was active, set the first new item as active
        if (!activeQueueId && newItems.length > 0) {
            setActiveQueueId(newItems[0].id); 
        }

        // Clear selection
        setSelectedProductIds([]); 
    };

    const handleRemoveFromQueue = (id: string) => {
        setQueue(prev => prev.filter(item => item.id !== id));
        if (activeQueueId === id) {
            setActiveQueueId(null);
        }
    };

    const handleClearQueue = () => {
        setQueue([]);
        setActiveQueueId(null);
    };

    // --- Batch Generation ---

    const processQueue = async () => {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            alert("API Key не найден.");
            return;
        }

        setIsBatchProcessing(true);
        const controller = new AbortController();
        setAbortController(controller);

        const ai = new GoogleGenAI({ apiKey });

        // Iterate through queue items that are not done yet
        const pendingItems = queue.filter(item => item.status === 'idle' || item.status === 'error');

        for (const item of pendingItems) {
            if (controller.signal.aborted) break;

            // 1. Set Status to Generating
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'generating', errorMsg: undefined } : q));
            setActiveQueueId(item.id); // Show current processing item

            try {
                // 2. API Call (Parallel: Image & QR)
                const imagePromise = generatePromoImage(ai, item.product, aspectRatio, imageModel);
                const qrPromise = QRCode.toDataURL(item.product.url, { 
                    margin: 1,
                    width: 300,
                    color: { dark: '#000000', light: '#ffffff' }
                });

                const [imageUrl, qrCodeUrl] = await Promise.all([imagePromise, qrPromise]);
                
                // 3. Success
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', imageUrl, qrCodeUrl } : q));
            } catch (e: any) {
                // 4. Error
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', errorMsg: e.message } : q));
            }
        }

        setIsBatchProcessing(false);
        setAbortController(null);
    };

    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setIsBatchProcessing(false);
        }
    };

    // --- Rendering Helpers ---

    // SVG Dimensions based on ratio
    const getDimensions = () => {
        switch (aspectRatio) {
            case '9:16': return { w: 1080, h: 1920 };
            case '1:1': return { w: 1080, h: 1080 };
            case '16:9': return { w: 1920, h: 1080 };
            default: return { w: 1080, h: 1080 };
        }
    };
    const { w, h } = getDimensions();

    const activeItem = queue.find(q => q.id === activeQueueId);
    const productName = activeItem ? activeItem.product.name : "Выберите товар из очереди";

    // --- ЛОГИКА АДАПТИВНОГО ТЕКСТА ---
    const getTextLayout = (name: string, ratio: AspectRatio) => {
        const len = name.length;
        
        // Базовые настройки для "нормального" текста (до 50 символов)
        let fontSize = w * 0.055;
        let lineHeight = w * 0.07;
        let maxLines = 2;
        let charsPerLine = ratio === '9:16' ? 15 : 28;

        if (len > 90) {
            // ОЧЕНЬ длинный текст (например: Плита теплоизоляционная Ruspanel RPG Basic 10x600x2500...)
            fontSize = w * 0.035; // Значительно уменьшаем шрифт
            lineHeight = w * 0.045;
            maxLines = 4; // Разрешаем 4 строки
            charsPerLine = ratio === '9:16' ? 26 : 45; // Вмещаем больше букв
        } else if (len > 50) {
            // Средний текст
            fontSize = w * 0.045;
            lineHeight = w * 0.055;
            maxLines = 3;
            charsPerLine = ratio === '9:16' ? 20 : 35;
        }

        return {
            fontSize,
            lineHeight,
            lines: splitText(name, charsPerLine, maxLines)
        };
    };

    const textLayout = getTextLayout(productName, aspectRatio);

    // --- Export Logic ---

    const handleDownloadSingle = () => {
        if (!svgRef.current || !activeItem) return;
        renderSvgToCanvas(svgRef.current, async (blob) => {
            if (blob) {
                // Внедрение метаданных
                const metaBlob = await addMetadataToPng(blob, {
                    "Title": activeItem.product.name,
                    "Source": activeItem.product.url, // Ссылка на товар
                    "Copyright": shopName,
                    "Author": shopName,
                    "Description": `Promo image for ${activeItem.product.name}. Buy at ${activeItem.product.url}`,
                    "Software": "Stroy-Materiali-24.ru AI Promo Studio"
                });

                const url = URL.createObjectURL(metaBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `promo_${activeItem.product.id}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }
        });
    };

    // Helper to rasterize SVG
    const renderSvgToCanvas = (svgElement: SVGSVGElement, callback: (blob: Blob | null) => void) => {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        const viewBox = svgElement.getAttribute("viewBox")?.split(" ");
        if (!viewBox) { callback(null); return; }
        
        const width = parseInt(viewBox[2]);
        const height = parseInt(viewBox[3]);

        canvas.width = width;
        canvas.height = height;

        img.onload = () => {
            if (ctx) {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(callback, 'image/png');
            } else {
                callback(null);
            }
        };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    };

    const handleDownloadAllZip = async () => {
        const completedItems = queue.filter(q => q.status === 'success' && q.imageUrl);
        if (completedItems.length === 0) {
            alert("Нет готовых изображений для скачивания.");
            return;
        }

        const zip = new JSZip();
        const folder = zip.folder("promo_images");

        let count = 0;
        for (const item of completedItems) {
            const layout = getTextLayout(item.product.name, aspectRatio);
            
            // Construct SVG String manually (replicating the render logic)
            // UPDATED: QR Code Logic included in template
            const svgString = `
                <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
                    <defs>
                        <linearGradient id="gradTop" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="black" stop-opacity="0.7" />
                            <stop offset="100%" stop-color="black" stop-opacity="0" />
                        </linearGradient>
                        <linearGradient id="badgeGloss" x1="0%" y1="0%" x2="100%" y2="100%">
                             <stop offset="0%" stop-color="white" stop-opacity="0.3" />
                             <stop offset="50%" stop-color="white" stop-opacity="0" />
                             <stop offset="100%" stop-color="black" stop-opacity="0.1" />
                        </linearGradient>
                         <pattern id="stripePattern" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                            <line x1="0" y="0" x2="0" y2="10" stroke="white" stroke-width="2" stroke-opacity="0.15" />
                        </pattern>
                         <filter id="hardShadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
                            <feOffset dx="2" dy="4" result="offsetblur"/>
                            <feComponentTransfer>
                                <feFuncA type="linear" slope="0.6"/>
                            </feComponentTransfer>
                            <feMerge> 
                                <feMergeNode/>
                                <feMergeNode in="SourceGraphic"/> 
                            </feMerge>
                        </filter>
                    </defs>
                    <rect width="100%" height="100%" fill="white" />
                    <image href="${item.imageUrl}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" />
                    <rect x="0" y="0" width="${w}" height="${h * 0.2}" fill="url(#gradTop)" />
                    
                    <text x="50%" y="${h * 0.06}" text-anchor="middle" fill="white" font-size="${w * 0.04}" font-weight="bold" font-family="Roboto, sans-serif" letter-spacing="4" style="text-transform: uppercase; text-shadow: 0px 2px 4px rgba(0,0,0,0.5)">
                        ${shopName}
                    </text>

                    <g transform="translate(${w * 0.05}, ${h * 0.78})">
                        <rect x="0" y="0" width="${w * 0.9}" height="${h * 0.18}" rx="20" fill="#1a1a1a" fill-opacity="0.95" />
                        <rect x="0" y="25" width="8" height="${h * 0.18 - 50}" fill="${accentColor}" />
                        
                        <!-- Text with Adaptive Sizing -->
                        <text x="40" y="${h * 0.06}" fill="white" font-size="${layout.fontSize}" font-weight="bold" font-family="Roboto, sans-serif">
                            ${layout.lines.map((line, i) => `<tspan x="40" dy="${i === 0 ? 0 : layout.lineHeight}">${line}</tspan>`).join('')}
                        </text>
                        
                        <!-- QR Code Background -->
                        <rect x="${w * 0.9 - (h * 0.10) - 20}" y="15" width="${h * 0.10}" height="${h * 0.10}" rx="10" fill="white" />
                        <!-- QR Code Image -->
                        ${item.qrCodeUrl ? `<image href="${item.qrCodeUrl}" x="${w * 0.9 - (h * 0.10) - 15}" y="20" width="${h * 0.10 - 10}" height="${h * 0.10 - 10}" />` : ''}

                        <!-- Phone Number -->
                         <text x="${w * 0.9 - 20}" y="${h * 0.155}" text-anchor="end" fill="${accentColor}" font-size="${w * 0.045}" font-weight="bold" font-family="Roboto, sans-serif" letter-spacing="1">
                            ${phone}
                        </text>
                    </g>
                    ${item.product.price ? `
                    <g transform="translate(${w * 0.60}, ${h * 0.08})" filter="url(#hardShadow)">
                        <rect x="0" y="0" width="${w * 0.35}" height="${h * 0.08}" rx="${h * 0.04}" fill="${accentColor}" stroke="white" stroke-width="${w * 0.006}" />
                        <rect x="0" y="0" width="${w * 0.35}" height="${h * 0.08}" rx="${h * 0.04}" fill="url(#stripePattern)" />
                        <rect x="0" y="0" width="${w * 0.35}" height="${h * 0.08}" rx="${h * 0.04}" fill="url(#badgeGloss)" />
                        <text x="${(w * 0.35) / 2}" y="${(h * 0.08) / 2}" dominant-baseline="central" text-anchor="middle" fill="white" font-size="${w * 0.05}" font-weight="900" font-family="Roboto, sans-serif" style="text-shadow: 2px 2px 0px rgba(0,0,0,0.2)" letter-spacing="1">
                            ${item.product.price} ${item.product.currencyId}
                        </text>
                    </g>` : ''}
                </svg>
            `;

            await new Promise<void>((resolve) => {
                const img = new Image();
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");

                img.onload = async () => {
                    if (ctx) {
                        ctx.fillStyle = "white";
                        ctx.fillRect(0, 0, w, h);
                        ctx.drawImage(img, 0, 0);
                        canvas.toBlob(async (blob) => {
                            if (blob && folder) {
                                // Внедрение метаданных перед добавлением в ZIP
                                const metaBlob = await addMetadataToPng(blob, {
                                    "Title": item.product.name,
                                    "Source": item.product.url,
                                    "Copyright": shopName,
                                    "Author": shopName,
                                    "Description": `Promo image for ${item.product.name}. Buy at ${item.product.url}`,
                                    "Software": "Stroy-Materiali-24.ru AI Promo Studio"
                                });

                                folder.file(`promo_${item.product.id}.png`, metaBlob);
                                count++;
                            }
                            resolve();
                        }, 'image/png');
                    } else {
                        resolve();
                    }
                };
                img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));
            });
        }

        if (count > 0) {
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = "promo_collection.zip";
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="card">
            <h2>🎨 Промо-Студия: Пакетная Генерация</h2>
            
            {!feedData ? (
                <div style={{color: '#e74c3c', padding: '20px'}}>
                    ⚠ Для работы Промо-Студии необходимо загрузить Товарный Фид (во вкладке "Товары").
                </div>
            ) : (
                <div className="columns-container" style={{alignItems: 'flex-start'}}>
                    
                    {/* LEFT COLUMN: Queue & Settings */}
                    <div style={{flex: 1, minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
                        
                        {/* 1. Add to Queue Section */}
                        <div style={{backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee'}}>
                            <h3 style={{marginTop: 0, fontSize: '1.1em'}}>1. Добавить товары</h3>
                            <input 
                                type="text" 
                                placeholder="Поиск товара..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{marginBottom: '10px'}}
                            />
                            
                            {/* MULTI-SELECT LIST */}
                            <select 
                                multiple
                                size={10}
                                value={selectedProductIds}
                                onChange={handleMultiSelectChange}
                                style={{
                                    width: '100%', 
                                    border: '1px solid #d1d5db', 
                                    borderRadius: '4px',
                                    padding: '5px',
                                    marginBottom: '10px',
                                    fontSize: '0.9em'
                                }}
                            >
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.slice(0, 200).map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))
                                ) : (
                                    <option disabled>Товары не найдены</option>
                                )}
                            </select>
                            <div style={{fontSize: '0.8em', color: '#7f8c8d', marginBottom: '10px'}}>
                                * Используйте <b>Ctrl</b> (Win) или <b>Cmd</b> (Mac) для выбора нескольких товаров. <b>Shift</b> для диапазона.
                            </div>

                            <button 
                                onClick={handleAddToQueue}
                                disabled={selectedProductIds.length === 0}
                                style={{
                                    width: '100%',
                                    backgroundColor: selectedProductIds.length > 0 ? '#2980b9' : '#95a5a6', 
                                    color: 'white'
                                }}
                            >
                                + Добавить в очередь ({selectedProductIds.length})
                            </button>
                        </div>

                        {/* 2. Global Settings */}
                        <div style={{backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee'}}>
                            <h3 style={{marginTop: 0, fontSize: '1.1em'}}>2. Настройки коллекции</h3>
                            
                            <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                                <div style={{flex: 1}}>
                                    <label style={{fontSize: '0.85em'}}>Формат</label>
                                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as AspectRatio)}>
                                        <option value="9:16">Stories (9:16)</option>
                                        <option value="1:1">Post (1:1)</option>
                                        <option value="16:9">Landscape (16:9)</option>
                                    </select>
                                </div>
                                <div style={{flex: 1}}>
                                    <label style={{fontSize: '0.85em'}}>Модель</label>
                                    <select value={imageModel} onChange={e => setImageModel(e.target.value as any)}>
                                        <option value="gemini-2.5-flash-image">Flash (Быстро)</option>
                                        <option value="gemini-3-pro-image-preview">Pro (Качество)</option>
                                    </select>
                                </div>
                            </div>

                            <input 
                                type="text" 
                                value={shopName} 
                                onChange={e => setShopName(e.target.value)} 
                                placeholder="Бренд"
                                style={{marginBottom: '5px'}}
                            />
                            <input 
                                type="text" 
                                value={phone} 
                                onChange={e => setPhone(e.target.value)} 
                                placeholder="Телефон"
                            />
                             <div style={{display: 'flex', gap: '5px', marginTop: '10px', alignItems: 'center'}}>
                                <span style={{fontSize: '0.9em'}}>Цвет:</span>
                                {['#e67e22', '#e74c3c', '#27ae60', '#3498db', '#9b59b6', '#34495e'].map(color => (
                                    <div 
                                        key={color}
                                        onClick={() => setAccentColor(color)}
                                        style={{
                                            width: '20px', height: '20px', borderRadius: '50%', 
                                            backgroundColor: color, cursor: 'pointer',
                                            border: accentColor === color ? '2px solid black' : '1px solid #ddd'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* 3. Queue List */}
                        <div style={{flexGrow: 1, border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
                            <div style={{padding: '10px', backgroundColor: '#ecf0f1', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span style={{fontWeight: 'bold'}}>Очередь ({queue.length})</span>
                                <button onClick={handleClearQueue} style={{fontSize: '0.8em', padding: '2px 8px', backgroundColor: 'transparent', color: '#c0392b', border: '1px solid #c0392b'}}>Очистить</button>
                            </div>
                            
                            <div style={{flexGrow: 1, overflowY: 'auto', maxHeight: '300px', backgroundColor: 'white'}}>
                                {queue.length === 0 ? (
                                    <div style={{padding: '20px', textAlign: 'center', color: '#95a5a6'}}>Список пуст</div>
                                ) : (
                                    queue.map(item => (
                                        <div 
                                            key={item.id}
                                            onClick={() => setActiveQueueId(item.id)}
                                            style={{
                                                padding: '10px',
                                                borderBottom: '1px solid #eee',
                                                cursor: 'pointer',
                                                backgroundColor: activeQueueId === item.id ? '#e8f6f3' : 'white',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px'}}>
                                                <div style={{fontSize: '0.9em', fontWeight: 'bold'}}>{item.product.name}</div>
                                                <div style={{fontSize: '0.75em', color: '#7f8c8d'}}>{item.product.price} {item.product.currencyId}</div>
                                            </div>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                {item.status === 'idle' && <span style={{fontSize: '1.2em', color: '#bdc3c7'}}>⏳</span>}
                                                {item.status === 'generating' && <span className="loading-spinner" style={{width: '14px', height: '14px'}}></span>}
                                                {item.status === 'success' && <span style={{fontSize: '1.2em', color: '#27ae60'}}>✅</span>}
                                                {item.status === 'error' && <span style={{fontSize: '1.2em', color: '#c0392b'}}>❌</span>}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveFromQueue(item.id); }}
                                                    style={{border: 'none', background: 'none', color: '#999', cursor: 'pointer', fontSize: '1.2em'}}
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <div style={{padding: '10px', backgroundColor: '#ecf0f1', borderTop: '1px solid #ddd'}}>
                                {isBatchProcessing ? (
                                    <button 
                                        onClick={handleStop} 
                                        style={{width: '100%', backgroundColor: '#c0392b', color: 'white'}}
                                    >
                                        ⏹ Остановить
                                    </button>
                                ) : (
                                    <button 
                                        onClick={processQueue} 
                                        disabled={queue.filter(i => i.status === 'idle').length === 0}
                                        style={{width: '100%', backgroundColor: '#27ae60', color: 'white'}}
                                    >
                                        ▶ Запустить очередь ({queue.filter(i => i.status === 'idle').length})
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Preview & Editor */}
                    <div style={{flex: 2, backgroundColor: '#ecf0f1', padding: '20px', borderRadius: '8px', minHeight: '600px', display: 'flex', flexDirection: 'column'}}>
                        
                        {/* Toolbar */}
                        <div style={{marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h3 style={{margin: 0}}>Предпросмотр</h3>
                            <div style={{display: 'flex', gap: '10px'}}>
                                {activeItem && activeItem.status === 'success' && (
                                    <button onClick={handleDownloadSingle} style={{backgroundColor: '#34495e', color: 'white', padding: '8px 15px', fontSize: '0.9em'}}>
                                        💾 Скачать этот
                                    </button>
                                )}
                                <button 
                                    onClick={handleDownloadAllZip} 
                                    disabled={queue.filter(q => q.status === 'success').length === 0}
                                    style={{backgroundColor: '#8e44ad', color: 'white', padding: '8px 15px', fontSize: '0.9em'}}
                                >
                                    📦 Скачать ZIP ({queue.filter(q => q.status === 'success').length})
                                </button>
                            </div>
                        </div>

                        {/* SVG Display */}
                        <div style={{
                            flexGrow: 1, 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            backgroundColor: '#bdc3c7',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            position: 'relative',
                            minHeight: '400px'
                        }}>
                            {activeItem ? (
                                <div style={{
                                    width: '100%', 
                                    maxWidth: aspectRatio === '16:9' ? '700px' : '400px', // Adapt preview width
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                                    lineHeight: 0
                                }}>
                                    <svg 
                                        ref={svgRef}
                                        viewBox={`0 0 ${w} ${h}`} 
                                        xmlns="http://www.w3.org/2000/svg"
                                        style={{width: '100%', height: 'auto', backgroundColor: '#1a1a1a'}}
                                    >
                                        <defs>
                                            <linearGradient id="gradTop" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" style={{stopColor:'rgb(0,0,0)', stopOpacity:0.7}} />
                                                <stop offset="100%" style={{stopColor:'rgb(0,0,0)', stopOpacity:0}} />
                                            </linearGradient>

                                            {/* Badge Gloss */}
                                            <linearGradient id="badgeGloss" x1="0%" y1="0%" x2="100%" y2="100%">
                                                 <stop offset="0%" style={{stopColor: 'white', stopOpacity: 0.3}} />
                                                 <stop offset="50%" style={{stopColor: 'white', stopOpacity: 0}} />
                                                 <stop offset="100%" style={{stopColor: 'black', stopOpacity: 0.1}} />
                                            </linearGradient>

                                            {/* Stripe Pattern */}
                                             <pattern id="stripePattern" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                                                <line x1="0" y="0" x2="0" y2="10" stroke="white" strokeWidth="2" strokeOpacity="0.15" />
                                            </pattern>

                                            <filter id="hardShadow" x="-20%" y="-20%" width="140%" height="140%">
                                                <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
                                                <feOffset dx="2" dy="4" result="offsetblur"/>
                                                <feComponentTransfer>
                                                    <feFuncA type="linear" slope="0.6"/>
                                                </feComponentTransfer>
                                                <feMerge> 
                                                    <feMergeNode/>
                                                    <feMergeNode in="SourceGraphic"/> 
                                                </feMerge>
                                            </filter>
                                        </defs>

                                        {/* Image Layer */}
                                        {activeItem.imageUrl ? (
                                            <image 
                                                href={activeItem.imageUrl} 
                                                x="0" 
                                                y="0" 
                                                width={w} 
                                                height={h} 
                                                preserveAspectRatio="xMidYMid slice" 
                                            />
                                        ) : (
                                            <g>
                                                <rect x="0" y="0" width={w} height={h} fill="#333" />
                                                <text x="50%" y="50%" textAnchor="middle" fill="#555" fontSize={w/15} fontFamily="Arial">
                                                    {activeItem.status === 'generating' ? 'Генерация...' : 'Ожидание...'}
                                                </text>
                                            </g>
                                        )}

                                        {/* Overlay Layer */}
                                        <rect x="0" y="0" width={w} height={h * 0.2} fill="url(#gradTop)" />

                                        <text 
                                            x="50%" 
                                            y={h * 0.06} 
                                            textAnchor="middle" 
                                            fill="white" 
                                            fontSize={w * 0.04} 
                                            fontWeight="bold"
                                            fontFamily="'Roboto', sans-serif"
                                            letterSpacing="4"
                                            style={{textTransform: 'uppercase', textShadow: '0px 2px 4px rgba(0,0,0,0.5)'}}
                                        >
                                            {shopName}
                                        </text>

                                        <g transform={`translate(${w * 0.05}, ${h * 0.78})`}>
                                            <rect 
                                                x="0" 
                                                y="0" 
                                                width={w * 0.9} 
                                                height={h * 0.18} 
                                                rx="20" 
                                                fill="#1a1a1a" 
                                                fillOpacity="0.95"
                                                filter="url(#hardShadow)"
                                            />
                                            <rect x="0" y="25" width="8" height={h * 0.18 - 50} rx="0" fill={accentColor} />

                                            <text x="40" y={h * 0.06} fill="white" fontSize={textLayout.fontSize} fontWeight="bold" fontFamily="'Roboto', sans-serif">
                                                {textLayout.lines.map((line, i) => (
                                                    <tspan x="40" dy={i === 0 ? 0 : textLayout.lineHeight} key={i}>{line}</tspan>
                                                ))}
                                            </text>

                                            {/* QR Code Background */}
                                            <rect 
                                                x={w * 0.9 - (h * 0.10) - 20} 
                                                y="15" 
                                                width={h * 0.10} 
                                                height={h * 0.10} 
                                                rx="10" 
                                                fill="white" 
                                            />
                                            
                                            {/* QR Code Image */}
                                            {activeItem.qrCodeUrl && (
                                                <image 
                                                    href={activeItem.qrCodeUrl} 
                                                    x={w * 0.9 - (h * 0.10) - 15} 
                                                    y="20" 
                                                    width={h * 0.10 - 10} 
                                                    height={h * 0.10 - 10} 
                                                />
                                            )}

                                            {/* Phone Number - Right Aligned, Below QR */}
                                            <text x={w * 0.9 - 20} y={h * 0.155} textAnchor="end" fill={accentColor} fontSize={w * 0.045} fontWeight="bold" fontFamily="'Roboto', sans-serif" letterSpacing="1">
                                                {phone}
                                            </text>
                                        </g>

                                        {activeItem.product.price && (
                                            <g transform={`translate(${w * 0.60}, ${h * 0.08})`} filter="url(#hardShadow)">
                                                {/* Base Color */}
                                                <rect x="0" y="0" width={w * 0.35} height={h * 0.08} rx={h * 0.04} fill={accentColor} stroke="white" strokeWidth={w * 0.006} />
                                                
                                                {/* Pattern */}
                                                <rect x="0" y="0" width={w * 0.35} height={h * 0.08} rx={h * 0.04} fill="url(#stripePattern)" />
                                                
                                                {/* Gloss */}
                                                <rect x="0" y="0" width={w * 0.35} height={h * 0.08} rx={h * 0.04} fill="url(#badgeGloss)" />

                                                <text 
                                                    x={(w * 0.35) / 2} 
                                                    y={(h * 0.08) / 2} 
                                                    dominantBaseline="central" 
                                                    textAnchor="middle" 
                                                    fill="white" 
                                                    fontSize={w * 0.05} 
                                                    fontWeight="900" 
                                                    fontFamily="'Roboto', sans-serif" 
                                                    style={{textShadow: '2px 2px 0px rgba(0,0,0,0.2)'}}
                                                    letterSpacing="1"
                                                >
                                                    {activeItem.product.price} {activeItem.product.currencyId}
                                                </text>
                                            </g>
                                        )}
                                    </svg>
                                </div>
                            ) : (
                                <div style={{textAlign: 'center', color: '#7f8c8d'}}>
                                    <h3>Ничего не выбрано</h3>
                                    <p>Добавьте товары в очередь слева и выберите один для просмотра.</p>
                                </div>
                            )}

                            {activeItem?.status === 'error' && (
                                <div style={{
                                    position: 'absolute', bottom: '20px', left: '20px', right: '20px',
                                    backgroundColor: 'rgba(192, 57, 43, 0.9)', color: 'white', padding: '10px', borderRadius: '4px'
                                }}>
                                    Ошибка: {activeItem.errorMsg}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PromoDashboard;
