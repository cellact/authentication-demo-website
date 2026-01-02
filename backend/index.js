require('dotenv').config();

const functions = require('@google-cloud/functions-framework');
const { ethers } = require('ethers');
const sapphire = require('@oasisprotocol/sapphire-paratime');
const ArnaconSDK = require('arnacon-sdk');
const nodemailer = require('nodemailer');

// Oasis Sapphire Testnet Configuration
const CONFIDENTIAL_AUTH_ADDRESS = '0xf4B4d8b8a9b1F104b2100F6d68e1ab21C3a2DF76'; // ConfidentialAuthAddressBased
const OASIS_SAPPHIRE_TESTNET_RPC = 'https://testnet.sapphire.oasis.io'; // Fallback RPC
const OASIS_SAPPHIRE_CHAIN_ID = 23295; // 0x5aff

// Hoodi Network Configuration
const HOODI_CHAIN_ID = 560048;
const HOODI_RPC_FALLBACK = 'https://rpc.hoodi.ethpandaops.io'; // Fallback RPC
const DOMAIN_NAME = 'demoauth'; // Your registered domain name (without .global)

// Chainlist API
const CHAINLIST_API = 'https://chainid.network/chains.json';

// Email Configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;
const MAINTAINER_EMAIL = process.env.MAINTAINER_EMAIL;

// Balance thresholds (minimum recommended for safe operation)
const MIN_OASIS_BALANCE = '1.0'; // 1 TEST (~20 users with retries)
const MIN_HOODI_BALANCE = '0.1'; // 0.1 ETH (~20 users with retries)

// Contract ABIs (ConfidentialAuthAddressBased - stores passwords as bytes)
const CONFIDENTIAL_AUTH_ABI = [
  "function storeSecret(string memory username, bytes calldata secret) external",
  "function deleteSecret(string memory username, bytes calldata secret) external",
  "function getWalletAddress(string memory username) external view returns (address)",
  "function authenticateUser(string memory username, string memory realm, string memory method, string memory uri, string memory nonce, uint8 algo, bytes memory response) external view returns (bool)",
  "function getDigestHash(string memory username, string memory realm, string memory method, string memory uri, string memory nonce, uint8 algo) external view returns (bytes memory)"
];

/**
 * Fetch RPC endpoints from Chainlist for a given chain ID
 * @param {number} chainId - The chain ID to fetch RPCs for
 * @returns {Promise<string[]>} Array of RPC URLs
 */
async function fetchRPCsFromChainlist(chainId) {
  try {
    console.log(`Fetching RPCs from Chainlist for chain ID ${chainId}...`);
    const response = await fetch(CHAINLIST_API, { timeout: 5000 });
    
    if (!response.ok) {
      throw new Error(`Chainlist API returned ${response.status}`);
    }
    
    const chains = await response.json();
    const chain = chains.find(c => c.chainId === chainId);
    
    if (!chain || !chain.rpc || chain.rpc.length === 0) {
      console.log(`No RPCs found for chain ID ${chainId} in Chainlist`);
      return [];
    }
    
    // Filter out invalid RPCs (must be https, no ${...} placeholders)
    let validRpcs = chain.rpc.filter(rpc => 
      typeof rpc === 'string' && 
      rpc.startsWith('https://') && 
      !rpc.includes('${')
    );
    
    // For testnet chains, only include RPCs with "testnet" in the URL
    if (chainId === OASIS_SAPPHIRE_CHAIN_ID) {
      validRpcs = validRpcs.filter(rpc => rpc.includes('testnet'));
      console.log(`Filtered to testnet RPCs only for chain ${chainId}`);
    }
    
    console.log(`Found ${validRpcs.length} valid RPCs for chain ID ${chainId}`);
    return validRpcs;
  } catch (error) {
    console.error(`Error fetching RPCs from Chainlist for chain ${chainId}:`, error.message);
    return [];
  }
}

/**
 * Test RPC latency by sending a simple eth_blockNumber request
 * @param {string} rpcUrl - The RPC URL to test
 * @returns {Promise<{rpcUrl: string, latency: number}>}
 */
async function testRPCLatency(rpcUrl) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'RPC error');
    }
    
    const latency = Date.now() - startTime;
    console.log(`  ${rpcUrl}: ${latency}ms`);
    return { rpcUrl, latency };
  } catch (error) {
    console.log(`  ${rpcUrl}: FAILED (${error.message})`);
    return { rpcUrl, latency: Infinity };
  }
}

