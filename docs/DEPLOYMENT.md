# CredVerse Smart Contract Deployment Guide

This guide will walk you through deploying the CredentialRegistry smart contract to Polygon testnet (Mumbai) and connecting it to the backend.

## 📋 Prerequisites

1. **Node.js 18+** installed
2. **Metamask** wallet with Mumbai testnet configured
3. **Test MATIC** for Mumbai testnet ([Get from faucet](https://faucet.polygon.technology/))
4. **Infura** or **Alchemy** account for RPC endpoints
5. **PolygonScan API key** (optional, for verification)

## 🔧 Environment Setup

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure your .env file:**
   ```bash
   # Blockchain Configuration
   PRIVATE_KEY=your_private_key_without_0x_prefix
   MUMBAI_RPC_URL=https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID
   POLYGONSCAN_API_KEY=your_polygonscan_api_key

   # IPFS Configuration
   IPFS_PROJECT_ID=your_infura_ipfs_project_id
   IPFS_PROJECT_SECRET=your_infura_ipfs_secret

   # Other configurations...
   ```

   ⚠️ **Security Note:** Never commit your private key to version control!

## 🚀 Deployment Steps

### 1. Install Dependencies
```bash
cd contracts
npm install
```

### 2. Compile Contracts
```bash
npm run compile
# or
npx hardhat compile
```

### 3. Run Tests (Optional)
```bash
npm test
# or
npx hardhat test
```

### 4. Deploy to Mumbai Testnet
```bash
npm run deploy -- --network mumbai
# or
npx hardhat run scripts/deploy.js --network mumbai
```

**Expected Output:**
```
🚀 Deploying CredentialRegistry to mumbai
==========================================
📝 Deploying contracts with account: 0x1234...
💰 Account balance: 1.5 MATIC
🔨 Deploying CredentialRegistry...
✅ CredentialRegistry deployed to: 0xABCDEF123456...
📄 Transaction hash: 0x789012...
⏳ Waiting for confirmations...
✅ Contract confirmed on blockchain
📊 Initial stats: { totalCredentials: '0', totalInstitutions: '0', totalRevoked: '0' }
👑 Deployer has admin role: true

=== DEPLOYMENT SUMMARY ===
🌐 Network: mumbai
📄 Contract: CredentialRegistry
📍 Address: 0xABCDEF123456...
🏠 Deployer: 0x1234...
⛽ Chain ID: 80001
💾 Saved to: deployments/mumbai.json

📝 Environment Variables to Update:
CREDVERSE_REGISTRY_ADDRESS=0xABCDEF123456...
CHAIN_ID=80001

✅ Deployment completed successfully! 🎉
```

### 5. Update Environment Variables
Update your `.env` file with the deployed contract address:
```bash
CREDVERSE_REGISTRY_ADDRESS=0xABCDEF123456...
CHAIN_ID=80001
```

### 6. Verify Contract (Optional)
```bash
npx hardhat verify --network mumbai 0xABCDEF123456...
```

## 🔗 Backend Integration

The contract is automatically integrated with the backend through the `contractService.js`. When you start the server, it will:

1. ✅ Connect to the deployed contract
2. ✅ Load the ABI from deployment files
3. ✅ Setup event listeners
4. ✅ Enable blockchain credential operations

**Start the backend:**
```bash
cd ../server
npm run dev
```

You should see:
```
✅ Contract service initialized successfully
🌐 Connected to Mumbai network
📄 Contract loaded: 0xABCDEF123456...
🔑 Wallet configured: 0x1234...
👂 Event listeners setup complete
```

## 🧪 Testing the Integration

### 1. Register an Institution
```bash
curl -X POST http://localhost:3001/api/institutions/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test University",
    "did": "did:ethr:0x123456789"
  }'
```

### 2. Verify Institution (Admin)
```bash
curl -X POST http://localhost:3001/api/institutions/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "institutionAddress": "0x...",
    "verified": true
  }'
```

### 3. Issue a Credential
```bash
curl -X POST http://localhost:3001/api/credentials/issue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_INSTITUTION_TOKEN" \
  -d '{
    "studentName": "Riya Sharma",
    "studentEmail": "riya@example.com",
    "courseName": "B.Com (Hons) in Finance",
    "credentialType": "BachelorDegree",
    "graduationDate": "2025-07-25",
    "grade": "A",
    "studentWallet": "0x..."
  }'
```

### 4. Verify a Credential
```bash
curl http://localhost:3001/api/verify/YOUR_CREDENTIAL_ID
```

## 📊 Monitoring & Analytics

### View Contract on PolygonScan
- **Mumbai Testnet:** https://mumbai.polygonscan.com/address/YOUR_CONTRACT_ADDRESS
- **Polygon Mainnet:** https://polygonscan.com/address/YOUR_CONTRACT_ADDRESS

### Check Contract Stats
```bash
curl http://localhost:3001/api/verify/status
```

### View Events
The backend automatically logs all contract events:
- 🎉 **Credential Issued**
- ⚠️ **Credential Revoked**  
- 🏛️ **Institution Registered**

## 🔄 Mainnet Deployment

When ready for production:

1. **Update environment:**
   ```bash
   NODE_ENV=production
   POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
   ```

2. **Deploy to Polygon mainnet:**
   ```bash
   npx hardhat run scripts/deploy.js --network polygon
   ```

3. **Update contract address in .env**

## 🛠️ Troubleshooting

### Common Issues:

**1. "insufficient funds for intrinsic transaction cost"**
- Solution: Add more MATIC to your wallet

**2. "Contract service not ready"**
- Check `.env` configuration
- Ensure `CREDVERSE_REGISTRY_ADDRESS` is set
- Verify RPC URL is accessible

**3. "Failed to verify signature"**
- Check private key format (no 0x prefix)
- Ensure wallet has sufficient balance

**4. "Institution not verified"**
- Admin must verify institutions before they can issue credentials
- Use the admin endpoint to verify institutions

### Debug Commands:

```bash
# Check contract deployment
npx hardhat run scripts/verify-deployment.js --network mumbai

# Test contract interaction
npm run test:integration

# Check backend contract connection
curl http://localhost:3001/api/verify/status
```

## 📚 Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Polygon Documentation](https://docs.polygon.technology/)
- [Mumbai Testnet Faucet](https://faucet.polygon.technology/)
- [PolygonScan](https://polygonscan.com/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)

## 🔐 Security Best Practices

1. **Never expose private keys**
2. **Use hardware wallets for mainnet**
3. **Regular security audits**
4. **Monitor contract events**
5. **Keep dependencies updated**
6. **Use proper access controls**

---

🎉 **Congratulations!** Your CredVerse smart contract is now deployed and integrated with the backend. You can start issuing and verifying credentials on the blockchain!