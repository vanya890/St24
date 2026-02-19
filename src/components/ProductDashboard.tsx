
import React, { useState } from 'react';
import { ProductFeedData, ProductGenerationCounts } from '../types';

interface ProductDashboardProps {
    feedData: ProductFeedData | null;
    generationCounts: ProductGenerationCounts;
    feedUrl: string;
    setFeedUrl: (url: string) => void;
    onLoadFeed: () => void;
    onFileUpload: (file: File) => void; // New prop for file handling
    isLoading: boolean;
    error: string | null;
    downloadProgress?: { percent: number, loaded: number, total: number | null } | null;
}

const ProductDashboard: React.FC<ProductDashboardProps> = ({
    feedData,
    generationCounts,
    feedUrl,
    setFeedUrl,
    onLoadFeed,
    onFileUpload,
    isLoading,
    error,
    downloadProgress
}) => {
    const [filter, setFilter] = useState('');

    const offers = feedData?.offers || [];
    const filteredOffers = offers.filter(o => o.name.toLowerCase().includes(filter.toLowerCase()));

    // Статистика
    const totalOffers = offers.length;
    const coveredOffers = offers.filter(o => (generationCounts[o.id] || 0) > 0).length;
    const coveragePercent = totalOffers > 0 ? ((coveredOffers / totalOffers) * 100).toFixed(1) : 0;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileUpload(e.target.files[0]);
            // Clear input so same file can be selected again if needed
            e.target.value = '';
        }
    };

    // Проверяем, является ли ошибка связанной с загрузкой по URL
    const isUrlFetchError = error && error.includes('не удалось загрузить');

    return (
        <div className="card">
            <h2>📦 Управление Товарным Фидом</h2>
            
            <div className="form-group" style={{marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '20px'}}>
                <label>Способ 1: Загрузка по ссылке (URL)</label>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                            type="text" 
                            value={feedUrl}
                            onChange={(e) => setFeedUrl(e.target.value)}
                            placeholder="https://site.ru/marketplace/feed.xml"
                            disabled={isLoading}
                        />
                        <button 
                            onClick={onLoadFeed} 
                            disabled={isLoading || !feedUrl}
                            style={{ backgroundColor: '#e67e22', minWidth: '150px' }}
                        >
                            {isLoading ? 'Загрузка...' : 'Скачать по URL'}
                        </button>
                    </div>

                    {/* Progress Bar for URL download */}
                    {isLoading && downloadProgress && (
                        <div style={{ width: '100%', marginTop: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', color: '#666', marginBottom: '2px' }}>
                                <span>Скачивание (Параллельный режим)...</span>
                                <span>
                                    {formatBytes(downloadProgress.loaded)} 
                                    {downloadProgress.total ? ` / ${formatBytes(downloadProgress.total)}` : ''}
                                </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', backgroundColor: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ 
                                    width: `${downloadProgress.total ? downloadProgress.percent : (downloadProgress.loaded > 0 ? 100 : 0)}%`, 
                                    height: '100%', 
                                    backgroundColor: '#3498db',
                                    transition: 'width 0.3s ease',
                                    animation: !downloadProgress.total ? 'indeterminate 2s infinite linear' : 'none'
                                }}></div>
                            </div>
                            {!downloadProgress.total && (
                                <style>{`
                                    @keyframes indeterminate {
                                        0% { transform: translateX(-100%); }
                                        100% { transform: translateX(100%); }
                                    }
                                `}</style>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', margin: '15px 0' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.9em', fontWeight: 500 }}>ИЛИ</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
                </div>

                <label>Способ 2: Загрузка файла с компьютера (.xml, .yml)</label>
                <div style={{ marginTop: '5px', border: isUrlFetchError ? '2px solid #27ae60' : '1px dashed #3498db', padding: '10px', borderRadius: '6px', backgroundColor: isUrlFetchError ? '#e8f8f5' : '#f0f8ff' }}>
                    {isUrlFetchError && (
                        <div style={{marginBottom: '10px', color: '#27ae60', fontWeight: 'bold'}}>
                            👇 Попробуйте скачать файл вручную и загрузить его здесь:
                        </div>
                    )}
                    <input 
                        type="file" 
                        accept=".xml,.yml"
                        onChange={handleFileChange}
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            cursor: 'pointer'
                        }}
                    />
                    {!isUrlFetchError && (
                        <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                            Используйте этот способ, если прямая ссылка блокируется политиками CORS или защиты сайта.
                        </small>
                    )}
                </div>

                {error && <div className="error-message" style={{marginTop: '10px', backgroundColor: '#ffebee', color: '#c0392b', whiteSpace: 'pre-line'}}>{error}</div>}
            </div>

            {feedData ? (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                        <div style={{ backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '8px' }}>
                            <div style={{fontSize: '0.9em', color: '#7f8c8d'}}>Магазин</div>
                            <div style={{fontWeight: 'bold', fontSize: '1.2em'}}>{feedData.company}</div>
                            <div style={{fontSize: '0.8em', color: '#999'}}>{feedData.url}</div>
                        </div>
                        <div style={{ backgroundColor: '#f0fff4', padding: '15px', borderRadius: '8px' }}>
                            <div style={{fontSize: '0.9em', color: '#7f8c8d'}}>Всего товаров</div>
                            <div style={{fontWeight: 'bold', fontSize: '1.2em'}}>{totalOffers}</div>
                            <div style={{fontSize: '0.8em', color: '#999'}}>Дата фида: {new Date(feedData.date).toLocaleDateString()}</div>
                        </div>
                        <div style={{ backgroundColor: '#fff0f6', padding: '15px', borderRadius: '8px' }}>
                            <div style={{fontSize: '0.9em', color: '#7f8c8d'}}>Покрытие статьями</div>
                            <div style={{fontWeight: 'bold', fontSize: '1.2em'}}>{coveragePercent}%</div>
                            <div style={{fontSize: '0.8em', color: '#999'}}>{coveredOffers} товаров описано</div>
                        </div>
                    </div>

                    <div style={{marginBottom: '10px'}}>
                         <input 
                            type="text" 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Поиск товара по названию..."
                            style={{width: '100%', padding: '10px'}}
                        />
                    </div>

                    <div className="trend-table-container" style={{maxHeight: '600px', overflowY: 'auto'}}>
                        <table className="trend-table">
                            <thead>
                                <tr>
                                    <th>Товар</th>
                                    <th>Цена</th>
                                    <th>Категория (ID)</th>
                                    <th>Статей создано</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOffers.length > 0 ? filteredOffers.slice(0, 100).map(offer => {
                                    const count = generationCounts[offer.id] || 0;
                                    return (
                                        <tr key={offer.id} style={{backgroundColor: count > 0 ? '#f0fff4' : 'white'}}>
                                            <td>
                                                <div style={{fontWeight: 'bold'}}>{offer.name}</div>
                                                <div style={{fontSize: '0.85em', color: '#7f8c8d'}}>ID: {offer.id}</div>
                                            </td>
                                            <td>{offer.price} {offer.currencyId}</td>
                                            <td>{offer.categoryId}</td>
                                            <td style={{textAlign: 'center', fontWeight: 'bold', fontSize: '1.1em'}}>
                                                {count}
                                            </td>
                                            <td>
                                                {count > 0 
                                                    ? <span style={{color: 'green', fontWeight: 'bold'}}>Описан</span> 
                                                    : <span style={{color: '#e67e22'}}>В очереди</span>
                                                }
                                            </td>
                                            <td>
                                                <a href={offer.url} target="_blank" rel="noreferrer" style={{fontSize: '0.9em', color: '#3498db'}}>На сайт ↗</a>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={6} style={{textAlign: 'center'}}>Товары не найдены</td></tr>
                                )}
                                {filteredOffers.length > 100 && (
                                    <tr><td colSpan={6} style={{textAlign: 'center', color: '#7f8c8d'}}>...и еще {filteredOffers.length - 100} товаров (показаны первые 100)</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div style={{textAlign: 'center', padding: '40px', color: '#7f8c8d'}}>
                    Фид еще не загружен. Введите URL выше или загрузите файл.
                </div>
            )}
        </div>
    );
};

export default ProductDashboard;