/**
 * Select the best (fastest) RPC from a list of candidates
 * @param {number} chainId - The chain ID
 * @param {string} fallbackRpc - Fallback RPC if all others fail
 * @returns {Promise<string>} The fastest RPC URL
 */
async function selectBestRPC(chainId, fallbackRpc) {
  console.log(`\n========== RPC SELECTION FOR CHAIN ${chainId} ==========`);
  
  // Fetch RPCs from Chainlist
  const chainlistRpcs = await fetchRPCsFromChainlist(chainId);
  
  // Add fallback to the list (only if not already present)
  const allRpcs = chainlistRpcs.includes(fallbackRpc) 
    ? chainlistRpcs 
    : [...chainlistRpcs, fallbackRpc];
  
  if (allRpcs.length === 0) {
    console.log(`No RPCs available, using fallback: ${fallbackRpc}`);
    console.log(`====================================================\n`);
    return fallbackRpc;
  }
  
  console.log(`Testing ${allRpcs.length} RPC endpoints...`);
  
  // Test all RPCs in parallel
  const results = await Promise.all(allRpcs.map(rpc => testRPCLatency(rpc)));
  
  // Sort by latency (fastest first)
  results.sort((a, b) => a.latency - b.latency);
  
  // Pick the fastest working RPC
  const fastest = results[0];
  
  if (fastest.latency === Infinity) {
    console.log(`All RPCs failed, using fallback: ${fallbackRpc}`);
    console.log(`====================================================\n`);
    return fallbackRpc;
  }
  
  console.log(`Selected fastest RPC: ${fastest.rpcUrl} (${fastest.latency}ms)`);
  console.log(`====================================================\n`);
  
  return fastest.rpcUrl;
}

/**
 * Get Sapphire-wrapped provider and signer with dynamic RPC selection
 */
async function getSapphireConnection() {
  const privateKey = process.env.PKEY;
  
  if (!privateKey) {
    throw new Error('PKEY environment variable not set');
  }

  // Select the best RPC dynamically
  const bestRpc = await selectBestRPC(OASIS_SAPPHIRE_CHAIN_ID, OASIS_SAPPHIRE_TESTNET_RPC);

  // Create provider for Oasis Sapphire Testnet (ethers v5 syntax)
  const provider = new ethers.providers.JsonRpcProvider(bestRpc);
  
  // Wrap the provider with Sapphire for confidential calls
  const sapphireProvider = sapphire.wrap(provider);
  
  // Create wallet with private key
  const wallet = new ethers.Wallet(privateKey, sapphireProvider);
  
  // Wrap the wallet as well
  const sapphireWallet = sapphire.wrap(wallet);
  
  return { provider: sapphireProvider, signer: sapphireWallet };
}

/**
 * Check and log wallet balances on both networks
 * @param {string} label - Label for the log (e.g., "BEFORE" or "AFTER")
 * @returns {Promise<{oasisBalance: string, hoodiBalance: string, address: string}>}
 */
async function logBalances(label) {
  try {
    const privateKey = process.env.PKEY;
    if (!privateKey) {
      console.error('PKEY not set, cannot check balances');
      return { oasisBalance: '0', hoodiBalance: '0', address: 'unknown' };
    }

    console.log(`\n========== BALANCE CHECK: ${label} ==========`);
    
    let oasisBalance = '0';
    let hoodiBalance = '0';
    let address = 'unknown';

    // Check Oasis Sapphire balance
    try {
      const bestOasisRpc = await selectBestRPC(OASIS_SAPPHIRE_CHAIN_ID, OASIS_SAPPHIRE_TESTNET_RPC);
      const sapphireProvider = new ethers.providers.JsonRpcProvider(bestOasisRpc);
      const sapphireWallet = new ethers.Wallet(privateKey, sapphireProvider);
      const sapphireBalanceBN = await sapphireWallet.getBalance();
      oasisBalance = ethers.utils.formatEther(sapphireBalanceBN);
      address = sapphireWallet.address;
      console.log(`[Oasis Sapphire] Address: ${address}`);
      console.log(`[Oasis Sapphire] Balance: ${oasisBalance} TEST`);
    } catch (error) {
      console.error(`[Oasis Sapphire] Error checking balance:`, error.message);
    }

    // Check Hoodi network balance
    try {
      const bestHoodiRpc = await selectBestRPC(HOODI_CHAIN_ID, HOODI_RPC_FALLBACK);
      const hoodiProvider = new ethers.providers.JsonRpcProvider(bestHoodiRpc);
      const hoodiWallet = new ethers.Wallet(privateKey, hoodiProvider);
      const hoodiBalanceBN = await hoodiWallet.getBalance();
      hoodiBalance = ethers.utils.formatEther(hoodiBalanceBN);
      console.log(`[Hoodi Network] Address: ${hoodiWallet.address}`);
      console.log(`[Hoodi Network] Balance: ${hoodiBalance} ETH`);
    } catch (error) {
      console.error(`[Hoodi Network] Error checking balance:`, error.message);
    }

    console.log(`============================================\n`);
    
    return { oasisBalance, hoodiBalance, address };
  } catch (error) {
    console.error('Error in logBalances:', error.message);
    return { oasisBalance: '0', hoodiBalance: '0', address: 'unknown' };
  }
}

