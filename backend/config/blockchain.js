import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Oasis Sapphire Provider (TEE chain for confidential operations)
let oasisProvider;
export function getOasisProvider() {
  if (!oasisProvider) {
    oasisProvider = new ethers.JsonRpcProvider(
      process.env.OASIS_RPC_URL || 'https://testnet.sapphire.oasis.dev'
    );
  }
  return oasisProvider;
}

// Hoodi Provider (Execution chain)
let hoodiProvider;
export function getHoodiProvider() {
  if (!hoodiProvider) {
    hoodiProvider = new ethers.JsonRpcProvider(
      process.env.HOODI_RPC_URL || 'https://rpc-testnet.hoodi.network'
    );
  }
  return hoodiProvider;
}

// Interactor Contract (on Oasis Sapphire)
export function getInteractorContract() {
  if (!process.env.INTERACTOR_CONTRACT_ADDRESS) {
    console.warn('INTERACTOR_CONTRACT_ADDRESS not set');
    return null;
  }

  const provider = getOasisProvider();
  const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  
  // TODO: Add actual ABI
  const abi = [
    "function addUser(string authUsername, string username, bytes32 passwordHash) external",
    "function deleteUser(string authUsername) external",
    "function authenticateAndSignRaw(string authUsername, string password, bytes txData) external returns (bytes)",
    "function getUser(string authUsername) external view returns (tuple(string username, string domain, uint256 createdAt))"
  ];

  return new ethers.Contract(
    process.env.INTERACTOR_CONTRACT_ADDRESS,
    abi,
    signer
  );
}

// Sponsor Contract (on Oasis Sapphire)
export function getSponsorContract() {
  if (!process.env.SPONSOR_CONTRACT_ADDRESS) {
    console.warn('SPONSOR_CONTRACT_ADDRESS not set');
    return null;
  }

  const provider = getOasisProvider();
  const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  
  // TODO: Add actual ABI
  const abi = [
    "function signType4Transaction(bytes txData) external returns (bytes)",
    "function sponsor(address user) external"
  ];

  return new ethers.Contract(
    process.env.SPONSOR_CONTRACT_ADDRESS,
    abi,
    signer
  );
}

// Helper to read data from Hoodi chain
export async function readFromHoodi(contractAddress, abi, method, params = []) {
  const provider = getHoodiProvider();
  const contract = new ethers.Contract(contractAddress, abi, provider);
  return await contract[method](...params);
}

// Helper to broadcast transaction to Hoodi
export async function broadcastToHoodi(signedTransaction) {
  const provider = getHoodiProvider();
  const txResponse = await provider.broadcastTransaction(signedTransaction);
  return await txResponse.wait();
}


