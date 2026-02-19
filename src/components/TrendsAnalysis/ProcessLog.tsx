
import React, { useEffect, useRef } from 'react';

interface ProcessLogProps {
    log: string;
}

const ProcessLog: React.FC<ProcessLogProps> = ({ log }) => {
    return (
        <div style={{
            fontFamily: "'Courier New', Courier, monospace",
            backgroundColor: '#1e1e1e',
            color: '#00ff00',
            padding: '15px',
            borderRadius: '6px',
            marginTop: '10px',
            border: '1px solid #333',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        }}>
            <span className="loading-spinner" style={{ borderColor: '#333', borderTopColor: '#00ff00' }}></span>
            <div>
                <span style={{ opacity: 0.7, marginRight: '10px' }}>[AI_CORE_PROCESS]:</span>
                <span className="typewriter-text">{log}</span>
            </div>
            <style>{`
                .typewriter-text {
                    overflow: hidden;
                    white-space: nowrap;
                    animation: typing 1s steps(40, end);
                }
            `}</style>
        </div>
    );
};

export default ProcessLog;