/**
 * Send low balance alert email to maintainer
 */
async function sendLowBalanceAlert(oasisBalance, hoodiBalance, address) {
  try {
    if (!EMAIL_USER || !EMAIL_PASS || !MAINTAINER_EMAIL) {
      console.log('Email not configured or MAINTAINER_EMAIL not set, skipping low balance alert');
      return false;
    }
    
    const transporter = createTransport();
    if (!transporter) {
      console.log('Failed to create email transporter for low balance alert');
      return false;
    }
    
    const oasisLow = parseFloat(oasisBalance) < parseFloat(MIN_OASIS_BALANCE);
    const hoodiLow = parseFloat(hoodiBalance) < parseFloat(MIN_HOODI_BALANCE);
    
    if (!oasisLow && !hoodiLow) {
      return false; // Balances are sufficient
    }
    
    let alertMessage = `⚠️ LOW BALANCE ALERT\n\n`;
    alertMessage += `Wallet Address: ${address}\n\n`;
    
    if (oasisLow) {
      alertMessage += `❌ Oasis Sapphire Testnet:\n`;
      alertMessage += `   Current: ${oasisBalance} TEST\n`;
      alertMessage += `   Minimum: ${MIN_OASIS_BALANCE} TEST\n`;
      alertMessage += `   Status: CRITICALLY LOW\n\n`;
    } else {
      alertMessage += `✅ Oasis Sapphire Testnet: ${oasisBalance} TEST (OK)\n\n`;
    }
    
    if (hoodiLow) {
      alertMessage += `❌ Hoodi Network:\n`;
      alertMessage += `   Current: ${hoodiBalance} ETH\n`;
      alertMessage += `   Minimum: ${MIN_HOODI_BALANCE} ETH\n`;
      alertMessage += `   Status: CRITICALLY LOW\n\n`;
    } else {
      alertMessage += `✅ Hoodi Network: ${hoodiBalance} ETH (OK)\n\n`;
    }
    
    alertMessage += `Action Required:\n`;
    alertMessage += `Please top up the wallet to ensure uninterrupted service.\n\n`;
    alertMessage += `Estimated capacity remaining:\n`;
    alertMessage += `- Oasis: ~${Math.floor(parseFloat(oasisBalance) / 0.05)} more users\n`;
    alertMessage += `- Hoodi: ~${Math.floor(parseFloat(hoodiBalance) / 0.005)} more users\n`;
    
    const mailOptions = {
      from: EMAIL_FROM,
      to: MAINTAINER_EMAIL,
      subject: '⚠️ LOW BALANCE ALERT - SIP Web3 Auth Demo',
      text: alertMessage
    };
    
    await transporter.sendMail(mailOptions);
    console.log('Low balance alert email sent to maintainer:', MAINTAINER_EMAIL);
    return true;
  } catch (error) {
    console.error('Error sending low balance alert:', error);
    return false;
  }
}

/**
 * Register ENS subdomain on Hoodi for the Oasis user using Arnacon SDK
 * @param {string} username - The subdomain label (e.g., "habibi")
 * @param {string} userAddress - The Oasis user's wallet address
 * @returns {Promise<{txHash: string, subdomain: string}>}
 */
