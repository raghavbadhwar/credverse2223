const express = require('express');
const multer = require('multer');
const ipfsService = require('../services/ipfsService');
const { requireInstitution } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/json'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

/**
 * @route POST /api/ipfs/upload
 * @desc Upload file to IPFS
 * @access Institution only
 */
router.post('/upload', requireInstitution, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { originalname, buffer, mimetype, size } = req.file;

    // Upload to IPFS
    const result = await ipfsService.uploadImage(buffer, originalname);

    res.json({
      success: true,
      data: {
        cid: result.cid,
        url: result.url,
        fileName: result.fileName,
        size: size,
        mimetype: mimetype,
        uploadedAt: new Date().toISOString()
      },
      message: 'File uploaded to IPFS successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/ipfs/metadata
 * @desc Upload metadata to IPFS
 * @access Institution only
 */
router.post('/metadata', requireInstitution, async (req, res, next) => {
  try {
    const { metadata } = req.body;

    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Valid metadata object is required'
      });
    }

    // Upload metadata to IPFS
    const result = await ipfsService.uploadCredentialMetadata(metadata);

    res.json({
      success: true,
      data: {
        cid: result.cid,
        url: result.url,
        size: result.size,
        uploadedAt: new Date().toISOString()
      },
      message: 'Metadata uploaded to IPFS successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/ipfs/:cid
 * @desc Retrieve content from IPFS
 * @access Public
 */
router.get('/:cid', async (req, res, next) => {
  try {
    const { cid } = req.params;

    if (!cid) {
      return res.status(400).json({
        success: false,
        error: 'CID is required'
      });
    }

    // Retrieve from IPFS
    const metadata = await ipfsService.getCredentialMetadata(cid);

    res.json({
      success: true,
      data: metadata,
      cid: cid,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/ipfs/pin/:cid
 * @desc Pin content to IPFS
 * @access Institution only
 */
router.post('/pin/:cid', requireInstitution, async (req, res, next) => {
  try {
    const { cid } = req.params;

    if (!cid) {
      return res.status(400).json({
        success: false,
        error: 'CID is required'
      });
    }

    // Pin content
    await ipfsService.pinContent(cid);

    res.json({
      success: true,
      data: { cid },
      message: 'Content pinned successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/ipfs/pin/:cid
 * @desc Unpin content from IPFS
 * @access Institution only
 */
router.delete('/pin/:cid', requireInstitution, async (req, res, next) => {
  try {
    const { cid } = req.params;

    if (!cid) {
      return res.status(400).json({
        success: false,
        error: 'CID is required'
      });
    }

    // Unpin content
    await ipfsService.unpinContent(cid);

    res.json({
      success: true,
      data: { cid },
      message: 'Content unpinned successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/ipfs/status
 * @desc Get IPFS service status
 * @access Public
 */
router.get('/status', async (req, res, next) => {
  try {
    const isAvailable = await ipfsService.isAvailable();
    
    let nodeInfo = null;
    if (isAvailable) {
      try {
        nodeInfo = await ipfsService.getNodeInfo();
      } catch (error) {
        console.error('Failed to get IPFS node info:', error);
      }
    }

    res.json({
      success: true,
      data: {
        available: isAvailable,
        nodeInfo: nodeInfo,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;