
import React, { useState } from 'react';
import { TrendHistoryItem, TrendDataPoint } from '../../types';

interface RawDataViewerProps {
    history: TrendHistoryItem[];
}

const RawDataViewer: React.FC<RawDataViewerProps> = ({ history }) => {
    const [filter, setFilter] = useState('');
    
    // Flatten all data points from all history items
    const allDataPoints = history.flatMap(entry => 
        entry.result.dataPoints.map(dp => ({
            ...dp,
            analysisDate: entry.date,
            query: entry.result.query
        }))
    );

    const filteredData = allDataPoints.filter(dp => 
        dp.label.toLowerCase().includes(filter.toLowerCase()) || 
        dp.category?.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="card">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h2>🗄️ База Данных (Raw Data)</h2>
                <input 
                    type="text" 
                    placeholder="Фильтр по товару..." 
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{padding: '8px', width: '250px'}}
                />
            </div>
            
            <p style={{color: '#7f8c8d', fontSize: '0.9em', marginBottom: '15px'}}>
                Здесь хранятся все накопленные данные из предыдущих отчетов. Это позволяет отслеживать динамику и изменения спроса во времени.
                Всего записей: {allDataPoints.length}.
            </p>

            <div className="trend-table-container" style={{maxHeight: '500px', overflowY: 'auto'}}>
                <table className="trend-table" style={{fontSize: '0.85em'}}>
                    <thead>
                        <tr>
                            <th>Дата Анализа</th>
                            <th>Товар / Продукт</th>
                            <th>Категория</th>
                            <th>Индекс Спроса</th>
                            <th>P(Роста)</th>
                            <th>Доверие (Trust)</th>
                            <th>Источник запроса</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length > 0 ? filteredData.map((row, idx) => (
                            <tr key={idx}>
                                <td>{row.analysisDate}</td>
                                <td style={{fontWeight: 'bold'}}>{row.label}</td>
                                <td>{row.category || '-'}</td>
                                <td>{row.value} / 100</td>
                                <td>{(row.metrics.growthProbability * 100).toFixed(0)}%</td>
                                <td>
                                    <span style={{
                                        color: row.metrics.trustScore > 0.8 ? 'green' : 'orange'
                                    }}>
                                        {(row.metrics.trustScore * 100).toFixed(0)}%
                                    </span>
                                </td>
                                <td style={{color: '#95a5a6'}}>{row.query || 'Авто-Скан'}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={7} style={{textAlign: 'center', padding: '20px'}}>Данных пока нет. Запустите анализ.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RawDataViewer;