async function registerENSSubdomain(username, userAddress) {
  console.log(`Registering ENS subdomain: ${username}.${DOMAIN_NAME}.global`);
  console.log(`Owner address: ${userAddress}`);
  
  const privateKey = process.env.PKEY;
  if (!privateKey) {
    throw new Error('PKEY environment variable not set');
  }
  
  // Initialize Arnacon SDK for Hoodi network
  const sdk = new ArnaconSDK(privateKey, HOODI_CHAIN_ID);
  await sdk.initializeNetworkInfo();
  
  console.log(`SDK initialized for ${sdk.getNetworkName()}`);
  console.log(`Signer: ${sdk.getSignerAddress()}`);
  
  // Get the SecondLevelInteractor contract address for this domain owner
  const secondLevelInteractorAddress = '0x5bA6D4749AE9573f703E19f9197AE783dFaa78f8'; // From hoodi-addresses.json
  
  // Load ABIs from local artifact files
  const secondLevelInteractorArtifact = require('./SecondLevelInteractor.json');
  const secondLevelInteractorAbi = secondLevelInteractorArtifact.abi;
  
  console.log(`Loaded ABI with ${secondLevelInteractorAbi.length} functions`);
  
  // Connect to the contract with best RPC
  const bestHoodiRpc = await selectBestRPC(HOODI_CHAIN_ID, HOODI_RPC_FALLBACK);
  const provider = new ethers.providers.JsonRpcProvider(bestHoodiRpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  const secondLevelInteractor = new ethers.Contract(
    secondLevelInteractorAddress,
    secondLevelInteractorAbi,
    wallet
  );
  
  // Register subdomain with resolver using registerSubnodeRecord
  // This sets BOTH the owner AND the PublicResolver in one transaction
  const oneYearInSeconds = 365 * 24 * 60 * 60;
  const expiry = Math.floor(Date.now() / 1000) + oneYearInSeconds;
  
  console.log(`Calling registerSubnodeRecord with:`);
  console.log(`   owner: ${userAddress}`);
  console.log(`   label: ${username}`);
  console.log(`   name: ${DOMAIN_NAME}`);
  console.log(`   expiry: ${expiry}`);
  
  // Step 1: Register subdomain with PKEY as temporary owner
  console.log(`Registering subdomain with PKEY as temporary owner...`);
  const pkeyAddress = wallet.address;
  
  const receipt = await retryTransaction(
    async (gasMultiplier) => {
      const gasLimit = await secondLevelInteractor.estimateGas.registerSubnodeRecord(
        pkeyAddress,
        username,
        DOMAIN_NAME,
        expiry
      );
      const adjustedGasLimit = gasLimit.mul(Math.floor(gasMultiplier * 100)).div(100);
      return secondLevelInteractor.registerSubnodeRecord(
        pkeyAddress,    // owner - PKEY wallet (temporary)
        username,       // label - the subdomain
        DOMAIN_NAME,    // name - the parent domain (WITHOUT .global)
        expiry,         // expiry - 1 year from now
        { gasLimit: adjustedGasLimit }
      );
    },
    'Register ENS subdomain'
  );
  console.log(`ENS subdomain registered with PKEY as owner`);
  
  const fullDomain = `${username}.${DOMAIN_NAME}.global`;
  console.log(`Full domain: ${fullDomain}`);
  
  // Step 2: Set the address record on PublicResolver (pointing to Oasis wallet)
  console.log(`\nSetting address record on PublicResolver...`);
  const publicResolverAddress = '0x9427fF61d53deDB42102d84E0EC2927F910eF8f2';
  const publicResolverArtifact = require('./PublicResolver.json');
  const publicResolverAbi = publicResolverArtifact.abi;
  
  const publicResolver = new ethers.Contract(
    publicResolverAddress,
    publicResolverAbi,
    wallet
  );
  
  const subdomainNode = ethers.utils.namehash(fullDomain);
  console.log(`Subdomain node: ${subdomainNode}`);
  console.log(`Setting address to Oasis wallet: ${userAddress}`);
  
  const setAddrReceipt = await retryTransaction(
    async (gasMultiplier) => {
      const gasLimit = await publicResolver.estimateGas['setAddr(bytes32,address)'](subdomainNode, userAddress);
      const adjustedGasLimit = gasLimit.mul(Math.floor(gasMultiplier * 100)).div(100);
      return publicResolver['setAddr(bytes32,address)'](subdomainNode, userAddress, { gasLimit: adjustedGasLimit });
    },
    'Set address on PublicResolver'
  );
  console.log(`Address record set on PublicResolver`);
  
  // Step 3: Transfer subdomain NFT ownership to Oasis wallet
  console.log(`\nTransferring subdomain ownership to Oasis wallet...`);
  const nameWrapperAddress = '0x0140420b3e02b1A7d4645cE330337bc8742C3Df5';
  const nameWrapperArtifact = require('./NameWrapper.json');
  const nameWrapperAbi = nameWrapperArtifact.abi;
  
  const nameWrapper = new ethers.Contract(
    nameWrapperAddress,
    nameWrapperAbi,
    wallet
  );
  
  const tokenId = ethers.BigNumber.from(subdomainNode);
  const transferReceipt = await retryTransaction(
    async (gasMultiplier) => {
      const gasLimit = await nameWrapper.estimateGas.safeTransferFrom(
        pkeyAddress,
        userAddress,
        tokenId,
        1,
        '0x'
      );
      const adjustedGasLimit = gasLimit.mul(Math.floor(gasMultiplier * 100)).div(100);
      return nameWrapper.safeTransferFrom(
        pkeyAddress,    // from - current owner (PKEY)
        userAddress,    // to - new owner (Oasis wallet)
        tokenId,        // tokenId - the subdomain node
        1,              // amount - always 1 for ERC1155 NFTs
        '0x',           // data - empty
        { gasLimit: adjustedGasLimit }
      );
    },
    'Transfer subdomain ownership'
  );
  console.log(`Subdomain ownership transferred to Oasis wallet`);
  
  return {
    txHash: receipt.transactionHash,
    subdomain: fullDomain,
    secondLevelInteractor: secondLevelInteractorAddress,
    setAddrTxHash: setAddrReceipt.transactionHash
  };
}

/**
 * Retry helper for transaction execution with gas escalation
 * @param {Function} txFunction - Function that returns a transaction promise
 * @param {string} description - Description for logging
 * @param {number} maxRetries - Maximum retry attempts (default: 2)
 * @returns {Promise<any>} Transaction receipt
 */
async function retryTransaction(txFunction, description, maxRetries = 2) {
  const gasMultipliers = [1, 1.5, 2]; // 1x, 1.5x, 2x
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${description}] Attempt ${attempt + 1}/${maxRetries + 1} (gas multiplier: ${gasMultipliers[attempt]}x)`);
      
      // Execute transaction with gas multiplier
      const tx = await txFunction(gasMultipliers[attempt]);
      console.log(`[${description}] Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`[${description}] Transaction confirmed! Block: ${receipt.blockNumber}`);
      
      return receipt;
    } catch (error) {
      lastError = error;
      const errorMsg = error.message || error.toString();
      
      // Check if error is retryable
      const isOutOfGas = errorMsg.includes('out of gas') || errorMsg.includes('gas required exceeds');
      const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('network') || errorMsg.includes('ETIMEDOUT');
      const isNonceIssue = errorMsg.includes('nonce too low') || errorMsg.includes('nonce');
      const isRevert = errorMsg.includes('revert') || errorMsg.includes('execution reverted');
      
      // Don't retry on revert
      if (isRevert && !isOutOfGas) {
        console.error(`[${description}] Transaction reverted, not retrying:`, errorMsg);
        throw error;
      }
      
      // Retry on gas, timeout, or nonce issues
      if ((isOutOfGas || isTimeout || isNonceIssue) && attempt < maxRetries) {
        console.warn(`[${description}] Retryable error on attempt ${attempt + 1}: ${errorMsg}`);
        console.log(`[${description}] Retrying with higher gas...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        continue;
      }
      
      // Max retries reached or non-retryable error
      console.error(`[${description}] Failed after ${attempt + 1} attempts:`, errorMsg);
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Retry helper for read operations
 * @param {Function} readFunction - Function that returns a read promise
 * @param {string} description - Description for logging
 * @param {number} maxRetries - Maximum retry attempts (default: 2)
 * @returns {Promise<any>} Read result
 */
async function retryRead(readFunction, description, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${description}] Read attempt ${attempt + 1}/${maxRetries + 1}`);
      const result = await readFunction();
      console.log(`[${description}] Read successful`);
      return result;
    } catch (error) {
      lastError = error;
      const errorMsg = error.message || error.toString();
      
      // Check if error is retryable
      const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('network') || errorMsg.includes('ETIMEDOUT');
      const isRPCError = errorMsg.includes('RPC') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND');
      
      if ((isTimeout || isRPCError) && attempt < maxRetries) {
        console.warn(`[${description}] Retryable read error on attempt ${attempt + 1}: ${errorMsg}`);
        console.log(`[${description}] Retrying read...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        continue;
      }
      
      // Max retries reached or non-retryable error
      console.error(`[${description}] Read failed after ${attempt + 1} attempts:`, errorMsg);
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Create nodemailer transport
 */
const createTransport = () => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.log('Email credentials not configured, emails will not be sent');
    return null;
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
};

/**
 * Send user credentials via email
 */
async function sendUserCredentialsEmail(customerEmail, username, password, userAddress, ensSubdomain) {
  try {
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.log('Email credentials not configured, skipping email');
      console.log('Would have sent credentials to:', customerEmail);
      return false;
    }
    
    const transporter = createTransport();
    if (!transporter) {
      console.log('Failed to create email transporter');
      return false;
    }
    
    const mailOptions = {
      from: EMAIL_FROM,
      to: customerEmail,
      subject: 'Your SIP Web3 Authentication Demo Credentials',
      text: `Hey!

Here are your credentials for the auth_web3 module demonstration:

Username: ${ensSubdomain}
Auth Username: ${username}
Password: ${password}

These credentials authenticate via the auth_web3 module on Kamailio. To test it:

1. Open any SIP client (Zoiper, Linphone, etc.)
2. Enter Auth Username and Password above
3. Set domain: kama6.cellact.nl
4. Set transport: UDP
5. Register and make calls

Once registered, you can make calls to any other user registered on the server (use their Auth Username), or dial "asteriskTest" to test calling an IVR system.

Behind the scenes, your credentials are verified against a smart contract on Oasis Sapphire (confidential EVM), and your ENS identity is resolved on the Hoodi network. This demonstrates blockchain-based SIP authentication with full ENS support.

The auth_web3 module is compatible with both Kamailio and OpenSIPS.

Questions? Email ron@cellact.nl`
    };
    
    await transporter.sendMail(mailOptions);
    console.log('User credentials email sent successfully to:', customerEmail);
    return true;
  } catch (error) {
    console.error('Error sending user credentials email:', error);
    return false;
  }
}

/**
 * Main router function - routes to createUser or deleteUser based on header
 */
functions.http('helloHttp', async (req, res) => {
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
    // Log balances BEFORE user creation and check if they're sufficient
    const { oasisBalance, hoodiBalance, address } = await logBalances('BEFORE USER CREATION');
    
    // Send alert email if balances are low (non-blocking)
    sendLowBalanceAlert(oasisBalance, hoodiBalance, address).catch(err => {
      console.error('Failed to send low balance alert:', err);
    });

    const { username, password, authUsername, domain, email } = req.body;

    // Validate input
    if (!username || !password || !authUsername) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: username, password, authUsername' 
      });
      return;
    }

    // Validate username format (alphanumeric + underscore)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      res.status(400).json({ 
        success: false, 
        error: 'Username must be alphanumeric (letters, numbers, underscore only)' 
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

    console.log('Creating Oasis user:', username);

    // Connect to Oasis Sapphire
    console.log('Connecting to Sapphire...');
    const { signer } = await getSapphireConnection();
    console.log('Connected to Sapphire');
    
    // Get ConfidentialAuthAddressBased contract instance
    console.log('Getting contract instance...');
    const confidentialAuth = new ethers.Contract(CONFIDENTIAL_AUTH_ADDRESS, CONFIDENTIAL_AUTH_ABI, signer);
    console.log('Contract instance created');
    
    // Check if user already exists (try to get wallet address)
    console.log('Checking if user exists...');
    try {
      const existingAddress = await retryRead(
        () => confidentialAuth.getWalletAddress(username),
        'Check existing user'
      );
      console.log('Existing address:', existingAddress);
      if (existingAddress && existingAddress !== ethers.constants.AddressZero) {
        res.status(400).json({
          success: false,
          error: `User '${username}' already exists on Oasis`
        });
        return;
      }
    } catch (error) {
      // User doesn't exist, which is what we want
      console.log('User does not exist yet (or error checking):', error.message);
    }
    console.log('Proceeding with user creation...');

    // Create user on Oasis Sapphire (password stored as bytes)
    console.log('Calling storeSecret on ConfidentialAuth contract...');
    const passwordBytes = ethers.utils.toUtf8Bytes(password);
    
    const receipt = await retryTransaction(
      async (gasMultiplier) => {
        const gasLimit = await confidentialAuth.estimateGas.storeSecret(username, passwordBytes);
        const adjustedGasLimit = gasLimit.mul(Math.floor(gasMultiplier * 100)).div(100);
        return confidentialAuth.storeSecret(username, passwordBytes, { gasLimit: adjustedGasLimit });
      },
      'Store user secret on Oasis'
    );
    
    // Wait a bit for Sapphire to finalize the block for confidential reads
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get user wallet address
    const userAddress = await retryRead(
      () => confidentialAuth.getWalletAddress(username),
      'Get user wallet address'
    );
    
    console.log('User created successfully on Oasis!');
    console.log('  Address:', userAddress);
    console.log('  Password stored as bytes (confidential)');

    // Register ENS subdomain on Hoodi
    console.log('\nRegistering ENS subdomain on Hoodi...');
    let ensResult;
    try {
      ensResult = await registerENSSubdomain(username, userAddress);
      console.log('ENS subdomain registered:', ensResult.subdomain);
    } catch (ensError) {
      console.error('ENS registration failed:', ensError.message);
      // Continue even if ENS fails - user is created on Oasis
      ensResult = {
        error: ensError.message,
        subdomain: `${username}.${DOMAIN_NAME}.global`,
        success: false
      };
    }

    // Send credentials email if email is provided
    if (email) {
      console.log('Sending credentials email to:', email);
      try {
        await sendUserCredentialsEmail(
          email,
          authUsername,
          password,
          userAddress,
          ensResult.subdomain
        );
        console.log('Credentials email sent successfully');
      } catch (emailError) {
        console.error('Failed to send credentials email:', emailError);
        // Don't fail the whole request if email fails
      }
    } else {
      console.log('No email provided, skipping credentials email');
    }

    // Log balances AFTER user creation
    await logBalances('AFTER USER CREATION');

    res.status(200).json({
      success: true,
      message: 'User created successfully on Oasis Sapphire and registered on ENS',
      oasis: {
        txHash: receipt.transactionHash,
        userAddress,
        blockNumber: receipt.blockNumber,
        contractAddress: CONFIDENTIAL_AUTH_ADDRESS
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
    console.error('Error creating user:', error);
    
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
    const { authUsername, password } = req.body;

    // Validate input
    if (!authUsername || !password) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: authUsername, password' 
      });
      return;
    }

    console.log('Deleting Oasis user:', authUsername);

    // Connect to Oasis Sapphire
    const { signer } = await getSapphireConnection();
    
    // Get ConfidentialAuthAddressBased contract instance
    const confidentialAuth = new ethers.Contract(CONFIDENTIAL_AUTH_ADDRESS, CONFIDENTIAL_AUTH_ABI, signer);
    
    // Check if user exists
    try {
      await retryRead(
        () => confidentialAuth.getWalletAddress(authUsername),
        'Check user exists for deletion'
      );
    } catch (error) {
      res.status(404).json({
        success: false,
        error: `User '${authUsername}' does not exist on Oasis`
      });
      return;
    }

    // Delete user on Oasis Sapphire (requires password authentication)
    console.log('Calling deleteSecret on ConfidentialAuth contract...');
    const passwordBytes = ethers.utils.toUtf8Bytes(password);
    const receipt = await retryTransaction(
      async (gasMultiplier) => {
        const gasLimit = await confidentialAuth.estimateGas.deleteSecret(authUsername, passwordBytes);
        const adjustedGasLimit = gasLimit.mul(Math.floor(gasMultiplier * 100)).div(100);
        return confidentialAuth.deleteSecret(authUsername, passwordBytes, { gasLimit: adjustedGasLimit });
      },
      'Delete user secret from Oasis'
    );

    res.status(200).json({
      success: true,
      message: 'User deleted successfully from Oasis Sapphire',
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      authUsername
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    
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
