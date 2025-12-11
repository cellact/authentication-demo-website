import { useState } from 'react';
import './UserList.css';

function UserList({ users, onDelete, loading }) {
  const [revealed, setRevealed] = useState({});

  const togglePassword = (authUsername) => {
    setRevealed(prev => ({
      ...prev,
      [authUsername]: !prev[authUsername]
    }));
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (users.length === 0) {
    return <div className="empty">No accounts yet</div>;
  }

  return (
    <table className="user-table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Auth Name</th>
          <th>Password</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.authUsername}>
            <td>{user.username}</td>
            <td>{user.authUsername}</td>
            <td>
              <span 
                onClick={() => togglePassword(user.authUsername)}
                className="password-toggle"
              >
                {revealed[user.authUsername] ? user.password : '••••••••'}
              </span>
            </td>
            <td>
              <button 
                onClick={() => onDelete(user.authUsername)}
                className="btn-delete"
              >
                delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default UserList;


