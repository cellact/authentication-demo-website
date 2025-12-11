const functions = require('@google-cloud/functions-framework');
const { ethers } = require('ethers');
const sapphire = require('@oasisprotocol/sapphire-paratime');
const ArnaconSDK = require('arnacon-sdk');

// Oasis Sapphire Testnet Configuration
const INTERACTOR_ADDRESS = '0xf62848BEb89127cA25d77BFaadAb5485e0618B35';
const OASIS_SAPPHIRE_TESTNET_RPC = 'https://testnet.sapphire.oasis.io';

// Hoodi Network Configuration
const HOODI_CHAIN_ID = 560048;
const DOMAIN_NAME = 'authdemo1765462240433'; // Your registered domain name (without .global)

// Contract ABIs
const INTERACTOR_ABI = [
  "function createUser(string memory username, bytes calldata secret) external returns (address userAddress, bytes memory publicKey)",
  "function deleteUser(string memory username) external",
  "function getUserInfo(string memory username) external view returns (address userAddress, bytes memory publicKey, bool hasSecret)",
  "function userExists(string memory username) external view returns (bool)"
];

/**
 * Get Sapphire-wrapped provider and signer
 */
function getSapphireConnection() {
  const privateKey = process.env.PKEY;
  
  if (!privateKey) {
    throw new Error('PKEY environment variable not set');
  }

  // Create provider for Oasis Sapphire Testnet (ethers v5 syntax)
  const provider = new ethers.providers.JsonRpcProvider(OASIS_SAPPHIRE_TESTNET_RPC);
  
  // Wrap the provider with Sapphire for confidential calls
  const sapphireProvider = sapphire.wrap(provider);
  
  // Create wallet with private key
  const wallet = new ethers.Wallet(privateKey, sapphireProvider);
  
  // Wrap the wallet as well
  const sapphireWallet = sapphire.wrap(wallet);
  
  return { provider: sapphireProvider, signer: sapphireWallet };
}

/**
 * Register ENS subdomain on Hoodi for the Oasis user using Arnacon SDK
 * @param {string} username - The subdomain label (e.g., "habibi")
 * @param {string} userAddress - The Oasis user's wallet address
 * @returns {Promise<{txHash: string, subdomain: string}>}
 */
async function registerENSSubdomain(username, userAddress) {
  console.log(`📍 Registering ENS subdomain: ${username}.${DOMAIN_NAME}.global`);
  console.log(`📍 Owner address: ${userAddress}`);
  
  const privateKey = process.env.PKEY;
  if (!privateKey) {
    throw new Error('PKEY environment variable not set');
  }
  
  // Initialize Arnacon SDK for Hoodi network
  const sdk = new ArnaconSDK(privateKey, HOODI_CHAIN_ID);
  await sdk.initializeNetworkInfo();
  
  console.log(`📍 SDK initialized for ${sdk.getNetworkName()}`);
  console.log(`📍 Signer: ${sdk.getSignerAddress()}`);
  
  // Register subdomain using SDK
  // registerSubdomain(owner, label, name)
  const result = await sdk.registerSubdomain(
    userAddress,    // owner - the Oasis user's wallet address
    username,       // label - the subdomain 
    DOMAIN_NAME     // name - the parent domain (e.g., "authdemo1765462240433.global")
  );
  
  console.log(`✅ ENS subdomain registered via SDK!`);
  console.log(`📍 Full domain: ${result.fullDomain}`);
  
  return {
    txHash: result.transactionHash || 'N/A',
    subdomain: result.fullDomain,
    secondLevelInteractor: result.secondLevelInteractor
  };
}

/**
 * Main router function - routes to createUser or deleteUser based on header
 */
functions.http('createUser', async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Function-Name');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Route based on X-Function-Name header
  const functionName = req.get('X-Function-Name') || 'createUser';
  
  if (functionName === 'deleteUser') {
    return handleDeleteUser(req, res);
  } else {
    return handleCreateUser(req, res);
  }
});

/**
 * Handle Create Oasis User
 * 
 * This function:
 * 1. Validates input
 * 2. Creates a wallet on Oasis Sapphire using the Interactor contract
 * 3. Registers ENS subdomain on Hoodi
 * 4. Returns transaction hash and user address
 */
