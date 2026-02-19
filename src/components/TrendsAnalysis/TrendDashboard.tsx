
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { analyzeMarketTrends, generateDailyAnalyticsReport } from '../../services/geminiService';
import { downloadFile } from '../../utils/downloadFile';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_TREND_HISTORY_KEY } from '../../constants';
import ProcessLog from './ProcessLog';
import RawDataViewer from './RawDataViewer';
import type { TrendAnalysisResult, TimeRange, TrendHistoryItem } from '../../types';

type AnalyticsTab = 'dashboard' | 'raw_data';

const TrendDashboard: React.FC = () => {
    const [query, setQuery] = useState('');
    const [timeRange, setTimeRange] = useState<TimeRange>('24h');
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('dashboard');
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [currentLog, setCurrentLog] = useState<string>(''); // Для прозрачного процесса
    
    const [result, setResult] = useState<TrendAnalysisResult | null>(null);
    const [history, setHistory] = useLocalStorage<TrendHistoryItem[]>(LOCAL_STORAGE_TREND_HISTORY_KEY, []);
    
    const [error, setError] = useState<string | null>(null);
    const [reportHtml, setReportHtml] = useState<string | null>(null);
    
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setError(null);
        setReportHtml(null);
        setCurrentLog('Инициализация нейросети и подключение к поисковым индексам...');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const data = await analyzeMarketTrends({
                ai,
                userQuery: query,
                timeRange,
                history, // Передаем историю для агрегации
                onLogUpdate: (log) => setCurrentLog(log)
            });
            
            setResult(data);
            
            // Сохраняем в историю (накопительный эффект)
            const newHistoryItem: TrendHistoryItem = {
                id: Date.now().toString(),
                date: new Date().toLocaleString(),
                result: data
            };
            // Храним последние 50 отчетов
            setHistory(prev => [newHistoryItem, ...prev].slice(0, 50));
            
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsAnalyzing(false);
            setCurrentLog('');
        }
    };

    const handleCreateReport = async () => {
        if (!result) return;
        setIsGeneratingReport(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const html = await generateDailyAnalyticsReport(ai, result);
            setReportHtml(html);
        } catch (e: any) {
            alert("Ошибка создания отчета: " + e.message);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleDownloadReport = () => {
        if (!reportHtml) return;
        const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
        downloadFile(blob, `Analytics_Report_${timeRange}_${new Date().toISOString().split('T')[0]}.html`);
    };

    useEffect(() => {
        if (result && chartRef.current && activeTab === 'dashboard') {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }

            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                // @ts-ignore
                chartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: result.dataPoints.map(p => p.label),
                        datasets: [
                            {
                                type: 'bar',
                                label: 'Индекс Спроса (0-100)',
                                data: result.dataPoints.map(p => p.metrics.demandScore),
                                backgroundColor: 'rgba(52, 152, 219, 0.6)',
                                borderColor: 'rgba(52, 152, 219, 1)',
                                borderWidth: 1,
                                yAxisID: 'y'
                            },
                            {
                                type: 'line',
                                label: 'Вероятность роста (0-1)',
                                data: result.dataPoints.map(p => p.metrics.growthProbability),
                                borderColor: '#e74c3c',
                                borderWidth: 2,
                                tension: 0.4,
                                yAxisID: 'y1'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        scales: {
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                max: 100,
                                title: { display: true, text: 'Индекс спроса' }
                            },
                            y1: {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                max: 1.0,
                                grid: { drawOnChartArea: false },
                                title: { display: true, text: 'Вероятность (P)' }
                            },
                        }
                    }
                });
            }
        }
    }, [result, activeTab]);

    return (
        <div className="trend-dashboard">
            {/* Панель управления */}
            <div className="card">
                <h2>📈 Центр Автономной Аналитики v2.0</h2>
                
                <div style={{display: 'flex', gap: '15px', marginBottom: '15px'}}>
                    <button 
                        className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                        style={{backgroundColor: activeTab === 'dashboard' ? '#3498db' : '#ecf0f1', color: activeTab === 'dashboard' ? 'white' : '#333'}}
                    >
                        Дашборд
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'raw_data' ? 'active' : ''}`}
                        onClick={() => setActiveTab('raw_data')}
                        style={{backgroundColor: activeTab === 'raw_data' ? '#3498db' : '#ecf0f1', color: activeTab === 'raw_data' ? 'white' : '#333'}}
                    >
                        🗄️ База Данных (Raw Data)
                    </button>
                </div>

                {activeTab === 'dashboard' && (
                <div className="form-group">
                    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end'}}>
                        <div style={{flexGrow: 1}}>
                            <label>Фокус на товаре (или пусто для Авто-сканирования)</label>
                            <input 
                                type="text" 
                                value={query} 
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Например: Утеплитель, Кирпич"
                                disabled={isAnalyzing}
                            />
                        </div>
                        
                        <div style={{minWidth: '150px'}}>
                            <label>Период новостей</label>
                            <select 
                                value={timeRange} 
                                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                                disabled={isAnalyzing}
                            >
                                <option value="24h">24 Часа</option>
                                <option value="7d">7 Дней</option>
                                <option value="30d">30 Дней</option>
                                <option value="90d">Квартал</option>
                            </select>
                        </div>

                        <button 
                            onClick={handleAnalyze} 
                            disabled={isAnalyzing}
                            style={{ backgroundColor: isAnalyzing ? '#95a5a6' : '#2c3e50', color: 'white', marginBottom: '2px' }}
                        >
                            {isAnalyzing ? 'Идет анализ...' : '🚀 Запустить'}
                        </button>
                    </div>
                    
                    {/* Process Log Visualization */}
                    {isAnalyzing && <ProcessLog log={currentLog} />}

                    <small style={{display: 'block', marginTop: '10px', color: '#7f8c8d'}}>
                        Система автоматически фильтрует непроверенные источники и фокусируется только на физических товарах.
                    </small>
                </div>
                )}
                
                {error && <div className="error-message" style={{backgroundColor: '#ffebee', color: '#c0392b'}}>{error}</div>}
            </div>

            {activeTab === 'raw_data' ? (
                <RawDataViewer history={history} />
            ) : (
                <>
                    {result && (
                        <>
                            {/* Секция Новостей и Событий */}
                            <div className="card" style={{borderLeft: '5px solid #f1c40f'}}>
                                <h2>🌍 Проверенные Сигналы Рынка ({timeRange})</h2>
                                <div style={{display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'}}>
                                    {result.events.map((evt, idx) => (
                                        <div key={idx} style={{
                                            padding: '15px', 
                                            backgroundColor: '#f9f9f9', 
                                            borderRadius: '6px',
                                            border: '1px solid #eee',
                                            opacity: evt.sourceCredibility === 'low' ? 0.6 : 1
                                        }}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#7f8c8d', marginBottom: '5px'}}>
                                                <span>{evt.date}</span>
                                                <span style={{color: evt.sourceCredibility === 'high' ? 'green' : 'orange'}}>
                                                    Trust: {evt.sourceCredibility.toUpperCase()}
                                                </span>
                                            </div>
                                            <h4 style={{margin: '0 0 8px 0', color: '#2c3e50'}}>{evt.title}</h4>
                                            <p style={{fontSize: '0.9em', margin: '0 0 10px 0'}}>{evt.impact}</p>
                                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                                <span style={{
                                                    padding: '2px 8px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.8em',
                                                    fontWeight: 'bold',
                                                    backgroundColor: evt.sentiment === 'negative' ? '#ffcccc' : evt.sentiment === 'positive' ? '#ccffcc' : '#eee',
                                                    color: evt.sentiment === 'negative' ? '#c0392b' : evt.sentiment === 'positive' ? '#27ae60' : '#555'
                                                }}>
                                                    {evt.sentiment.toUpperCase()}
                                                </span>
                                                {evt.sourceUrl && <a href={evt.sourceUrl} target="_blank" rel="noreferrer" style={{fontSize: '0.8em'}}>Источник ↗</a>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Графики и Резюме */}
                            <div className="card">
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                                    <h2>📊 Аналитика Продуктов</h2>
                                    <button 
                                        onClick={handleCreateReport} 
                                        disabled={isGeneratingReport}
                                        style={{backgroundColor: '#27ae60', color: 'white'}}
                                    >
                                        {isGeneratingReport ? 'Пишем отчет...' : '📄 Сформировать Отчет'}
                                    </button>
                                </div>
                                
                                <p style={{fontStyle: 'italic', borderLeft: '3px solid #3498db', paddingLeft: '10px', color: '#555'}}>
                                    {result.mathAnalysisSummary}
                                </p>

                                <div className="chart-container" style={{marginTop: '20px'}}>
                                    <canvas ref={chartRef}></canvas>
                                </div>
                            </div>

                            {/* Детальная таблица с метриками */}
                            <div className="card">
                                <h2>Матрица Товаров (Данные за {timeRange})</h2>
                                <div className="trend-table-container">
                                    <table className="trend-table">
                                        <thead>
                                            <tr>
                                                <th>Товар (Product)</th>
                                                <th>Категория</th>
                                                <th>Индекс Спроса</th>
                                                <th>Изменение</th>
                                                <th>P(Роста)</th>
                                                <th>Волатильность</th>
                                                <th>Достоверность</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.dataPoints.map((p, i) => (
                                                <tr key={i}>
                                                    <td style={{fontWeight: 'bold'}}>{p.label}</td>
                                                    <td>{p.category}</td>
                                                    <td>
                                                        <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                                            {p.metrics.demandScore}
                                                            <div style={{width: '50px', height: '4px', backgroundColor: '#eee'}}>
                                                                <div style={{width: `${p.metrics.demandScore}%`, height: '100%', backgroundColor: '#3498db'}}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ color: p.change?.includes('+') ? 'green' : p.change?.includes('-') ? 'red' : 'black' }}>
                                                        {p.change}
                                                    </td>
                                                    <td>
                                                        <span style={{fontWeight: 'bold', color: p.metrics.growthProbability > 0.7 ? '#27ae60' : '#7f8c8d'}}>
                                                            {(p.metrics.growthProbability * 100).toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {p.metrics.volatilityIndex}/10
                                                    </td>
                                                    <td>
                                                         <span style={{color: p.metrics.trustScore > 0.8 ? 'green' : 'orange'}}>
                                                            {(p.metrics.trustScore * 100).toFixed(0)}%
                                                         </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Модальное окно отчета */}
            {reportHtml && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, 
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: 'white', width: '90%', maxWidth: '900px', height: '90%', 
                        borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        <div style={{padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h3 style={{margin: 0}}>Готовый Аналитический Отчет</h3>
                            <button onClick={() => setReportHtml(null)} style={{background: 'none', color: '#333', fontSize: '1.5em', padding: '0 10px'}}>×</button>
                        </div>
                        <div style={{flexGrow: 1, overflowY: 'auto', padding: '30px', fontFamily: 'serif', lineHeight: '1.8'}}>
                            <div dangerouslySetInnerHTML={{__html: reportHtml}} />
                        </div>
                        <div style={{padding: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                            <button onClick={() => setReportHtml(null)} style={{backgroundColor: '#95a5a6'}}>Закрыть</button>
                            <button onClick={handleDownloadReport} style={{backgroundColor: '#2980b9', color: 'white'}}>💾 Скачать HTML</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrendDashboard;
