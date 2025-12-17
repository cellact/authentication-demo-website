// Configuration
const API_URL = 'http://localhost:8080'; // Local backend (change to GCP function URL when deployed)
const STORAGE_KEY = 'oasis_auth_users';

// State
let users = [];
let revealedPasswords = new Set();
let currentUser = null; // Firebase user
let generatedUsername = null;

// DOM Elements
const authGate = document.getElementById('auth-gate');
const mainApp = document.getElementById('main-app');
const authMessageEl = document.getElementById('auth-message');
const magicLinkForm = document.getElementById('magic-link-form');
const emailInput = document.getElementById('email-input');
const btnSendLink = document.getElementById('btn-send-link');
const btnSignOut = document.getElementById('btn-signout');
const userEmailEl = document.getElementById('user-email');
const errorEl = document.getElementById('error');
const userListContainer = document.getElementById('user-list-container');
const btnShowForm = document.getElementById('btn-show-form');
const formContainer = document.getElementById('form-container');
const addUserForm = document.getElementById('add-user-form');
const btnCancel = document.getElementById('btn-cancel');
const btnSubmit = document.getElementById('btn-submit');
const btnClearAll = document.getElementById('btn-clear-all');
const passwordInput = document.getElementById('password');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Wait for Firebase to be ready
  setTimeout(() => {
    initializeAuth();
    attachEventListeners();
  }, 100);
});

// Event Listeners
function attachEventListeners() {
  magicLinkForm.addEventListener('submit', handleSendMagicLink);
  btnSignOut.addEventListener('click', handleSignOut);
  btnShowForm.addEventListener('click', showForm);
  btnCancel.addEventListener('click', hideForm);
  addUserForm.addEventListener('submit', handleAddUser);
  btnClearAll.addEventListener('click', handleClearAllData);
}

// Firebase Auth Functions
function initializeAuth() {
  // Set up auth state monitoring first
  window.onAuthStateChanged(window.firebaseAuth, (user) => {
    if (user) {
      // User is signed in
      currentUser = user;
      userEmailEl.textContent = user.email;
      authGate.style.display = 'none';
      mainApp.style.display = 'block';
      
      // Load user-specific data
      loadUsersFromStorage();
      renderUserList();
    } else {
      // User is signed out
      currentUser = null;
      authGate.style.display = 'flex';
      mainApp.style.display = 'none';
      users = [];
    }
  });
  
  // Check if user is coming back from magic link
  if (window.isSignInWithEmailLink(window.firebaseAuth, window.location.href)) {
    handleMagicLinkSignIn();
  }
}

async function handleSendMagicLink(e) {
  e.preventDefault();
  
  const email = emailInput.value.trim();
  if (!email) return;
  
  try {
    btnSendLink.disabled = true;
    btnSendLink.textContent = 'Sending...';
    
    const actionCodeSettings = {
      url: window.location.href, // Redirect back to this page
      handleCodeInApp: true,
    };
    
    await window.sendSignInLinkToEmail(window.firebaseAuth, email, actionCodeSettings);
    
    // Save email in localStorage to complete sign-in after redirect
    window.localStorage.setItem('emailForSignIn', email);
    
    // Show success message on auth gate
    showAuthMessage('Magic link sent! Check your email to sign in, this may take a few minutes.', 'success');
    emailInput.value = '';
  } catch (error) {
    console.error('Error sending magic link:', error);
    let errorMessage = 'Failed to send magic link';
    
    if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error.code === 'auth/missing-email') {
      errorMessage = 'Please enter an email address';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    showAuthMessage(errorMessage, 'error');
  } finally {
    btnSendLink.disabled = false;
    btnSendLink.textContent = 'Send Magic Link';
  }
}

