import { useState, useEffect } from 'react';
import UserList from './components/UserList';
import AddUserForm from './components/AddUserForm';
import { getAllUsers, addUser, deleteUser } from './api/userApi';
import './App.css';

function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userData) => {
    try {
      setError(null);
      await addUser(userData);
      await loadUsers();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const handleDeleteUser = async (authUsername) => {
    if (!confirm(`Delete user ${authUsername}?`)) return;
    
    try {
      setError(null);
      await deleteUser(authUsername);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔐 Authentication Demo</h1>
        <p className="subtitle">Hoodi Network - Oasis Sapphire TEE Integration</p>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        <section className="section">
          <h2>Add New User</h2>
          <AddUserForm onSubmit={handleAddUser} />
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Users ({users.length})</h2>
            <button 
              onClick={loadUsers} 
              disabled={loading}
              className="btn-secondary"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <UserList 
            users={users} 
            onDelete={handleDeleteUser}
            loading={loading}
          />
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Backend: Express API → Frontend: React SPA
          <br />
          Oasis Sapphire (TEE) + Hoodi Network
        </p>
      </footer>
    </div>
  );
}

export default App;

