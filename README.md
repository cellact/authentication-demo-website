# SIP auth_web3 Module Demo

A demonstration of blockchain-based SIP authentication using the `auth_web3` module for Kamailio/OpenSIPS.

## Purpose

This repository demonstrates:
- How to use the `auth_web3` module for blockchain-based SIP authentication
- How the module works behind the scenes
- The smart contract structure required for authentication
- How to create your own users that can authenticate with the module

## Live Demo

**Website**: [https://authdemo-omega.vercel.app](https://authdemo-omega.vercel.app)

Create a test SIP account and make calls to see blockchain-based authentication in action. Your credentials will be stored on Oasis Sapphire blockchain and your ENS identity will be registered on the Hoodi network.

## Project Structure

```
authentication-demo-website/
├── frontend/           # Frontend of website - nothing too interesting or new here
├── backend/            # Example of how to create a new user and add them to an existing system
├── server-examples/    # Generic Kamailio and OpenSIPS configurations with auth_web3 specific cfg
├── blockchain/         # Example code for the contracts themselves and deployment scripts if you want your own contracts
└── README.md
```

### Frontend
Web UI for account creation using Vite, Vanilla JavaScript, and Firebase Auth. Deployed on Vercel.

### Backend
Node.js Cloud Function demonstrating how to:
- Register ENS subdomains on Hoodi
- Store user credentials on Oasis Sapphire
- Create users that work with the auth_web3 module

### Server Examples
Generic SIP server configurations (Kamailio and OpenSIPS) showing the auth_web3-specific configuration blocks.

### Blockchain
Smart contract code and deployment scripts for setting up your own authentication system.

## Prerequisites

- Node.js 18+
- A SIP server (Kamailio or OpenSIPS) with `auth_web3` module installed
- Oasis Sapphire testnet access
- Hoodi network access
- Firebase project (for Google OAuth in the demo website)

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Configure Firebase in `index.html`:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};
```

## Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
PKEY=your_wallet_private_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com
```

The backend demonstrates how to create users that can authenticate with the auth_web3 module by interacting with the smart contracts.

## SIP Server Setup

See configuration examples in the `server-examples/` folder for Kamailio and OpenSIPS. These show the specific auth_web3 configuration blocks you need to add to your server.

## How Authentication Works

1. **User Registration** (via website/backend):
   - User credentials are stored in a smart contract on Oasis Sapphire
   - An ENS subdomain is registered on Hoodi network
   - The ENS name maps to a wallet address that owns the password

2. **SIP Authentication** (on REGISTER/INVITE):
   - Client sends SIP REGISTER with username/password
   - Kamailio/OpenSIPS calls `web3_www_authenticate()` or `web3_proxy_authenticate()`
   - Module queries ENS on Hoodi to resolve the username to a wallet address
   - Module queries the Oasis Sapphire contract to verify the password
   - Authentication succeeds if the password matches

## More Information

For detailed documentation about the auth_web3 module, visit:
https://github.com/kamailio/kamailio/tree/master/src/modules/auth_web3

## Demo Contracts

- **Authentication Contract** (Oasis Sapphire Testnet): `0xf4B4d8b8a9b1F104b2100F6d68e1ab21C3a2DF76`
- **ENS Registry** (Hoodi): `0x5841d17010252BE760D055cba2f2853874457443`
- **Domain**: `authdemo1765462240433.global`

## Contributing

Contributions welcome! This is a demo project to showcase blockchain-based SIP authentication.

## License

MIT License - feel free to use this as a reference for your own projects.