async function handleMagicLinkSignIn() {
  let email = window.localStorage.getItem('emailForSignIn');
  
  if (!email) {
    // If user opened link on different device, ask for email
    email = window.prompt('Please provide your email for confirmation');
  }
  
  if (!email) {
    showAuthMessage('Email required to complete sign in', 'error');
    // Clean up URL even on error
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }
  
  try {
    const result = await window.signInWithEmailLink(window.firebaseAuth, email, window.location.href);
    
    // Clear email from storage
    window.localStorage.removeItem('emailForSignIn');
    
    // Clean up URL (remove magic link params)
    window.history.replaceState({}, document.title, window.location.pathname);
    
    console.log('Successfully signed in:', result.user.email);
  } catch (error) {
    console.error('Error completing sign in:', error);
    
    // Clean up URL even on error
    window.history.replaceState({}, document.title, window.location.pathname);
    
    let errorMessage = 'Failed to sign in';
    
    // Handle specific Firebase auth errors
    if (error.code === 'auth/invalid-action-code') {
      errorMessage = 'This magic link has already been used or is invalid. Please request a new one.';
    } else if (error.code === 'auth/expired-action-code') {
      errorMessage = 'This magic link has expired. Please request a new one.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address. Please check and try again.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    showAuthMessage(errorMessage, 'error');
  }
}

async function handleSignOut() {
  try {
    await window.signOut(window.firebaseAuth);
    users = [];
    revealedPasswords.clear();
  } catch (error) {
    console.error('Sign-out error:', error);
    showError('Failed to sign out: ' + error.message);
  }
}

function generateUsername(email) {
  const [localPart, domain] = email.split('@');
  const cleanLocal = localPart.replace(/\./g, ''); // remove dots
  const domainWithoutTLD = domain.split('.').slice(0, -1).join(''); // remove .com/.net/etc
  const randomDigits = Math.floor(10 + Math.random() * 90); // 2 random digits (10-99)
  
  return `${cleanLocal}${domainWithoutTLD}${randomDigits}`.toLowerCase();
}

// Storage Functions
function loadUsersFromStorage() {
  if (!currentUser || !currentUser.email) {
    users = [];
    return;
  }
  
  try {
    const userStorageKey = `${STORAGE_KEY}_${currentUser.email}`;
    const stored = localStorage.getItem(userStorageKey);
    users = stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Error loading from localStorage:', err);
    users = [];
  }
}

function saveUsersToStorage() {
  if (!currentUser || !currentUser.email) {
    return;
  }
  
  try {
    const userStorageKey = `${STORAGE_KEY}_${currentUser.email}`;
    localStorage.setItem(userStorageKey, JSON.stringify(users));
  } catch (err) {
    console.error('Error saving to localStorage:', err);
    showError('Failed to save to local storage');
  }
}

async function handleClearAllData() {
  if (!confirm('WARNING: This will DELETE ALL users from the Oasis Sapphire contract and clear all local data. Are you sure?')) {
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
      alert('All local data cleared!');
      window.location.reload();
      return;
    }

    console.log(`🗑️  Deleting ${usersToDelete.length} users from Oasis Sapphire contract...`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Delete each user from the Oasis Sapphire contract
    for (let i = 0; i < usersToDelete.length; i++) {
      const user = usersToDelete[i];
      btnClearAll.textContent = `Deleting ${i + 1}/${usersToDelete.length}...`;
      
      try {
        console.log(`Deleting user: ${user.authUsername}`);
        
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
          console.log(`Deleted user: ${user.authUsername} (tx: ${data.txHash})`);
          successCount++;
        } else {
          console.error(`Failed to delete ${user.authUsername}:`, data.error);
          failCount++;
        }
      } catch (error) {
        console.error(`Error deleting ${user.authUsername}:`, error);
        failCount++;
      }
    }

    // Show summary
    console.log(`\n📊 Deletion Summary:`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    
    // Now clear all local data
    clearLocalData();
    
    // Show result to user
    if (failCount === 0) {
      alert(`All ${successCount} users deleted successfully from Oasis Sapphire!\n\nLocal data cleared. Page will reload.`);
    } else {
      alert(`WARNING: Deleted ${successCount} users successfully.\n${failCount} failed to delete.\n\nLocal data cleared anyway. Page will reload.`);
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
  
  console.log('All local data cleared');
}

// UI Functions
function showError(message) {
  // Reset to error styling (in case it was used for success)
  errorEl.style.background = '#fee';
  errorEl.style.color = '#c00';
  errorEl.style.borderColor = '#c00';
  
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  
  // Longer timeout for longer messages
  const timeout = message.length > 50 ? 8000 : 5000;
  
  setTimeout(() => {
    errorEl.style.display = 'none';
  }, timeout);
}

function showAuthMessage(message, type = 'success') {
  authMessageEl.className = `auth-message ${type}`;
  authMessageEl.textContent = message;
  authMessageEl.style.display = 'block';
  
  // Longer timeout for longer messages
  const timeout = message.length > 50 ? 8000 : 5000;
  
  setTimeout(() => {
    authMessageEl.style.display = 'none';
  }, timeout);
}

function showForm() {
  if (!currentUser || !currentUser.email) {
    showError('Please sign in first');
    return;
  }
  
  // Generate username from email
  generatedUsername = generateUsername(currentUser.email);
  document.getElementById('generated-username').textContent = generatedUsername;
  
  btnShowForm.style.display = 'none';
  formContainer.style.display = 'block';
}

function hideForm() {
  formContainer.style.display = 'none';
  btnShowForm.style.display = 'block';
  addUserForm.reset();
  resetCreationStatus();
  generatedUsername = null;
  document.getElementById('generated-username').textContent = '-';
}

function renderUserList() {
  if (users.length === 0) {
    userListContainer.innerHTML = '<div class="empty">Press "Create New Account" to create a new account for free!</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'user-table';
  
  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Auth Username</th>
      <th>Username</th>
      <th>Password</th>
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
        <div class="password-cell">
          <span class="password-toggle" data-auth="${escapeHtml(user.authUsername)}">
            ${isRevealed ? escapeHtml(user.password) : '••••••••'}
          </span>
          <button class="btn-copy" data-password="${escapeHtml(user.password)}" title="Copy password">
            ⎘
          </button>
        </div>
      </td>
      <td>
        <button class="btn-delete" data-auth="${escapeHtml(user.authUsername)}">delete</button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  
  userListContainer.innerHTML = '';
  userListContainer.appendChild(table);
  
  // Attach event listeners for password toggle, copy, and delete
  userListContainer.querySelectorAll('.password-toggle').forEach(el => {
    el.addEventListener('click', (e) => {
      const authUsername = e.target.dataset.auth;
      togglePasswordReveal(authUsername);
    });
  });
  
  userListContainer.querySelectorAll('.btn-copy').forEach(el => {
    el.addEventListener('click', (e) => {
      const password = e.target.dataset.password;
      copyToClipboard(password);
    });
  });
  
  userListContainer.querySelectorAll('.btn-delete').forEach(el => {
    el.addEventListener('click', (e) => {
      const authUsername = e.target.dataset.auth;
      handleDeleteUser(authUsername);
    });
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show brief success feedback
    const errorEl = document.getElementById('error');
    errorEl.style.background = '#e8f5e9';
    errorEl.style.color = '#2e7d32';
    errorEl.style.borderColor = '#4caf50';
    errorEl.textContent = 'Password copied to clipboard!';
    errorEl.style.display = 'block';
    
    setTimeout(() => {
      errorEl.style.display = 'none';
      // Reset to error style
      errorEl.style.background = '#fee';
      errorEl.style.color = '#c00';
      errorEl.style.borderColor = '#c00';
    }, 1500);
  }).catch(err => {
    console.error('Failed to copy:', err);
    showError('Failed to copy password');
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
  
  if (!generatedUsername) {
    showError('Username not generated');
    return;
  }
  
  const username = generatedUsername;
  const password = passwordInput.value.trim();
  
  if (!password) {
    showError('Please enter a password');
    return;
  }
  
  // Check if user already exists
  if (users.some(u => u.authUsername === username)) {
    showError('You already have an account');
    return;
  }
  
  try {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Creating...';
    
    // Show loading status
    const statusEl = document.getElementById('creation-status');
    statusEl.style.display = 'block';
    
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
        domain: 'demo.hoodi.network',
        email: currentUser?.email || null
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
    resetCreationStatus();
  }
}

function resetCreationStatus() {
  const statusEl = document.getElementById('creation-status');
  if (statusEl) {
    statusEl.style.display = 'none';
  }
}

async function handleDeleteUser(authUsername) {
  if (!confirm(`Delete ${authUsername}? This will remove the user from the Oasis Sapphire contract.`)) {
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
    
    console.log('User deleted from Oasis:', data);
    
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

