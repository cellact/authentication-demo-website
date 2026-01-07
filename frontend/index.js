// Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// State
let currentUser = null; // Firebase user
let generatedUsername = null;
let isCreatingUser = false; // Double-submit protection

// DOM Elements
const authGate = document.getElementById('auth-gate');
const mainApp = document.getElementById('main-app');
const btnGoogleSignIn = document.getElementById('btn-google-signin');
const btnEmailSignIn = document.getElementById('btn-email-signin');
const btnSignOut = document.getElementById('btn-signout');
const btnHowItWorks = document.getElementById('btn-how-it-works');
const btnAdvancedInfo = document.getElementById('btn-advanced-info');
const btnBackToMain = document.getElementById('btn-back-to-main');
const mainView = document.getElementById('main-view');
const howItWorksView = document.getElementById('how-it-works-view');
const userEmailEl = document.getElementById('user-email');
const errorEl = document.getElementById('error');
const addUserForm = document.getElementById('add-user-form');
const btnSubmit = document.getElementById('btn-submit');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const creationStatus = document.getElementById('creation-status');
const successStatus = document.getElementById('success-status');
const emailModal = document.getElementById('email-modal');
const emailSignInForm = document.getElementById('email-signin-form');
const emailInput = document.getElementById('email-input');
const introScreen = document.getElementById('intro-screen');
const stepsContainer = document.getElementById('steps-container');
const btnStartProcess = document.getElementById('btn-start-process');
const btnBackToIntro = document.getElementById('btn-back-to-intro');
const btnCancelEmail = document.getElementById('btn-cancel-email');
const btnSendLink = document.getElementById('btn-send-link');
const emailStatus = document.getElementById('email-status');