async function handleCreateUser(req, res) {

  try {
    const { username, password, authUsername, domain } = req.body;

    // Validate input
    if (!username || !password || !authUsername) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: username, password, authUsername' 
      });
      return;
    }

    // Validate username format (alphanumeric + underscore)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({ 
        success: false, 
        error: 'Username must be 3-20 characters (alphanumeric and underscore only)' 
      });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      });
      return;
    }

    console.log('🔐 Creating Oasis user:', username);

    // Connect to Oasis Sapphire
    const { signer } = getSapphireConnection();
    
    // Get Interactor contract instance
    const interactor = new ethers.Contract(INTERACTOR_ADDRESS, INTERACTOR_ABI, signer);
    
    // Check if user already exists
    const exists = await interactor.userExists(username);
    if (exists) {
      res.status(400).json({
        success: false,
        error: `User '${username}' already exists on Oasis`
      });
      return;
    }

    // Convert password to bytes (UTF-8 encoding) - ethers v5 syntax
    const passwordBytes = ethers.utils.toUtf8Bytes(password);
    
    // Create user on Oasis Sapphire
    console.log('📍 Calling createUser on Interactor contract...');
    const tx = await interactor.createUser(username, passwordBytes);
    console.log('📍 Transaction submitted:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);
    
    // Get user info to retrieve the generated address
    const userInfo = await interactor.getUserInfo(username);
    const userAddress = userInfo[0]; // First element is the address
    const publicKey = userInfo[1];   // Second element is the public key
    const hasSecret = userInfo[2];   // Third element is hasSecret boolean
    
    console.log('📍 User created successfully on Oasis!');
    console.log('  Address:', userAddress);
    console.log('  Public Key:', ethers.utils.hexlify(publicKey));
    console.log('  Has Secret:', hasSecret);

    // Register ENS subdomain on Hoodi
    console.log('\n📍 Registering ENS subdomain on Hoodi...');
    let ensResult;
    try {
      ensResult = await registerENSSubdomain(username, userAddress);
      console.log('✅ ENS subdomain registered:', ensResult.subdomain);
    } catch (ensError) {
      console.error('❌ ENS registration failed:', ensError.message);
      // Continue even if ENS fails - user is created on Oasis
      ensResult = {
        error: ensError.message,
        subdomain: `${username}.${DOMAIN_NAME}.global`,
        success: false
      };
    }

    res.status(200).json({
      success: true,
      message: 'User created successfully on Oasis Sapphire and registered on ENS',
      oasis: {
        txHash: tx.hash,
        userAddress,
        publicKey: ethers.utils.hexlify(publicKey),
        blockNumber: receipt.blockNumber
      },
      ens: {
        subdomain: ensResult.subdomain,
        txHash: ensResult.txHash,
        blockNumber: ensResult.blockNumber,
        success: !ensResult.error
      },
      authUsername,
      username
    });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    
    // Check for specific error messages
    let errorMessage = 'Failed to create user on Oasis';
    
    if (error.message.includes('User already exists')) {
      errorMessage = 'User already exists';
    } else if (error.message.includes('PKEY')) {
      errorMessage = 'Server configuration error: Private key not set';
    } else if (error.message.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds in deployer wallet';
    } else if (error.reason) {
      errorMessage = error.reason;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}

/**
 * Handle Delete Oasis User
 * 
 * This function:
 * 1. Validates input
 * 2. Deletes user from Oasis Sapphire contract
 * 3. Returns transaction hash and success status
 */
async function handleDeleteUser(req, res) {

  try {
    const { authUsername } = req.body;

    // Validate input
    if (!authUsername) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required field: authUsername' 
      });
      return;
    }

    console.log('🗑️  Deleting Oasis user:', authUsername);

    // Connect to Oasis Sapphire
    const { signer } = getSapphireConnection();
    
    // Get Interactor contract instance
    const interactor = new ethers.Contract(INTERACTOR_ADDRESS, INTERACTOR_ABI, signer);
    
    // Check if user exists
    const exists = await interactor.userExists(authUsername);
    if (!exists) {
      res.status(404).json({
        success: false,
        error: `User '${authUsername}' does not exist on Oasis`
      });
      return;
    }

    // Delete user on Oasis Sapphire
    console.log('📍 Calling deleteUser on Interactor contract...');
    const tx = await interactor.deleteUser(authUsername);
    console.log('📍 Transaction submitted:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully from Oasis Sapphire',
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      authUsername
    });

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    
    // Check for specific error messages
    let errorMessage = 'Failed to delete user from Oasis';
    
    if (error.message.includes('User does not exist')) {
      errorMessage = 'User not found';
    } else if (error.message.includes('PKEY')) {
      errorMessage = 'Server configuration error: Private key not set';
    } else if (error.message.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds in deployer wallet';
    } else if (error.reason) {
      errorMessage = error.reason;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}
