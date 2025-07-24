const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { requireRole, requireInstitution } = require('../middleware/auth');
const veramoService = require('../services/veramoService');
const ipfsService = require('../services/ipfsService');
const contractService = require('../services/contractService');
const { ethers } = require('ethers');

const router = express.Router();

/**
 * @route POST /api/credentials/issue
 * @desc Issue a new verifiable credential
 * @access Institution only
 */
router.post('/issue', requireInstitution, async (req, res, next) => {
  try {
    const {
      studentName,
      studentEmail,
      courseName,
      credentialType,
      graduationDate,
      grade,
      expirationDate,
      studentWallet,
      evidence
    } = req.body;

    // Validate required fields
    if (!studentName || !studentEmail || !courseName || !credentialType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: studentName, studentEmail, courseName, credentialType'
      });
    }

    // Generate unique credential ID
    const credentialId = `cred-${uuidv4()}`;

    // Get institution details from database (mock for now)
    const institutionData = {
      name: 'Sample University', // Should come from database
      did: 'did:ethr:polygon:0x123...', // Should come from database
      walletAddress: req.user.walletAddress
    };

    // Create or get student DID
    const studentDID = await veramoService.createStudentDID(studentEmail);

    // Prepare credential data
    const credentialData = {
      credentialId,
      issuerDID: institutionData.did,
      subjectDID: studentDID.did,
      credentialType,
      studentName,
      studentEmail,
      courseName,
      institutionName: institutionData.name,
      graduationDate,
      grade,
      expirationDate,
      evidence: evidence || []
    };

    // Create credential metadata for IPFS
    const metadata = ipfsService.createCredentialMetadata(credentialData);

    // Upload metadata to IPFS
    const ipfsResult = await ipfsService.uploadCredentialMetadata(metadata);

    // Issue verifiable credential using Veramo
    const verifiableCredential = await veramoService.issueCredential(credentialData);

    // Upload the full VC to IPFS
    const vcMetadata = {
      ...metadata,
      verifiableCredential: verifiableCredential
    };
    const vcIpfsResult = await ipfsService.uploadCredentialMetadata(vcMetadata);

    // Register credential on blockchain
    let blockchainResult = null;
    if (contractService.isReady()) {
      try {
        blockchainResult = await contractService.issueCredential(
          credentialId,
          studentWallet,
          vcIpfsResult.cid,
          credentialType,
          expirationDate
        );
        console.log('✅ Credential registered on blockchain:', blockchainResult.transactionHash);
      } catch (error) {
        console.error('❌ Blockchain registration failed:', error);
        // Continue without blockchain registration
      }
    }

    // Generate QR code for easy sharing
    const qrData = {
      credentialId,
      verifyUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/verify/${credentialId}`,
      ipfsHash: ipfsResult.cid
    };
    
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));

    // Save to database (implement based on your choice - Supabase/Firebase)
    // await saveCredentialToDatabase({ ... });

    res.status(201).json({
      success: true,
      data: {
        credentialId,
        verifiableCredential,
        ipfs: {
          metadataCid: ipfsResult.cid,
          metadataUrl: ipfsResult.url,
          vcCid: vcIpfsResult.cid,
          vcUrl: vcIpfsResult.url
        },
        qrCode: qrCodeDataURL,
        blockchain: blockchainResult || null,
        studentDID: studentDID.did,
        issuerDID: institutionData.did
      },
      message: 'Credential issued successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/credentials/issued
 * @desc Get credentials issued by the institution
 * @access Institution only
 */
router.get('/issued', requireInstitution, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;

    // Get credentials from blockchain or database
    // This is a mock response - implement based on your database
    const credentials = [
      {
        credentialId: 'cred-123',
        studentName: 'John Doe',
        courseName: 'Computer Science Degree',
        credentialType: 'Bachelor Degree',
        issuedAt: new Date().toISOString(),
        status: 'active'
      }
    ];

    res.json({
      success: true,
      data: {
        credentials,
        pagination: {
          currentPage: parseInt(page),
          totalPages: 1,
          totalCredentials: credentials.length,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/credentials/received/:walletAddress
 * @desc Get credentials received by a student
 * @access Any authenticated user
 */
router.get('/received/:walletAddress', async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    // Get credentials from blockchain
    let credentials = [];
    if (REGISTRY_ADDRESS) {
      try {
        const provider = new ethers.JsonRpcProvider(
          process.env.NODE_ENV === 'production' 
            ? process.env.POLYGON_RPC_URL 
            : process.env.MUMBAI_RPC_URL
        );
        
        const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
        const credentialIds = await registry.getRecipientCredentials(walletAddress);
        
        credentials = await Promise.all(
          credentialIds.map(async (id) => {
            const credential = await registry.getCredential(id);
            return {
              credentialId: id,
              issuer: credential.issuer,
              ipfsHash: credential.ipfsHash,
              credentialType: credential.credentialType,
              issuedAt: new Date(credential.issuedAt.toNumber() * 1000).toISOString(),
              isRevoked: credential.isRevoked
            };
          })
        );
      } catch (error) {
        console.error('Error fetching from blockchain:', error);
      }
    }

    res.json({
      success: true,
      data: {
        credentials,
        walletAddress,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(credentials.length / limit),
          totalCredentials: credentials.length,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/credentials/:credentialId
 * @desc Get a specific credential by ID
 * @access Public
 */
router.get('/:credentialId', async (req, res, next) => {
  try {
    const { credentialId } = req.params;

    // Get credential from blockchain
    if (!REGISTRY_ADDRESS) {
      return res.status(503).json({
        success: false,
        error: 'Registry contract not deployed'
      });
    }

    const provider = new ethers.JsonRpcProvider(
      process.env.NODE_ENV === 'production' 
        ? process.env.POLYGON_RPC_URL 
        : process.env.MUMBAI_RPC_URL
    );
    
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
    
    try {
      const credential = await registry.getCredential(credentialId);
      
      // Get metadata from IPFS
      let metadata = null;
      try {
        metadata = await ipfsService.getCredentialMetadata(credential.ipfsHash);
      } catch (error) {
        console.error('Failed to fetch IPFS metadata:', error);
      }

      res.json({
        success: true,
        data: {
          credentialId,
          issuer: credential.issuer,
          recipient: credential.recipient,
          ipfsHash: credential.ipfsHash,
          credentialType: credential.credentialType,
          issuedAt: new Date(credential.issuedAt.toNumber() * 1000).toISOString(),
          expiresAt: credential.expiresAt.toNumber() > 0 
            ? new Date(credential.expiresAt.toNumber() * 1000).toISOString() 
            : null,
          isRevoked: credential.isRevoked,
          revokedReason: credential.revokedReason || null,
          metadata
        }
      });

    } catch (error) {
      if (error.message.includes('Credential does not exist')) {
        return res.status(404).json({
          success: false,
          error: 'Credential not found'
        });
      }
      throw error;
    }

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/credentials/:credentialId/revoke
 * @desc Revoke a credential
 * @access Institution that issued the credential
 */
router.post('/:credentialId/revoke', requireInstitution, async (req, res, next) => {
  try {
    const { credentialId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Revocation reason is required'
      });
    }

    if (!REGISTRY_ADDRESS) {
      return res.status(503).json({
        success: false,
        error: 'Registry contract not deployed'
      });
    }

    const provider = new ethers.JsonRpcProvider(
      process.env.NODE_ENV === 'production' 
        ? process.env.POLYGON_RPC_URL 
        : process.env.MUMBAI_RPC_URL
    );
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);

    const tx = await registry.revokeCredential(credentialId, reason);
    await tx.wait();

    res.json({
      success: true,
      data: {
        credentialId,
        revokedAt: new Date().toISOString(),
        reason,
        transactionHash: tx.hash
      },
      message: 'Credential revoked successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/credentials/batch-issue
 * @desc Issue multiple credentials from CSV upload
 * @access Institution only
 */
router.post('/batch-issue', requireInstitution, async (req, res, next) => {
  try {
    const { students } = req.body; // Array of student data

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Students array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const studentData of students) {
      try {
        // Process each student (similar to single issue logic)
        const credentialId = `cred-${uuidv4()}`;
        
        // Implementation similar to single issue...
        // This is a simplified version
        results.push({
          studentEmail: studentData.email,
          credentialId,
          status: 'success'
        });

      } catch (error) {
        errors.push({
          studentEmail: studentData.email,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalProcessed: students.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      },
      message: `Batch processing completed. ${results.length} successful, ${errors.length} failed.`
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;