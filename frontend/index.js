// Configuration
const API_URL = 'http://localhost:8080'; // Local backend (change to GCP function URL when deployed)

// State
let currentUser = null; // Firebase user
let generatedUsername = null;

// DOM Elements
const authGate = document.getElementById('auth-gate');
const mainApp = document.getElementById('main-app');
const btnGoogleSignIn = document.getElementById('btn-google-signin');
const btnSignOut = document.getElementById('btn-signout');
const btnHowItWorks = document.getElementById('btn-how-it-works');
const btnAdvancedInfo = document.getElementById('btn-advanced-info');
const btnBackToMain = document.getElementById('btn-back-to-main');
const mainView = document.getElementById('main-view');
const howItWorksView = document.getElementById('how-it-works-view');
const userEmailEl = document.getElementById('user-email');
const errorEl = document.getElementById('error');
const btnShowForm = document.getElementById('btn-show-form');
const formContainer = document.getElementById('form-container');
const addUserForm = document.getElementById('add-user-form');
const btnCancel = document.getElementById('btn-cancel');
const btnSubmit = document.getElementById('btn-submit');
const passwordInput = document.getElementById('password');
const creationStatus = document.getElementById('creation-status');
const successStatus = document.getElementById('success-status');

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
  btnGoogleSignIn.addEventListener('click', handleGoogleSignIn);
  btnSignOut.addEventListener('click', handleSignOut);
  btnHowItWorks.addEventListener('click', showHowItWorks);
  btnAdvancedInfo.addEventListener('click', showHowItWorks);
  btnBackToMain.addEventListener('click', showMainView);
  btnShowForm.addEventListener('click', showForm);
  btnCancel.addEventListener('click', hideForm);
  addUserForm.addEventListener('submit', handleAddUser);
}

// Firebase Auth Functions
function initializeAuth() {
  // Set up auth state monitoring
  window.onAuthStateChanged(window.firebaseAuth, (user) => {
    if (user) {
      // User is signed in
      currentUser = user;
      userEmailEl.textContent = user.email;
      authGate.style.display = 'none';
      mainApp.style.display = 'block';
    } else {
      // User is signed out
      currentUser = null;
      authGate.style.display = 'flex';
      mainApp.style.display = 'none';
    }
  });
}

async function handleGoogleSignIn() {
  try {
    btnGoogleSignIn.disabled = true;
    btnGoogleSignIn.textContent = 'Signing in...';
    
    const result = await window.signInWithPopup(window.firebaseAuth, window.googleProvider);
    console.log('Successfully signed in:', result.user.email);
  } catch (error) {
    console.error('Error signing in with Google:', error);
    
    let errorMessage = 'Failed to sign in with Google';
    
    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in popup was closed';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Sign-in popup was blocked by your browser';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage = 'Sign-in was cancelled';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    alert(errorMessage);
  } finally {
    btnGoogleSignIn.disabled = false;
    btnGoogleSignIn.textContent = 'Sign in with Google';
  }
}

async function handleSignOut() {
  try {
    await window.signOut(window.firebaseAuth);
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

// No storage functions needed - everything sent via email

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

function showHowItWorks() {
  mainView.style.display = 'none';
  howItWorksView.style.display = 'block';
  window.scrollTo(0, 0);
}

function showMainView() {
  howItWorksView.style.display = 'none';
  mainView.style.display = 'block';
  window.scrollTo(0, 0);
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

// No user list rendering needed - credentials sent via email

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
  
  try {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Creating...';
    
    // Show loading status
    creationStatus.style.display = 'block';
    successStatus.style.display = 'none';
    
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
    
    // Show success message
    creationStatus.style.display = 'none';
    successStatus.style.display = 'block';
    
    // Reset form after a delay
    setTimeout(() => {
      hideForm();
      resetCreationStatus();
    }, 12000);
    
  } catch (err) {
    console.error('Error creating user:', err);
    showError(err.message || 'Failed to create user');
    creationStatus.style.display = 'none';
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Create';
  }
}

function resetCreationStatus() {
  creationStatus.style.display = 'none';
  successStatus.style.display = 'none';
  passwordInput.value = '';
}

// No delete function needed - credentials managed via email








