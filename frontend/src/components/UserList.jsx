import React from 'react';
import './UserList.css';

function UserList({ users, onDelete, loading }) {
  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <p>No users yet. Add one above!</p>
      </div>
    );
  }

  return (
    <div className="user-list">
      {users.map((user) => (
        <div key={user.authUsername} className="user-card">
          <div className="user-card-header">
            <h3>{user.username}</h3>
            <button 
              onClick={() => onDelete(user.authUsername)}
              className="btn-delete"
              title="Delete user"
            >
              ✕
            </button>
          </div>
          
          <div className="user-details">
            <div className="detail-row">
              <span className="label">Auth Username:</span>
              <code>{user.authUsername}</code>
            </div>
            <div className="detail-row">
              <span className="label">Username:</span>
              <code>{user.username}</code>
            </div>
            <div className="detail-row">
              <span className="label">Password:</span>
              <code>{user.password}</code>
            </div>
            {user.domain && (
              <div className="detail-row">
                <span className="label">Domain:</span>
                <code>{user.domain}</code>
              </div>
            )}
            {user.createdAt && (
              <div className="detail-row">
                <span className="label">Created:</span>
                <span>{new Date(user.createdAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default UserList;

