# SIP auth_web3 Module Demo

A demonstration of blockchain-based SIP authentication using the `auth_web3` module for Kamailio.

## 🎯 What This Is

This project showcases how to authenticate SIP users via blockchain smart contracts instead of traditional databases. User credentials are stored on:
- **Oasis Sapphire** (confidential EVM blockchain) - for password storage
- **Hoodi Network** (ENS-compatible chain) - for ENS identity mapping

## 🚀 Live Demo

**Website**: [https://authdemo-omega.vercel.app](https://authdemo-omega.vercel.app)

Create a free SIP account and test blockchain-based authentication in seconds!

## 📦 Project Structure

```
authentication-demo-website/
├── frontend/           # Web UI for account creation (Vite + Vanilla JS)
├── backend/            # Cloud Function for ENS registration (Node.js)
├── server-examples/    # Example SIP server configurations
├── blockchain/         # Smart contract deployment scripts (coming soon)
└── README.md          # This file
```

## 🔧 Components

### Frontend
- **Tech**: Vite, Vanilla JavaScript, Firebase Auth
- **Deploy**: Vercel
- **Purpose**: User-friendly interface for creating blockchain-backed SIP accounts

### Backend
- **Tech**: Node.js, Google Cloud Functions, ethers.js
- **Purpose**: 
  - Register ENS subdomains on Hoodi
  - Store credentials on Oasis Sapphire
  - Send credentials via email

### SIP Server
- **Server**: Kamailio (OpenSIPS support coming soon)
- **Module**: `auth_web3` - custom authentication module
- **Purpose**: Authenticate SIP REGISTER/INVITE via blockchain RPC calls

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- A SIP server (Kamailio) with `auth_web3` module
- Oasis Sapphire testnet access
- Hoodi network access
- Firebase project (for Google OAuth)
- Google Cloud account (for backend deployment)

### Frontend Setup

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

### Backend Setup

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

Deploy to Google Cloud Functions:
```bash
gcloud functions deploy helloHttp \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point helloHttp \
  --set-env-vars EMAIL_USER=...,EMAIL_FROM=... \
  --set-secrets EMAIL_PASS=...
```

### SIP Server Setup

See `server-examples/kamailio_example.cfg` for a complete configuration example.

Key requirements:
1. Load `auth_web3.so` module
2. Configure blockchain RPC endpoints
3. Use `web3_www_authenticate()` for REGISTER
4. Use `web3_proxy_authenticate()` for INVITE

## 🔐 How Authentication Works

1. **User Registration** (via website):
   - User logs in with Google
   - Backend creates wallet address
   - Password stored in Oasis Sapphire contract (encrypted)
   - ENS subdomain registered on Hoodi
   - Credentials emailed to user

2. **SIP Authentication** (on REGISTER/INVITE):
   - Client sends SIP REGISTER with username/password
   - Kamailio calls `web3_www_authenticate()`
   - Module queries ENS on Hoodi for wallet address
   - Module queries Oasis Sapphire contract to verify password
   - Success = 200 OK, Failure = 401/407 challenge

## 📚 Resources

- **auth_web3 Module**: [GitHub Repository](#) (coming soon)
- **Oasis Sapphire**: [https://docs.oasis.io/sapphire](https://docs.oasis.io/sapphire)
- **Hoodi Network**: [https://hoodi.network](https://hoodi.network)
- **Kamailio**: [https://www.kamailio.org](https://www.kamailio.org)

## 🤝 Contributing

Contributions welcome! This is a demo project to showcase blockchain-based SIP authentication.

## 📄 License

MIT License - feel free to use this as a reference for your own projects.

## 🔗 Demo Contracts

- **Authentication Contract** (Oasis Sapphire Testnet): `0xf4B4d8b8a9b1F104b2100F6d68e1ab21C3a2DF76`
- **ENS Registry** (Hoodi): `0x5841d17010252BE760D055cba2f2853874457443`
- **Domain**: `authdemo1765462240433.global`

## 💬 Support

For questions about the `auth_web3` module or blockchain-based SIP authentication, feel free to open an issue!

