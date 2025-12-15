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
const btnClearAll = document.getElementById('btn-clear-all');
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
  btnClearAll.addEventListener('click', handleClearAllData);
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

async function handleClearAllData() {
  if (!confirm('⚠️ This will DELETE ALL users from the blockchain and clear all local data. Are you sure?')) {
    return;
  }

  // Disable button to prevent double-clicks
  btnClearAll.disabled = true;
  btnClearAll.textContent = 'Deleting...';

  try {
    const usersToDelete = [...users]; // Copy array
    
    if (usersToDelete.length === 0) {
      // No users to delete, just clear storage
      clearLocalData();
      alert('✅ All local data cleared!');
      window.location.reload();
      return;
    }

    console.log(`🗑️  Deleting ${usersToDelete.length} users from blockchain...`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Delete each user from the blockchain
    for (let i = 0; i < usersToDelete.length; i++) {
      const user = usersToDelete[i];
      btnClearAll.textContent = `Deleting ${i + 1}/${usersToDelete.length}...`;
      
      try {
        console.log(`📍 Deleting user: ${user.authUsername}`);
        
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Function-Name': 'deleteUser'
          },
          body: JSON.stringify({
            authUsername: user.authUsername
          })
        });

        const data = await response.json();

        if (data.success) {
          console.log(`✅ Deleted user: ${user.authUsername} (tx: ${data.txHash})`);
          successCount++;
        } else {
          console.error(`❌ Failed to delete ${user.authUsername}:`, data.error);
          failCount++;
        }
      } catch (error) {
        console.error(`❌ Error deleting ${user.authUsername}:`, error);
        failCount++;
      }
    }

    // Show summary
    console.log(`\n📊 Deletion Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    
    // Now clear all local data
    clearLocalData();
    
    // Show result to user
    if (failCount === 0) {
      alert(`✅ All ${successCount} users deleted successfully from blockchain!\n\nLocal data cleared. Page will reload.`);
    } else {
      alert(`⚠️ Deleted ${successCount} users successfully.\n${failCount} failed to delete.\n\nLocal data cleared anyway. Page will reload.`);
    }
    
    // Reload to ensure clean state
    window.location.reload();
    
  } catch (err) {
    console.error('Error clearing data:', err);
    showError('Failed to clear all data: ' + err.message);
    btnClearAll.disabled = false;
    btnClearAll.textContent = 'Clear All Data';
  }
}

function clearLocalData() {
  // Clear localStorage
  localStorage.clear();
  
  // Clear all cookies
  document.cookie.split(';').forEach(cookie => {
    const cookieName = cookie.split('=')[0].trim();
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    // Also try with domain
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
  });
  
  // Clear sessionStorage as well
  sessionStorage.clear();
  
  // Reset app state
  users = [];
  revealedPasswords.clear();
  
  console.log('✅ All local data cleared');
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
    // Get password from localStorage
    const users = JSON.parse(localStorage.getItem('registeredUsers')) || [];
    const user = users.find(u => u.authUsername === authUsername);
    
    if (!user || !user.password) {
      alert('Cannot delete user: password not found in local storage');
      return;
    }
    
    // Show loading state
    const deleteBtn = document.querySelector(`button[data-auth="${authUsername}"]`);
    const originalText = deleteBtn.textContent;
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'deleting...';
    
    // Call backend to delete user from Oasis (requires password)
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Function-Name': 'deleteUser' // Route to deleteUser function
      },
      body: JSON.stringify({
        authUsername,
        password: user.password
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