// Step elements
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const step1Content = document.getElementById('step-1-content');
const step2Content = document.getElementById('step-2-content');
const step3Content = document.getElementById('step-3-content');

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
  btnEmailSignIn.addEventListener('click', showEmailModal);
  btnSignOut.addEventListener('click', handleSignOut);
  btnHowItWorks.addEventListener('click', showHowItWorks);
  btnAdvancedInfo.addEventListener('click', showHowItWorks);
  btnBackToMain.addEventListener('click', showMainView);
  addUserForm.addEventListener('submit', handleAddUser);
  emailSignInForm.addEventListener('submit', handleEmailSignIn);
  btnCancelEmail.addEventListener('click', hideEmailModal);
  btnStartProcess.addEventListener('click', startProcess);
  btnBackToIntro.addEventListener('click', backToIntro);
  togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
  
  // Make Step 1 clickable to start
  document.getElementById('step-1-header').addEventListener('click', () => {
    if (step1.classList.contains('locked')) return;
    if (!step1Content.classList.contains('expanded')) {
      step1Content.classList.add('expanded');
      document.getElementById('step-1-header').classList.add('active');
      document.getElementById('step-1-status').textContent = '';
      
      // Scroll to step 1 after a short delay to allow content to expand
      setTimeout(() => {
        step1.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  });
}

// Firebase Auth Functions
function initializeAuth() {
  // Check if user is returning from email link
  if (window.isSignInWithEmailLink(window.firebaseAuth, window.location.href)) {
    handleEmailLinkSignIn();
  }
  
  // Set up auth state monitoring
  window.onAuthStateChanged(window.firebaseAuth, (user) => {
    if (user) {
      // User is signed in
      currentUser = user;
      userEmailEl.textContent = user.email;
      authGate.style.display = 'none';
      mainApp.style.display = 'block';
      
      // Generate username immediately
      generatedUsername = generateUsername(user.email);
      document.getElementById('generated-username').textContent = generatedUsername;
    } else {
      // User is signed out
      currentUser = null;
      authGate.style.display = 'flex';
      mainApp.style.display = 'none';
    }
  });
}

async function handleEmailLinkSignIn() {
  let email = window.localStorage.getItem('emailForSignIn');
  
  if (!email) {
    // Ask user for email if not found in storage
    email = window.prompt('Please provide your email for confirmation');
  }
  
  if (!email) return;
  
  try {
    await window.signInWithEmailLink(window.firebaseAuth, email, window.location.href);
    window.localStorage.removeItem('emailForSignIn');
    console.log('Successfully signed in with email link');
  } catch (error) {
    console.error('Error signing in with email link:', error);
    alert('Failed to sign in with email link: ' + error.message);
  }
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

function showEmailModal() {
  emailModal.style.display = 'flex';
  emailInput.value = '';
  emailStatus.style.display = 'none';
  emailInput.focus();
}

function hideEmailModal() {
  emailModal.style.display = 'none';
}

// Close modal when clicking outside
emailModal.addEventListener('click', (e) => {
  if (e.target === emailModal) {
    hideEmailModal();
  }
});

async function handleEmailSignIn(e) {
  e.preventDefault();
  
  const email = emailInput.value.trim();
  if (!email) return;
  
  try {
    btnSendLink.disabled = true;
    btnSendLink.textContent = 'Sending...';
    
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true,
    };
    
    await window.sendSignInLinkToEmail(window.firebaseAuth, email, actionCodeSettings);
    
    // Save email to localStorage so we can use it after redirect
    window.localStorage.setItem('emailForSignIn', email);
    
    // Show success message
    emailStatus.className = 'email-status success';
    emailStatus.textContent = `✓ Sign-in link sent to ${email}! Check your inbox (including spam folder). You can close this window.`;
    emailStatus.style.display = 'block';
    
    // Clear form
    emailInput.value = '';
    
    // Don't auto-hide - let user close manually
    // User can click Cancel or click outside modal
    
  } catch (error) {
    console.error('Error sending sign-in link:', error);
    
    emailStatus.className = 'email-status error';
    emailStatus.textContent = error.message || 'Failed to send sign-in link';
    emailStatus.style.display = 'block';
  } finally {
    btnSendLink.disabled = false;
    btnSendLink.textContent = 'Send Link';
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
  const randomDigits = Math.floor(100 + Math.random() * 900); // 3 random digits (100-999)
  
  return `${cleanLocal}${domainWithoutTLD}${randomDigits}`.toLowerCase();
}

// No storage functions needed - everything sent via email

// UI Functions
function showError(message, autoHide = true) {
  // Reset to error styling (in case it was used for success)
  errorEl.style.background = '#fee';
  errorEl.style.color = '#c00';
  errorEl.style.borderColor = '#c00';
  
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  
  // Only auto-hide if specified (default true for backwards compatibility)
  if (autoHide) {
    // Longer timeout for longer messages
    const timeout = message.length > 50 ? 8000 : 5000;
    
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, timeout);
  }
  // If autoHide is false, error stays visible until user takes action
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

function startProcess() {
  introScreen.style.display = 'none';
  stepsContainer.style.display = 'block';
}

function backToIntro() {
  stepsContainer.style.display = 'none';
  introScreen.style.display = 'block';
  window.scrollTo(0, 0);
}

function togglePasswordVisibility() {
  const type = passwordInput.getAttribute('type');
  if (type === 'password') {
    passwordInput.setAttribute('type', 'text');
    togglePasswordBtn.textContent = '🙈';
  } else {
    passwordInput.setAttribute('type', 'password');
    togglePasswordBtn.textContent = '👁️';
  }
}

// Step Management Functions
function unlockAndExpandStep(stepNumber) {
  const step = document.getElementById(`step-${stepNumber}`);
  const content = document.getElementById(`step-${stepNumber}-content`);
  const status = document.getElementById(`step-${stepNumber}-status`);
  
  step.classList.remove('locked');
  content.classList.add('expanded');
  status.textContent = '';
  
  // Collapse previous step
  if (stepNumber > 1) {
    const prevContent = document.getElementById(`step-${stepNumber - 1}-content`);
    prevContent.classList.remove('expanded');
  }
  
  // Scroll to new step
  setTimeout(() => {
    step.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function markStepComplete(stepNumber) {
  const status = document.getElementById(`step-${stepNumber}-status`);
  status.textContent = 'Complete';
  status.style.color = '#6ba43a';
  status.style.fontWeight = '600';
}

// No user list rendering needed - credentials sent via email

// API Functions
async function handleAddUser(e) {
  e.preventDefault();
  
  // Double-submit protection
  if (isCreatingUser) {
    console.log('User creation already in progress');
    return;
  }
  
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
    // Set flag and disable button immediately
    isCreatingUser = true;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Creating...';
    
    // Mark step 1 complete and move to step 2
    markStepComplete(1);
    unlockAndExpandStep(2);
    
    // Show loading in step 2
    creationStatus.style.display = 'block';
    successStatus.style.display = 'none';
    
    // Call GCP function to create user on Oasis
    // Note: No timeout set - waits for full response (can take 10+ minutes)
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
        email: currentUser.email
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create user');
    }
    
    // Show success message in step 2
    creationStatus.style.display = 'none';
    successStatus.style.display = 'block';
    
    // Show "Continue" button to proceed to step 3
    document.getElementById('btn-continue-step3').style.display = 'inline-block';
    
  } catch (err) {
    console.error('Error creating user:', err);
    showError('An unexpected error has occurred during user creation. Please refresh the page and try again.', false);
    creationStatus.style.display = 'none';
    // DO NOT re-enable button - force user to refresh the page
    // Keep isCreatingUser = true and button disabled to prevent retry without refresh
    btnSubmit.textContent = 'Please Refresh Page';
  }
}

function resetCreationStatus() {
  creationStatus.style.display = 'none';
  successStatus.style.display = 'none';
  passwordInput.value = '';
}

function continueToStep3() {
  markStepComplete(2);
  unlockAndExpandStep(3);
  document.getElementById('btn-continue-step3').style.display = 'none';
}

// Make function available globally for onclick
window.continueToStep3 = continueToStep3;

// No delete function needed - credentials managed via email










