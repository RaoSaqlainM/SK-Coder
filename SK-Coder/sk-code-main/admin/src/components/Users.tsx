import { useState, useEffect } from 'react';

interface UsersProps {
  token: string;
}

interface User {
  id: string;
  workspaces: number;
  totalBytes: number;
}

function formatBytes(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

export default function Users({ token }: UsersProps) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Delete all data for this user?')) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      await fetch(`${apiUrl}/api/admin/user/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  return (
    <div>
      <h1>Users</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Workspaces</th>
              <th>Total Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.workspaces}</td>
                <td>{formatBytes(user.totalBytes)}</td>
                <td>
                  <button className="button button-danger" onClick={() => deleteUser(user.id)}>
                    Delete All Data
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
