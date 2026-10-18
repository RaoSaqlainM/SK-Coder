import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Workspaces from './components/Workspaces';
import Users from './components/Users';
import Plugins from './components/Plugins';
import Logs from './components/Logs';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));

  useEffect(() => {
    const stored = localStorage.getItem('admin_token');
    if (stored) {
      setToken(stored);
    }
  }, []);

  const handleLogin = (newToken: string) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="container">
        <div className="nav">
          <a href="/">Dashboard</a>
          <a href="/workspaces">Workspaces</a>
          <a href="/users">Users</a>
          <a href="/plugins">Plugins</a>
          <a href="/logs">Logs</a>
          <a href="#" onClick={handleLogout} style={{ marginLeft: 'auto' }}>Logout</a>
        </div>
        <Routes>
          <Route path="/" element={<Dashboard token={token} />} />
          <Route path="/workspaces" element={<Workspaces token={token} />} />
          <Route path="/users" element={<Users token={token} />} />
          <Route path="/plugins" element={<Plugins token={token} />} />
          <Route path="/logs" element={<Logs token={token} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
