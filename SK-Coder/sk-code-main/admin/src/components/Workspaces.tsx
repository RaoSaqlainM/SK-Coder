import { useState, useEffect } from 'react';

interface WorkspacesProps {
  token: string;
}

interface Workspace {
  id: string;
  pool: string;
  quotaBytes: number;
  state: string;
  expiresAt: number;
  createdAt: number;
}

function formatBytes(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

export default function Workspaces({ token }: WorkspacesProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchWorkspaces();
  }, [token]);

  const fetchWorkspaces = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/admin/workspaces`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setWorkspaces(data);
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    }
  };

  const deleteWorkspace = async (id: string) => {
    if (!confirm('Delete this workspace?')) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      await fetch(`${apiUrl}/api/admin/workspace/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchWorkspaces();
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  const filtered = workspaces.filter(w => {
    if (filter === 'all') return true;
    return w.pool === filter;
  });

  return (
    <div>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Workspaces</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All</option>
          <option value="temporary">Temporary</option>
          <option value="persistent">Persistent</option>
        </select>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Pool</th>
              <th>Size</th>
              <th>State</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(ws => (
              <tr key={ws.id}>
                <td style={{ fontSize: '0.75rem' }}>{ws.id}</td>
                <td>{ws.pool}</td>
                <td>{formatBytes(ws.quotaBytes)}</td>
                <td>{ws.state}</td>
                <td>{ws.expiresAt === Infinity ? 'Never' : formatDate(ws.expiresAt)}</td>
                <td>
                  <button className="button button-danger" onClick={() => deleteWorkspace(ws.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
