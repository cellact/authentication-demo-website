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
```

Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

Edit `.env` with your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_API_URL=https://your-backend-url.run.app
```

Run the development server:
```bash
npm run dev
```

## Backend Setup

```bash
cd backend
npm install
```

Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
PKEY=your_wallet_private_key
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM=your_gmail_address@gmail.com
MAINTAINER_EMAIL=admin@example.com
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
- **Domain**: `demoauth.global`

## Contributing

Contributions welcome! This is a demo project to showcase blockchain-based SIP authentication.

## Security Notes

- Firebase API keys are intentionally public (they identify your project, not authenticate it)
- Security is enforced via Firebase domain restrictions and authentication rules
- Never commit your `.env` files - they contain private keys and credentials
- The backend wallet private key (`PKEY`) must be kept secret

## License

MIT License - feel free to use this as a reference for your own projects.
