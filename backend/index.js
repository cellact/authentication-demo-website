require('dotenv').config();

const functions = require('@google-cloud/functions-framework');
const { ethers } = require('ethers');
const sapphire = require('@oasisprotocol/sapphire-paratime');
const ArnaconSDK = require('arnacon-sdk');
const nodemailer = require('nodemailer');

// Oasis Sapphire Testnet Configuration
const CONFIDENTIAL_AUTH_ADDRESS = '0xf4B4d8b8a9b1F104b2100F6d68e1ab21C3a2DF76'; // ConfidentialAuthAddressBased
const OASIS_SAPPHIRE_TESTNET_RPC = 'https://testnet.sapphire.oasis.io';

// Hoodi Network Configuration
const HOODI_CHAIN_ID = 560048;
const DOMAIN_NAME = 'authdemo1765462240433'; // Your registered domain name (without .global)

// Email Configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

// Contract ABIs (ConfidentialAuthAddressBased - stores passwords as bytes)
const CONFIDENTIAL_AUTH_ABI = [
  "function storeSecret(string memory username, bytes calldata secret) external",
  "function deleteSecret(string memory username, bytes calldata secret) external",
  "function getWalletAddress(string memory username) external view returns (address)",
  "function authenticateUser(string memory username, string memory realm, string memory method, string memory uri, string memory nonce, uint8 algo, bytes memory response) external view returns (bool)",
  "function getDigestHash(string memory username, string memory realm, string memory method, string memory uri, string memory nonce, uint8 algo) external view returns (bytes memory)"
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
  
  // Load SecondLevelInteractor ABI from SDK artifacts
  const { artifacts } = require('arnacon-sdk/dist/artifacts');
  const secondLevelInteractorAbi = artifacts.SecondLevelInteractor.abi;
  
  console.log(`Loaded ABI with ${secondLevelInteractorAbi.length} functions`);
  
  // Connect to the contract
  const provider = new ethers.providers.JsonRpcProvider('https://rpc.hoodi.ethpandaops.io');
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
  
  const tx = await secondLevelInteractor.registerSubnodeRecord(
    pkeyAddress,    // owner - PKEY wallet (temporary)
    username,       // label - the subdomain
    DOMAIN_NAME,    // name - the parent domain (WITHOUT .global)
    expiry          // expiry - 1 year from now
  );
  
  console.log(`Transaction submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`ENS subdomain registered with PKEY as owner`);
  
  const fullDomain = `${username}.${DOMAIN_NAME}.global`;
  console.log(`Full domain: ${fullDomain}`);
  
  // Step 2: Set the address record on PublicResolver (pointing to Oasis wallet)
  console.log(`\nSetting address record on PublicResolver...`);
  const publicResolverAddress = '0x9427fF61d53deDB42102d84E0EC2927F910eF8f2';
  const publicResolverAbi = artifacts.PublicResolver.abi;
  
  const publicResolver = new ethers.Contract(
    publicResolverAddress,
    publicResolverAbi,
    wallet
  );
  
  const subdomainNode = ethers.utils.namehash(fullDomain);
  console.log(`Subdomain node: ${subdomainNode}`);
  console.log(`Setting address to Oasis wallet: ${userAddress}`);
  
  const setAddrTx = await publicResolver['setAddr(bytes32,address)'](subdomainNode, userAddress);
  console.log(`setAddr transaction submitted: ${setAddrTx.hash}`);
  
  const setAddrReceipt = await setAddrTx.wait();
  console.log(`Address record set on PublicResolver`);
  
  // Step 3: Transfer subdomain NFT ownership to Oasis wallet
  console.log(`\nTransferring subdomain ownership to Oasis wallet...`);
  const nameWrapperAddress = '0x0140420b3e02b1A7d4645cE330337bc8742C3Df5';
  const nameWrapperAbi = artifacts.NameWrapper.abi;
  
  const nameWrapper = new ethers.Contract(
    nameWrapperAddress,
    nameWrapperAbi,
    wallet
  );
  
  const tokenId = ethers.BigNumber.from(subdomainNode);
  const transferTx = await nameWrapper.safeTransferFrom(
    pkeyAddress,    // from - current owner (PKEY)
    userAddress,    // to - new owner (Oasis wallet)
    tokenId,        // tokenId - the subdomain node
    1,              // amount - always 1 for ERC1155 NFTs
    '0x'            // data - empty
  );
  
  console.log(`Transfer transaction submitted: ${transferTx.hash}`);
  const transferReceipt = await transferTx.wait();
  console.log(`Subdomain ownership transferred to Oasis wallet`);
  
  return {
    txHash: receipt.transactionHash,
    subdomain: fullDomain,
    secondLevelInteractor: secondLevelInteractorAddress,
    setAddrTxHash: setAddrReceipt.transactionHash
  };
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

    console.log('Creating Oasis user:', username);

    // Connect to Oasis Sapphire
    console.log('Connecting to Sapphire...');
    const { signer } = getSapphireConnection();
    console.log('Connected to Sapphire');
    
    // Get ConfidentialAuthAddressBased contract instance
    console.log('Getting contract instance...');
    const confidentialAuth = new ethers.Contract(CONFIDENTIAL_AUTH_ADDRESS, CONFIDENTIAL_AUTH_ABI, signer);
    console.log('Contract instance created');
    
    // Check if user already exists (try to get wallet address)
    console.log('Checking if user exists...');
    try {
      const existingAddress = await confidentialAuth.getWalletAddress(username);
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
    console.log('Password as bytes:', ethers.utils.hexlify(passwordBytes));
    
    const tx = await confidentialAuth.storeSecret(username, passwordBytes);
    console.log('Transaction submitted:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed! Block:', receipt.blockNumber);
    
    // Wait a bit for Sapphire to finalize the block for confidential reads
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get user wallet address
    const userAddress = await confidentialAuth.getWalletAddress(username);
    
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

    res.status(200).json({
      success: true,
      message: 'User created successfully on Oasis Sapphire and registered on ENS',
      oasis: {
        txHash: tx.hash,
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
    const { signer } = getSapphireConnection();
    
    // Get ConfidentialAuthAddressBased contract instance
    const confidentialAuth = new ethers.Contract(CONFIDENTIAL_AUTH_ADDRESS, CONFIDENTIAL_AUTH_ABI, signer);
    
    // Check if user exists
    try {
      await confidentialAuth.getWalletAddress(authUsername);
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
    const tx = await confidentialAuth.deleteSecret(authUsername, passwordBytes);
    console.log('Transaction submitted:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed! Block:', receipt.blockNumber);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully from Oasis Sapphire',
      txHash: tx.hash,
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
