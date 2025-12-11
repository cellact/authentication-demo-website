import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Get all users
 */
export async function getAllUsers() {
  const response = await api.get('/users');
  return response.data.users;
}

/**
 * Get user by auth username
 */
export async function getUserByAuthUsername(authUsername) {
  const response = await api.get(`/users/${authUsername}`);
  return response.data.user;
}

/**
 * Add new user
 */
export async function addUser(userData) {
  const response = await api.post('/users', userData);
  return response.data.user;
}

/**
 * Delete user
 */
export async function deleteUser(authUsername) {
  const response = await api.delete(`/users/${authUsername}`);
  return response.data;
}

export default api;


