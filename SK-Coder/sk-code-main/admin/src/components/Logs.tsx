import { useState, useEffect } from 'react';

interface LogsProps {
  token: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export default function Logs({ token }: LogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchLogs = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/admin/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  return (
    <div>
      <h1>Logs</h1>
      <div className="card">
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.75rem',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          {logs.map((log, i) => (
            <div key={i} style={{ 
              padding: '0.25rem 0',
              borderBottom: '1px solid #2a2a2a',
              color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : '#9ca3af'
            }}>
              <span style={{ color: '#6b7280' }}>[{log.timestamp}]</span>
              {' '}
              <span style={{ fontWeight: 'bold' }}>[{log.level}]</span>
              {' '}
              {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
