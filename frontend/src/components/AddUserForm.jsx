import { useState } from 'react';
import './AddUserForm.css';

function AddUserForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    authUsername: '',
    username: '',
    password: '',
    domain: 'demo.hoodi.network'
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
    
    if (!formData.authUsername || !formData.username || !formData.password) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(formData);
      
      // Reset form
      setFormData({
        authUsername: '',
        username: '',
        password: '',
        domain: 'demo.hoodi.network'
      });
    } catch (err) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-user-form">
      <div className="form-group">
        <label htmlFor="authUsername">
          Auth Username <span className="required">*</span>
        </label>
        <input
          type="text"
          id="authUsername"
          name="authUsername"
          value={formData.authUsername}
          onChange={handleChange}
          placeholder="e.g., user123"
          required
          disabled={submitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="username">
          Username <span className="required">*</span>
        </label>
        <input
          type="text"
          id="username"
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="e.g., john_doe"
          required
          disabled={submitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">
          Password <span className="required">*</span>
        </label>
        <input
          type="text"
          id="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter password"
          required
          disabled={submitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="domain">Domain</label>
        <input
          type="text"
          id="domain"
          name="domain"
          value={formData.domain}
          onChange={handleChange}
          placeholder="demo.hoodi.network"
          disabled={submitting}
        />
      </div>

      <button 
        type="submit" 
        className="btn-primary"
        disabled={submitting}
      >
        {submitting ? 'Adding...' : 'Add User'}
      </button>
    </form>
  );
}

export default AddUserForm;

