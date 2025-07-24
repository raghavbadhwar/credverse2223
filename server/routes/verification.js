const express = require('express');
const { ethers } = require('ethers');
const veramoService = require('../services/veramoService');
const ipfsService = require('../services/ipfsService');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Load contract ABI and address
const REGISTRY_ABI = require('../contracts/CredVerseRegistry.json');
const REGISTRY_ADDRESS = process.env.CREDVERSE_REGISTRY_ADDRESS;

/**
 * @route GET /api/verify/:credentialId
 * @desc Verify a credential by ID (public endpoint)
 * @access Public
 */
router.get('/:credentialId', optionalAuth, async (req, res, next) => {
  try {
    const { credentialId } = req.params;
    const { includeMetadata = true } = req.query;

    if (!credentialId) {
      return res.status(400).json({
        success: false,
        error: 'Credential ID is required'
      });
    }

    // Initialize verification result
    const verificationResult = {
      credentialId,
      isValid: false,
      isExpired: false,
      isRevoked: false,
      issuer: null,
      recipient: null,
      credentialType: null,
      issuedAt: null,
      expiresAt: null,
      blockchain: {
        verified: false,
        network: process.env.NODE_ENV === 'production' ? 'polygon' : 'mumbai'
      },
      ipfs: {
        verified: false,
        metadata: null
      },
      veramo: {
        verified: false,
        errors: []
      }
    };

    // 1. Verify on blockchain
    if (REGISTRY_ADDRESS) {
      try {
        const provider = new ethers.JsonRpcProvider(
          process.env.NODE_ENV === 'production' 
            ? process.env.POLYGON_RPC_URL 
            : process.env.MUMBAI_RPC_URL
        );
        
        const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
        
        // Get credential from blockchain
        const blockchainResult = await registry.verifyCredential(credentialId);
        const credential = await registry.getCredential(credentialId);

        verificationResult.blockchain.verified = true;
        verificationResult.isValid = blockchainResult.isValid;
        verificationResult.isExpired = blockchainResult.isExpired;
        verificationResult.isRevoked = blockchainResult.isRevoked;
        verificationResult.issuer = blockchainResult.issuer;
        verificationResult.recipient = blockchainResult.recipient;
        verificationResult.credentialType = blockchainResult.credentialType;
        verificationResult.issuedAt = new Date(credential.issuedAt.toNumber() * 1000).toISOString();
        
        if (credential.expiresAt.toNumber() > 0) {
          verificationResult.expiresAt = new Date(credential.expiresAt.toNumber() * 1000).toISOString();
        }

        // 2. Verify IPFS metadata
        if (includeMetadata && credential.ipfsHash) {
          try {
            const metadata = await ipfsService.getCredentialMetadata(credential.ipfsHash);
            verificationResult.ipfs.verified = true;
            verificationResult.ipfs.metadata = metadata;
          } catch (error) {
            console.error('IPFS verification failed:', error);
            verificationResult.ipfs.error = error.message;
          }
        }

      } catch (error) {
        console.error('Blockchain verification failed:', error);
        verificationResult.blockchain.error = error.message;
        
        if (error.message.includes('Credential does not exist')) {
          return res.status(404).json({
            success: false,
            error: 'Credential not found',
            verificationResult
          });
        }
      }
    } else {
      verificationResult.blockchain.error = 'Registry contract not deployed';
    }

    // 3. Additional checks for comprehensive verification
    const overallValid = verificationResult.isValid && 
                        !verificationResult.isExpired && 
                        !verificationResult.isRevoked;

    // Log verification attempt (optional analytics)
    if (req.user) {
      console.log(`Verification by user ${req.user.email}: ${credentialId} - ${overallValid ? 'VALID' : 'INVALID'}`);
    } else {
      console.log(`Public verification: ${credentialId} - ${overallValid ? 'VALID' : 'INVALID'}`);
    }

    res.json({
      success: true,
      data: {
        ...verificationResult,
        overallValid,
        verifiedAt: new Date().toISOString(),
        verifierInfo: req.user ? {
          id: req.user.id,
          role: req.user.role
        } : null
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/verify/credential
 * @desc Verify a Verifiable Credential JSON
 * @access Public
 */
router.post('/credential', optionalAuth, async (req, res, next) => {
  try {
    const { verifiableCredential } = req.body;

    if (!verifiableCredential) {
      return res.status(400).json({
        success: false,
        error: 'Verifiable credential is required'
      });
    }

    // Verify using Veramo
    const veramoResult = await veramoService.verifyCredential(verifiableCredential);

    // Extract credential info
    const credentialId = verifiableCredential.id;
    const issuer = verifiableCredential.issuer;
    const subject = verifiableCredential.credentialSubject;

    // Cross-verify with blockchain if credential ID exists
    let blockchainVerification = null;
    if (credentialId && REGISTRY_ADDRESS) {
      try {
        const provider = new ethers.JsonRpcProvider(
          process.env.NODE_ENV === 'production' 
            ? process.env.POLYGON_RPC_URL 
            : process.env.MUMBAI_RPC_URL
        );
        
        const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
        const blockchainResult = await registry.verifyCredential(credentialId);
        
        blockchainVerification = {
          verified: true,
          isValid: blockchainResult.isValid,
          isExpired: blockchainResult.isExpired,
          isRevoked: blockchainResult.isRevoked
        };
      } catch (error) {
        blockchainVerification = {
          verified: false,
          error: error.message
        };
      }
    }

    const overallValid = veramoResult.verified && 
                        (!blockchainVerification || blockchainVerification.isValid);

    res.json({
      success: true,
      data: {
        veramo: veramoResult,
        blockchain: blockchainVerification,
        credentialInfo: {
          id: credentialId,
          issuer: typeof issuer === 'string' ? issuer : issuer?.id,
          subject: subject?.id,
          type: verifiableCredential.type,
          issuanceDate: verifiableCredential.issuanceDate,
          expirationDate: verifiableCredential.expirationDate
        },
        overallValid,
        verifiedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/verify/presentation
 * @desc Verify a Verifiable Presentation
 * @access Public
 */
router.post('/presentation', optionalAuth, async (req, res, next) => {
  try {
    const { verifiablePresentation } = req.body;

    if (!verifiablePresentation) {
      return res.status(400).json({
        success: false,
        error: 'Verifiable presentation is required'
      });
    }

    // Verify using Veramo
    const veramoResult = await veramoService.verifyPresentation(verifiablePresentation);

    // Verify each credential in the presentation
    const credentialVerifications = [];
    if (veramoResult.credentials && Array.isArray(veramoResult.credentials)) {
      for (const credential of veramoResult.credentials) {
        const credVerification = await veramoService.verifyCredential(credential);
        credentialVerifications.push({
          credentialId: credential.id,
          verified: credVerification.verified,
          errors: credVerification.errors
        });
      }
    }

    const overallValid = veramoResult.verified && 
                        credentialVerifications.every(cv => cv.verified);

    res.json({
      success: true,
      data: {
        presentation: {
          verified: veramoResult.verified,
          holder: veramoResult.holder,
          errors: veramoResult.errors
        },
        credentials: credentialVerifications,
        overallValid,
        verifiedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/verify/qr
 * @desc Verify credential from QR code data
 * @access Public
 */
router.post('/qr', optionalAuth, async (req, res, next) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        error: 'QR code data is required'
      });
    }

    let parsedData;
    try {
      parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid QR code data format'
      });
    }

    const { credentialId, ipfsHash, verifyUrl } = parsedData;

    if (!credentialId) {
      return res.status(400).json({
        success: false,
        error: 'QR code must contain credential ID'
      });
    }

    // Redirect to credential verification
    req.params.credentialId = credentialId;
    req.query.includeMetadata = 'true';
    
    // Call the credential verification endpoint
    return router.handle(
      { ...req, method: 'GET', url: `/${credentialId}` },
      res,
      next
    );

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/verify/batch/:institutionAddress
 * @desc Get verification statistics for an institution
 * @access Public
 */
router.get('/batch/:institutionAddress', optionalAuth, async (req, res, next) => {
  try {
    const { institutionAddress } = req.params;
    const { timeframe = '30d' } = req.query;

    if (!ethers.isAddress(institutionAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid institution address'
      });
    }

    // This would typically query your analytics database
    // For now, return mock data
    const stats = {
      institution: institutionAddress,
      timeframe,
      credentialsIssued: 150,
      credentialsVerified: 89,
      uniqueVerifiers: 34,
      verificationsByDay: [
        { date: '2024-01-01', count: 5 },
        { date: '2024-01-02', count: 8 },
        // ... more data
      ],
      topCredentialTypes: [
        { type: 'Bachelor Degree', count: 45 },
        { type: 'Certificate', count: 28 },
        { type: 'Diploma', count: 16 }
      ]
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/verify/status
 * @desc Get verification service status
 * @access Public
 */
router.get('/status', async (req, res) => {
  const status = {
    service: 'CredVerse Verification Service',
    timestamp: new Date().toISOString(),
    blockchain: {
      connected: false,
      network: process.env.NODE_ENV === 'production' ? 'polygon' : 'mumbai',
      registryAddress: REGISTRY_ADDRESS || null
    },
    ipfs: {
      connected: await ipfsService.isAvailable()
    },
    veramo: {
      available: true
    }
  };

  // Test blockchain connection
  if (REGISTRY_ADDRESS) {
    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.NODE_ENV === 'production' 
          ? process.env.POLYGON_RPC_URL 
          : process.env.MUMBAI_RPC_URL
      );
      
      await provider.getBlockNumber();
      status.blockchain.connected = true;
    } catch (error) {
      status.blockchain.error = error.message;
    }
  }

  const overallHealthy = status.blockchain.connected && 
                        status.ipfs.connected && 
                        status.veramo.available;

  res.status(overallHealthy ? 200 : 503).json({
    success: overallHealthy,
    data: status,
    healthy: overallHealthy
  });
});

module.exports = router;