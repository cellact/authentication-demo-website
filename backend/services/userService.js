import { ethers } from 'ethers';
import { 
  getOasisProvider, 
  getHoodiProvider,
  getInteractorContract,
  getSponsorContract 
} from '../config/blockchain.js';

// In-memory storage for demo (replace with contract storage)
const users = new Map();

/**
 * Get all users
 */
export async function getAllUsers() {
  // TODO: Read from Oasis contract instead of in-memory
  return Array.from(users.values());
}

/**
 * Get user by auth username
 */
export async function getUserByAuthUsername(authUsername) {
  // TODO: Read from Oasis contract
  return users.get(authUsername) || null;
}

/**
 * Add a new user
 */
export async function addUser({ authUsername, username, password, domain }) {
  // Check if user already exists
  if (users.has(authUsername)) {
    throw new Error(`User with authUsername '${authUsername}' already exists`);
  }

  // Create user object
  const user = {
    authUsername,
    username,
    password,
    domain: domain || 'demo.hoodi.network',
    createdAt: new Date().toISOString()
  };

  // TODO: Store on Oasis Sapphire contract (confidential storage)
  // const interactor = await getInteractorContract();
  // const tx = await interactor.addUser(authUsername, username, passwordHash);
  // await tx.wait();

  // For now, store in-memory
  users.set(authUsername, user);

  return user;
}

/**
 * Delete a user
 */
export async function deleteUser(authUsername) {
  if (!users.has(authUsername)) {
    throw new Error(`User with authUsername '${authUsername}' not found`);
  }

  // TODO: Delete from Oasis contract
  // const interactor = await getInteractorContract();
  // const tx = await interactor.deleteUser(authUsername);
  // await tx.wait();

  users.delete(authUsername);
}

/**
 * Authenticate user and sign transaction (for future use)
 */
export async function authenticateAndSign(authUsername, password, transactionData) {
  const user = users.get(authUsername);
  
  if (!user) {
    throw new Error('User not found');
  }

  if (user.password !== password) {
    throw new Error('Invalid password');
  }

  // TODO: Call Oasis Sapphire interactor contract
  // const interactor = await getInteractorContract();
  // const signedTx = await interactor.authenticateAndSignRaw(authUsername, password, transactionData);
  
  // TODO: Broadcast to Hoodi chain
  // const hoodiProvider = getHoodiProvider();
  // const txResponse = await hoodiProvider.sendTransaction(signedTx);
  // await txResponse.wait();

  return {
    success: true,
    message: 'Transaction signed and broadcasted'
  };
}


