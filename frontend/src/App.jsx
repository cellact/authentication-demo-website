import { useState, useEffect } from 'react';
import UserList from './components/UserList';
import AddUserForm from './components/AddUserForm';
import { getAllUsers, addUser, deleteUser } from './api/userApi';
import './App.css';

function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

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
      setShowForm(false);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const handleDeleteUser = async (authUsername) => {
    if (!confirm(`Delete ${authUsername}?`)) return;
    
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
      <header>
        <h1>Authentication Demo</h1>
      </header>

      <main>
        {error && <div className="error">{error}</div>}

        <div className="panel">
          <h2>Your Accounts</h2>
          <UserList 
            users={users} 
            onDelete={handleDeleteUser}
            loading={loading}
          />
        </div>

        <div className="panel small">
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-create">
              Create New Account
            </button>
          ) : (
            <>
              <h3>New Account</h3>
              <AddUserForm 
                onSubmit={handleAddUser}
                onCancel={() => setShowForm(false)}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;


