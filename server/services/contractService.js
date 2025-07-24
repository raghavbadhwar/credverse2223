const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Contract Service for interacting with CredentialRegistry smart contract
 */
class ContractService {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.wallet = null;
    this.contractAddress = null;
    this.abi = null;
    this.init();
  }

  /**
   * Initialize contract connection
   */
  init() {
    try {
      // Setup provider
      this.setupProvider();
      
      // Load contract ABI and address
      this.loadContract();
      
      // Setup wallet if private key is provided
      this.setupWallet();
      
      // Initialize contract instance
      this.initContract();
      
      console.log('✅ Contract service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize contract service:', error.message);
    }
  }

  /**
   * Setup blockchain provider
   */
  setupProvider() {
    const rpcUrl = process.env.NODE_ENV === 'production' 
      ? process.env.POLYGON_RPC_URL 
      : process.env.MUMBAI_RPC_URL;

    if (!rpcUrl) {
      throw new Error('RPC URL not configured in environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log(`🌐 Connected to ${process.env.NODE_ENV === 'production' ? 'Polygon' : 'Mumbai'} network`);
  }

  /**
   * Load contract ABI and address
   */
  loadContract() {
    // Try to load from deployments first
    const network = process.env.NODE_ENV === 'production' ? 'polygon' : 'mumbai';
    const deploymentFile = path.join(__dirname, '../contracts/CredentialRegistry.json');
    
    if (fs.existsSync(deploymentFile)) {
      const contractData = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      this.abi = contractData.abi;
      
      // Get address from networks or environment
      const chainId = process.env.NODE_ENV === 'production' ? 137 : 80001;
      if (contractData.networks && contractData.networks[chainId]) {
        this.contractAddress = contractData.networks[chainId].address;
      }
    }

    // Override with environment variable if provided
    if (process.env.CREDVERSE_REGISTRY_ADDRESS) {
      this.contractAddress = process.env.CREDVERSE_REGISTRY_ADDRESS;
    }

    if (!this.contractAddress || !this.abi) {
      throw new Error('Contract address or ABI not found. Make sure to deploy the contract first.');
    }

    console.log(`📄 Contract loaded: ${this.contractAddress}`);
  }

  /**
   * Setup wallet for signing transactions
   */
  setupWallet() {
    if (process.env.PRIVATE_KEY) {
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      console.log(`🔑 Wallet configured: ${this.wallet.address}`);
    } else {
      console.log('⚠️  No private key provided - read-only mode');
    }
  }

  /**
   * Initialize contract instance
   */
  initContract() {
    if (this.wallet) {
      this.contract = new ethers.Contract(this.contractAddress, this.abi, this.wallet);
    } else {
      this.contract = new ethers.Contract(this.contractAddress, this.abi, this.provider);
    }
  }

  /**
   * Check if contract service is ready
   */
  isReady() {
    return this.contract !== null && this.provider !== null;
  }

  /**
   * Get contract statistics
   */
  async getStats() {
    if (!this.isReady()) throw new Error('Contract service not ready');
    
    try {
      const [totalCredentials, totalInstitutions, totalRevoked] = await this.contract.getStats();
      return {
        totalCredentials: totalCredentials.toString(),
        totalInstitutions: totalInstitutions.toString(),
        totalRevoked: totalRevoked.toString()
      };
    } catch (error) {
      console.error('Error getting contract stats:', error);
      throw error;
    }
  }

  /**
   * Hash a credential ID
   */
  hashCredentialId(credentialId) {
    return ethers.keccak256(ethers.toUtf8Bytes(credentialId));
  }

  /**
   * Register an institution on the blockchain
   */
  async registerInstitution(name, did, fromAddress) {
    if (!this.isReady()) throw new Error('Contract service not ready');
    if (!this.wallet) throw new Error('Wallet not configured for transactions');

    try {
      // If fromAddress is provided, we need to use a different wallet
      let contractInstance = this.contract;
      if (fromAddress && fromAddress !== this.wallet.address) {
        console.log(`⚠️  Institution registration requested from ${fromAddress}, but using configured wallet ${this.wallet.address}`);
      }

      const tx = await contractInstance.registerInstitution(name, did);
      console.log(`📝 Institution registration transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Institution registered successfully in block ${receipt.blockNumber}`);
      
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error registering institution:', error);
      throw error;
    }
  }

  /**
   * Verify an institution (admin only)
   */
  async verifyInstitution(institutionAddress, verified) {
    if (!this.isReady()) throw new Error('Contract service not ready');
    if (!this.wallet) throw new Error('Wallet not configured for transactions');

    try {
      const tx = await this.contract.verifyInstitution(institutionAddress, verified);
      console.log(`📝 Institution verification transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Institution ${verified ? 'verified' : 'unverified'} successfully`);
      
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error verifying institution:', error);
      throw error;
    }
  }

  /**
   * Issue a credential on the blockchain
   */
  async issueCredential(credentialId, subjectAddress, ipfsHash, credentialType, expiresAt) {
    if (!this.isReady()) throw new Error('Contract service not ready');
    if (!this.wallet) throw new Error('Wallet not configured for transactions');

    try {
      const vcIdHash = this.hashCredentialId(credentialId);
      const expirationTimestamp = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : 0;
      const subject = subjectAddress || ethers.ZeroAddress;

      const tx = await this.contract.issueCredential(
        vcIdHash,
        subject,
        ipfsHash,
        credentialType,
        expirationTimestamp
      );
      
      console.log(`📝 Credential issuance transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Credential issued successfully in block ${receipt.blockNumber}`);
      
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        credentialHash: vcIdHash
      };
    } catch (error) {
      console.error('Error issuing credential:', error);
      throw error;
    }
  }

  /**
   * Revoke a credential
   */
  async revokeCredential(credentialId, reason) {
    if (!this.isReady()) throw new Error('Contract service not ready');
    if (!this.wallet) throw new Error('Wallet not configured for transactions');

    try {
      const vcIdHash = this.hashCredentialId(credentialId);
      
      const tx = await this.contract.revokeCredential(vcIdHash, reason);
      console.log(`📝 Credential revocation transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Credential revoked successfully in block ${receipt.blockNumber}`);
      
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error revoking credential:', error);
      throw error;
    }
  }

  /**
   * Get credential from blockchain
   */
  async getCredential(credentialId) {
    if (!this.isReady()) throw new Error('Contract service not ready');

    try {
      const vcIdHash = this.hashCredentialId(credentialId);
      const credential = await this.contract.getCredential(vcIdHash);
      
      return {
        issuer: credential.issuer,
        subject: credential.subject,
        ipfsHash: credential.ipfsHash,
        issuedAt: new Date(Number(credential.issuedAt) * 1000).toISOString(),
        expiresAt: credential.expiresAt > 0 ? new Date(Number(credential.expiresAt) * 1000).toISOString() : null,
        revoked: credential.revoked,
        revokedReason: credential.revokedReason,
        credentialType: credential.credentialType
      };
    } catch (error) {
      console.error('Error getting credential:', error);
      throw error;
    }
  }

  /**
   * Check if credential is valid
   */
  async isCredentialValid(credentialId) {
    if (!this.isReady()) throw new Error('Contract service not ready');

    try {
      const vcIdHash = this.hashCredentialId(credentialId);
      const [isValid, isExpired, isRevoked] = await this.contract.isValid(vcIdHash);
      
      return {
        isValid,
        isExpired,
        isRevoked
      };
    } catch (error) {
      console.error('Error checking credential validity:', error);
      throw error;
    }
  }

  /**
   * Get institution details
   */
  async getInstitution(address) {
    if (!this.isReady()) throw new Error('Contract service not ready');

    try {
      const institution = await this.contract.getInstitution(address);
      
      return {
        name: institution.name,
        did: institution.did,
        verified: institution.verified,
        active: institution.active,
        registeredAt: new Date(Number(institution.registeredAt) * 1000).toISOString()
      };
    } catch (error) {
      console.error('Error getting institution:', error);
      throw error;
    }
  }

  /**
   * Get credentials issued by an institution
   */
  async getIssuerCredentials(issuerAddress) {
    if (!this.isReady()) throw new Error('Contract service not ready');

    try {
      const credentialHashes = await this.contract.getIssuerCredentials(issuerAddress);
      return credentialHashes.map(hash => hash.toString());
    } catch (error) {
      console.error('Error getting issuer credentials:', error);
      throw error;
    }
  }

  /**
   * Get credentials for a subject
   */
  async getSubjectCredentials(subjectAddress) {
    if (!this.isReady()) throw new Error('Contract service not ready');

    try {
      const credentialHashes = await this.contract.getSubjectCredentials(subjectAddress);
      return credentialHashes.map(hash => hash.toString());
    } catch (error) {
      console.error('Error getting subject credentials:', error);
      throw error;
    }
  }

  /**
   * Listen to contract events
   */
  setupEventListeners() {
    if (!this.isReady()) return;

    // Listen to credential issued events
    this.contract.on('CredentialIssued', (credentialId, issuer, subject, ipfsHash, credentialType, expiresAt, event) => {
      console.log('🎉 Credential Issued:', {
        credentialId: credentialId.toString(),
        issuer,
        subject,
        ipfsHash,
        credentialType,
        expiresAt: expiresAt.toString(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    });

    // Listen to credential revoked events
    this.contract.on('CredentialRevoked', (credentialId, issuer, reason, event) => {
      console.log('⚠️  Credential Revoked:', {
        credentialId: credentialId.toString(),
        issuer,
        reason,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    });

    // Listen to institution registered events
    this.contract.on('InstitutionRegistered', (institutionAddress, name, did, event) => {
      console.log('🏛️  Institution Registered:', {
        institutionAddress,
        name,
        did,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    });

    console.log('👂 Event listeners setup complete');
  }

  /**
   * Get contract address
   */
  getContractAddress() {
    return this.contractAddress;
  }

  /**
   * Get network info
   */
  async getNetworkInfo() {
    if (!this.provider) return null;

    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      
      return {
        chainId: network.chainId.toString(),
        name: network.name,
        blockNumber,
        contractAddress: this.contractAddress
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new ContractService();