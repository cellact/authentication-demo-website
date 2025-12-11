// Configuration
const API_URL = 'http://localhost:8080'; // Local backend (change to GCP function URL when deployed)
const STORAGE_KEY = 'oasis_auth_users';

// State
let users = [];
let revealedPasswords = new Set();

// DOM Elements
const errorEl = document.getElementById('error');
const userListContainer = document.getElementById('user-list-container');
const btnShowForm = document.getElementById('btn-show-form');
const formContainer = document.getElementById('form-container');
const addUserForm = document.getElementById('add-user-form');
const btnCancel = document.getElementById('btn-cancel');
const btnSubmit = document.getElementById('btn-submit');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadUsersFromStorage();
  renderUserList();
  attachEventListeners();
});

// Event Listeners
function attachEventListeners() {
  btnShowForm.addEventListener('click', showForm);
  btnCancel.addEventListener('click', hideForm);
  addUserForm.addEventListener('submit', handleAddUser);
}

// Storage Functions
function loadUsersFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    users = stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Error loading from localStorage:', err);
    users = [];
  }
}

function saveUsersToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Error saving to localStorage:', err);
    showError('Failed to save to local storage');
  }
}

// UI Functions
function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  setTimeout(() => {
    errorEl.style.display = 'none';
  }, 5000);
}

function showForm() {
  btnShowForm.style.display = 'none';
  formContainer.style.display = 'block';
}

function hideForm() {
  formContainer.style.display = 'none';
  btnShowForm.style.display = 'block';
  addUserForm.reset();
}

function renderUserList() {
  if (users.length === 0) {
    userListContainer.innerHTML = '<div class="empty">No accounts yet</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'user-table';
  
  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Username</th>
      <th>ENS Domain</th>
      <th>Password</th>
      <th>Tx Hash (Oasis)</th>
      <th></th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Body
  const tbody = document.createElement('tbody');
  users.forEach(user => {
    const tr = document.createElement('tr');
    const isRevealed = revealedPasswords.has(user.authUsername);
    
    tr.innerHTML = `
      <td>${escapeHtml(user.username)}</td>
      <td><small>${user.ensSubdomain ? escapeHtml(user.ensSubdomain) : escapeHtml(user.authUsername)}</small></td>
      <td>
        <span class="password-toggle" data-auth="${escapeHtml(user.authUsername)}">
          ${isRevealed ? escapeHtml(user.password) : '••••••••'}
        </span>
      </td>
      <td>${user.txHash ? `<small>${escapeHtml(user.txHash.substring(0, 10))}...</small>` : '-'}</td>
      <td>
        <button class="btn-delete" data-auth="${escapeHtml(user.authUsername)}">delete</button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  
  userListContainer.innerHTML = '';
  userListContainer.appendChild(table);
  
  // Attach event listeners for password toggle and delete
  userListContainer.querySelectorAll('.password-toggle').forEach(el => {
    el.addEventListener('click', (e) => {
      const authUsername = e.target.dataset.auth;
      togglePasswordReveal(authUsername);
    });
  });
  
  userListContainer.querySelectorAll('.btn-delete').forEach(el => {
    el.addEventListener('click', (e) => {
      const authUsername = e.target.dataset.auth;
      handleDeleteUser(authUsername);
    });
  });
}

function togglePasswordReveal(authUsername) {
  if (revealedPasswords.has(authUsername)) {
    revealedPasswords.delete(authUsername);
  } else {
    revealedPasswords.add(authUsername);
  }
  renderUserList();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// API Functions
async function handleAddUser(e) {
  e.preventDefault();
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!username || !password) {
    showError('Please fill in all fields');
    return;
  }
  
  // Check if user already exists
  if (users.some(u => u.authUsername === username)) {
    showError('User already exists');
    return;
  }
  
  try {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Creating...';
    
    // Call GCP function to create user on Oasis
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        authUsername: username,
        domain: 'demo.hoodi.network'
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create user');
    }
    
    // Add user to local storage
    const newUser = {
      username,
      authUsername: username,
      password,
      domain: 'demo.hoodi.network',
      txHash: data.oasis?.txHash || data.txHash, // Support both old and new response formats
      userAddress: data.oasis?.userAddress,
      ensSubdomain: data.ens?.subdomain,
      ensTxHash: data.ens?.txHash,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsersToStorage();
    renderUserList();
    hideForm();
    
  } catch (err) {
    console.error('Error creating user:', err);
    showError(err.message || 'Failed to create user');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Create';
  }
}

async function handleDeleteUser(authUsername) {
  if (!confirm(`Delete ${authUsername}? This will remove the user from Oasis blockchain.`)) {
    return;
  }
  
  try {
    // Show loading state
    const deleteBtn = document.querySelector(`button[data-auth="${authUsername}"]`);
    const originalText = deleteBtn.textContent;
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'deleting...';
    
    // Call backend to delete user from Oasis
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Function-Name': 'deleteUser' // Route to deleteUser function
      },
      body: JSON.stringify({
        authUsername
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete user');
    }
    
    console.log('✅ User deleted from Oasis:', data);
    
    // Remove from local storage
    users = users.filter(u => u.authUsername !== authUsername);
    revealedPasswords.delete(authUsername);
    saveUsersToStorage();
    renderUserList();
    
  } catch (err) {
    console.error('Error deleting user:', err);
    showError(err.message || 'Failed to delete user');
    
    // Re-enable button on error
    const deleteBtn = document.querySelector(`button[data-auth="${authUsername}"]`);
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'delete';
    }
  }
}

