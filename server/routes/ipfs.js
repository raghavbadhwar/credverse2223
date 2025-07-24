const express = require('express');
const multer = require('multer');
const ipfsService = require('../services/ipfsService');
const { requireInstitution, optionalAuth } = require('../middleware/auth');

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
      'application/json',
      'text/plain',
      'application/octet-stream'
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
 * @desc Upload file or JSON payload to IPFS
 * @access Institution only (for files) / Public (for JSON verification)
 */
router.post('/upload', optionalAuth, upload.single('file'), async (req, res, next) => {
  try {
    let result;
    let uploadType;
    let uploadedData;

    // Case 1: File upload (multipart/form-data)
    if (req.file) {
      const { originalname, buffer, mimetype, size } = req.file;
      
      // For JSON files, try to validate the content
      if (mimetype === 'application/json') {
        try {
          const jsonContent = JSON.parse(buffer.toString());
          uploadedData = jsonContent;
          uploadType = 'json_file';
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: 'Invalid JSON file format'
          });
        }
      } else {
        uploadType = 'file';
      }

      result = await ipfsService.addFile(buffer, originalname);
      
      res.json({
        success: true,
        data: {
          type: uploadType,
          cid: result.cid,
          url: result.url,
          fileName: result.fileName,
          size: size,
          mimetype: mimetype,
          uploadedAt: new Date().toISOString(),
          ...(uploadedData && { content: uploadedData })
        },
        message: `${uploadType === 'file' ? 'File' : 'JSON file'} uploaded to IPFS successfully`
      });
    }
    // Case 2: JSON payload (application/json) or raw string data
    else if (req.body !== undefined) {
      uploadType = 'json_payload';

      // Handle different types of body content
      if (typeof req.body === 'string') {
        // Raw string content (e.g., text/plain sent as string)
        uploadType = 'text_data';
        result = await ipfsService.addFile(req.body, 'data.txt');
        
        res.json({
          success: true,
          data: {
            type: uploadType,
            cid: result.cid,
            url: result.url,
            size: result.size,
            mimetype: 'text/plain',
            uploadedAt: new Date().toISOString(),
            content: req.body
          },
          message: 'Text data uploaded to IPFS successfully'
        });
      } else if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length > 0) {
        // Valid JSON object
        const jsonPayload = req.body;
        
        // Upload JSON payload directly using addFile
        result = await ipfsService.addFile(jsonPayload, 'data.json');

                      res.json({
          success: true,
          data: {
            type: uploadType,
            cid: result.cid,
            url: result.url,
            size: result.size,
            mimetype: 'application/json',
            uploadedAt: new Date().toISOString(),
            content: jsonPayload
          },
          message: 'JSON payload uploaded to IPFS successfully'
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload. Expected non-empty JSON object or string data.'
        });
      }
    }
    // Case 3: No valid input
    else {
      return res.status(400).json({
        success: false,
        error: 'No file or JSON payload provided. Send either a file via multipart/form-data or JSON data in request body.'
      });
    }

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/ipfs/:cid
 * @desc Fetch and return data from IPFS via CID
 * @access Public
 */
router.get('/:cid', async (req, res, next) => {
  try {
    const { cid } = req.params;
    const { format = 'auto', download = false } = req.query;

    if (!cid) {
      return res.status(400).json({
        success: false,
        error: 'CID is required'
      });
    }

    // Validate CID format (basic check)
    if (!/^[a-zA-Z0-9]+$/.test(cid) || cid.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CID format'
      });
    }

    try {
      // First, try to get the file using the new getFile method
      const buffer = await ipfsService.getFile(cid);
      
      // Try to parse as JSON first
      let data = null;
      let isJson = false;
      
      try {
        const jsonString = buffer.toString('utf8');
        data = JSON.parse(jsonString);
        isJson = true;
      } catch (parseError) {
        // Not JSON, handle as binary/text data
        isJson = false;
      }

      if (isJson) {
        // Handle JSON data
        if (format === 'raw') {
          // Return raw JSON string
          res.setHeader('Content-Type', 'application/json');
          if (download) {
            res.setHeader('Content-Disposition', `attachment; filename="${cid}.json"`);
          }
          return res.send(JSON.stringify(data, null, 2));
        } else {
          // Return formatted JSON response
          res.json({
            success: true,
            data: {
              cid: cid,
              type: 'json',
              content: data,
              retrievedAt: new Date().toISOString(),
              size: buffer.length
            }
          });
        }
      } else {
        // Handle non-JSON data
        const contentType = detectContentType(buffer);
        
        if (format === 'raw' || download) {
          // Return raw data
          res.setHeader('Content-Type', contentType);
          if (download) {
            res.setHeader('Content-Disposition', `attachment; filename="${cid}"`);
          }
          return res.send(buffer);
        } else {
          // Try to determine if it's text or binary
          const isText = isTextContent(buffer, contentType);
          
          res.json({
            success: true,
            data: {
              cid: cid,
              type: isText ? 'text' : 'binary',
              contentType: contentType,
              size: buffer.length,
              content: isText ? buffer.toString('utf8') : `<Binary data: ${buffer.length} bytes>`,
              retrievedAt: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'Content not found on IPFS',
        cid: cid,
        details: error.message
      });
    }

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/ipfs/metadata
 * @desc Upload credential metadata to IPFS (legacy endpoint)
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

/**
 * Helper function to detect content type from buffer
 */
function detectContentType(buffer) {
  // Check for common file signatures
  const firstBytes = buffer.slice(0, 10);
  
  // PNG
  if (firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47) {
    return 'image/png';
  }
  
  // JPEG
  if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8 && firstBytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PDF
  if (buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }
  
  // JSON (try to parse)
  try {
    const text = buffer.toString('utf8');
    JSON.parse(text);
    return 'application/json';
  } catch (e) {
    // Not JSON
  }
  
  // Check if it's plain text
  if (isTextContent(buffer)) {
    return 'text/plain';
  }
  
  return 'application/octet-stream';
}

/**
 * Helper function to check if content is text
 */
function isTextContent(buffer, contentType = null) {
  if (contentType) {
    return contentType.startsWith('text/') || 
           contentType === 'application/json' ||
           contentType === 'application/xml' ||
           contentType === 'application/javascript';
  }
  
  // Check for non-printable characters
  const text = buffer.toString('utf8');
  const nonPrintableRegex = /[\x00-\x08\x0E-\x1F\x7F-\x9F]/;
  return !nonPrintableRegex.test(text.slice(0, 1000)); // Check first 1000 chars
}

module.exports = router;