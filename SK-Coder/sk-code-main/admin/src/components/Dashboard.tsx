import { useState, useEffect } from 'react';

interface DashboardProps {
  token: string;
}

interface CapacityInfo {
  tempPool: { used: number; total: number; workspaces: number };
  persistentPool: { used: number; total: number; workspaces: number };
  queue: { length: number };
}

function formatBytes(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

export default function Dashboard({ token }: DashboardProps) {
  const [capacity, setCapacity] = useState<CapacityInfo | null>(null);

  useEffect(() => {
    fetchCapacity();
  }, [token]);

  const fetchCapacity = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/admin/capacity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setCapacity(data);
    } catch (err) {
      console.error('Failed to fetch capacity:', err);
    }
  };

  if (!capacity) {
    return <div className="card">Loading...</div>;
  }

  const tempPercent = (capacity.tempPool.used / capacity.tempPool.total) * 100;
  const persistentPercent = (capacity.persistentPool.used / capacity.persistentPool.total) * 100;

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="grid">
        <div className="card">
          <div className="stat-label">Temporary Pool</div>
          <div className="stat">{formatBytes(capacity.tempPool.used)} / {formatBytes(capacity.tempPool.total)}</div>
          <div style={{ background: '#2a2a2a', height: '8px', borderRadius: '4px', marginTop: '0.5rem' }}>
            <div style={{ background: '#3b82f6', width: `${tempPercent}%`, height: '100%', borderRadius: '4px' }} />
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
            {capacity.tempPool.workspaces} workspaces
          </div>
        </div>
        
        <div className="card">
          <div className="stat-label">Persistent Pool</div>
          <div className="stat">{formatBytes(capacity.persistentPool.used)} / {formatBytes(capacity.persistentPool.total)}</div>
          <div style={{ background: '#2a2a2a', height: '8px', borderRadius: '4px', marginTop: '0.5rem' }}>
            <div style={{ background: '#10b981', width: `${persistentPercent}%`, height: '100%', borderRadius: '4px' }} />
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
            {capacity.persistentPool.workspaces} workspaces
          </div>
        </div>
        
        <div className="card">
          <div className="stat-label">Queue Length</div>
          <div className="stat">{capacity.queue.length}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
            Users waiting for workspace
          </div>
        </div>
      </div>
    </div>
  );
}
