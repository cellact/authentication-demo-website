import { useState } from 'react';
import './AddUserForm.css';

function AddUserForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        username: formData.username,
        password: formData.password,
        authUsername: formData.username,
        domain: 'demo.hoodi.network'
      });
    } catch (err) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div>
        <label>Username</label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          disabled={submitting}
        />
      </div>

      <div>
        <label>Password</label>
        <input
          type="text"
          name="password"
          value={formData.password}
          onChange={handleChange}
          disabled={submitting}
        />
      </div>

      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default AddUserForm;


