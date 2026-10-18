import { useState, useEffect } from 'react';

interface PluginsProps {
  token: string;
}

interface Plugin {
  id: string;
  name: string;
  location: string;
  code: string;
  enabled: boolean;
  onlyOnPaths?: string[];
  excludePaths?: string[];
}

export default function Plugins({ token }: PluginsProps) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Plugin | null>(null);
  const [form, setForm] = useState({
    name: '',
    location: 'header',
    code: '',
    onlyOnPaths: '',
    excludePaths: ''
  });

  useEffect(() => {
    fetchPlugins();
  }, [token]);

  const fetchPlugins = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/admin/plugins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setPlugins(data);
    } catch (err) {
      console.error('Failed to fetch plugins:', err);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', location: 'header', code: '', onlyOnPaths: '', excludePaths: '' });
    setShowModal(true);
  };

  const openEdit = (plugin: Plugin) => {
    setEditing(plugin);
    setForm({
      name: plugin.name,
      location: plugin.location,
      code: plugin.code,
      onlyOnPaths: plugin.onlyOnPaths?.join(', ') || '',
      excludePaths: plugin.excludePaths?.join(', ') || ''
    });
    setShowModal(true);
  };

  const savePlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: form.name,
      location: form.location,
      code: form.code,
      enabled: true,
      onlyOnPaths: form.onlyOnPaths ? form.onlyOnPaths.split(',').map(s => s.trim()) : undefined,
      excludePaths: form.excludePaths ? form.excludePaths.split(',').map(s => s.trim()) : undefined
    };

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const url = editing 
        ? `${apiUrl}/api/admin/plugins/${editing.id}`
        : `${apiUrl}/api/admin/plugins`;
      
      await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setShowModal(false);
      fetchPlugins();
    } catch (err) {
      console.error('Failed to save plugin:', err);
    }
  };

  const togglePlugin = async (id: string, enabled: boolean) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      await fetch(`${apiUrl}/api/admin/plugins/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !enabled })
      });
      fetchPlugins();
    } catch (err) {
      console.error('Failed to toggle plugin:', err);
    }
  };

  const deletePlugin = async (id: string) => {
    if (!confirm('Delete this plugin?')) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      await fetch(`${apiUrl}/api/admin/plugins/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPlugins();
    } catch (err) {
      console.error('Failed to delete plugin:', err);
    }
  };

  return (
    <div>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Plugins (HFCM Style)</h1>
        <button className="button button-success" onClick={openCreate}>Add New Plugin</button>
      </div>
      
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Paths</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {plugins.map(plugin => (
              <tr key={plugin.id}>
                <td>{plugin.name}</td>
                <td>{plugin.location}</td>
                <td style={{ fontSize: '0.75rem' }}>
                  {plugin.onlyOnPaths?.join(', ') || 'All Pages'}
                </td>
                <td>
                  <span className={plugin.enabled ? 'enabled' : 'disabled'}>
                    {plugin.enabled ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="button" onClick={() => openEdit(plugin)}>Edit</button>
                  <button 
                    className={plugin.enabled ? 'button' : 'button button-success'}
                    onClick={() => togglePlugin(plugin.id, plugin.enabled)}
                  >
                    {plugin.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="button button-danger" onClick={() => deletePlugin(plugin.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Plugin' : 'Add New Plugin'}</h2>
            <form onSubmit={savePlugin}>
              <label>Plugin Name</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />

              <label>Location</label>
              <select
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
              >
                <option value="header">Header (Inside &lt;head&gt;)</option>
                <option value="footer">Footer (Before &lt;/body&gt;)</option>
                <option value="after_body_open">After &lt;body&gt;</option>
              </select>

              <label>Code (JavaScript/HTML)</label>
              <textarea
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                rows={10}
                required
              />

              <label>Only on paths (comma-separated, e.g. /, /about)</label>
              <input
                value={form.onlyOnPaths}
                onChange={e => setForm({ ...form, onlyOnPaths: e.target.value })}
                placeholder="Leave empty for all pages"
              />

              <label>Exclude paths (comma-separated)</label>
              <input
                value={form.excludePaths}
                onChange={e => setForm({ ...form, excludePaths: e.target.value })}
                placeholder="Pages to exclude"
              />

              <div className="flex">
                <button type="submit" className="button button-success">Save Plugin</button>
                <button type="button" className="button" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
