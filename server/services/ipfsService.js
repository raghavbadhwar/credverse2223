const { create } = require('ipfs-http-client');

/**
 * IPFS Service for storing and retrieving credential metadata
 */
class IPFSService {
  constructor() {
    this.client = null;
    this.init();
  }

  /**
   * Initialize IPFS client
   */
  init() {
    try {
      // Use Infura IPFS if credentials are provided
      if (process.env.IPFS_PROJECT_ID && process.env.IPFS_PROJECT_SECRET) {
        this.client = create({
          host: 'ipfs.infura.io',
          port: 5001,
          protocol: 'https',
          headers: {
            authorization: `Basic ${Buffer.from(
              `${process.env.IPFS_PROJECT_ID}:${process.env.IPFS_PROJECT_SECRET}`
            ).toString('base64')}`
          }
        });
        console.log('✅ IPFS client initialized with Infura');
      } else {
        // Fallback to local IPFS node
        this.client = create({
          host: 'localhost',
          port: 5001,
          protocol: 'http'
        });
        console.log('⚠️ IPFS client initialized with local node (fallback)');
      }
    } catch (error) {
      console.error('❌ Failed to initialize IPFS client:', error);
      this.client = null;
    }
  }

  /**
   * Upload credential metadata to IPFS
   */
  async uploadCredentialMetadata(metadata) {
    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }

    try {
      // Ensure metadata has required fields
      const credentialMetadata = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        ...metadata
      };

      // Convert to JSON and upload
      const metadataBuffer = Buffer.from(JSON.stringify(credentialMetadata, null, 2));
      const result = await this.client.add(metadataBuffer, {
        pin: true, // Pin to prevent garbage collection
        cidVersion: 1,
        hashAlg: 'sha2-256'
      });

      console.log(`📎 Credential metadata uploaded to IPFS: ${result.cid.toString()}`);

      return {
        cid: result.cid.toString(),
        path: result.path,
        size: result.size,
        url: `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.io'}/ipfs/${result.cid.toString()}`
      };
    } catch (error) {
      console.error('❌ Failed to upload to IPFS:', error);
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Retrieve credential metadata from IPFS
   */
  async getCredentialMetadata(cid) {
    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }

    try {
      const stream = this.client.cat(cid);
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const data = Buffer.concat(chunks);
      const metadata = JSON.parse(data.toString());

      console.log(`📥 Retrieved credential metadata from IPFS: ${cid}`);
      return metadata;
    } catch (error) {
      console.error('❌ Failed to retrieve from IPFS:', error);
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }

  /**
   * Upload institution logo or image
   */
  async uploadImage(imageBuffer, fileName) {
    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }

    try {
      const result = await this.client.add(imageBuffer, {
        pin: true,
        cidVersion: 1,
        hashAlg: 'sha2-256'
      });

      console.log(`🖼️ Image uploaded to IPFS: ${result.cid.toString()}`);

      return {
        cid: result.cid.toString(),
        path: result.path,
        size: result.size,
        url: `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.io'}/ipfs/${result.cid.toString()}`,
        fileName: fileName
      };
    } catch (error) {
      console.error('❌ Failed to upload image to IPFS:', error);
      throw new Error(`IPFS image upload failed: ${error.message}`);
    }
  }

  /**
   * Pin content to IPFS
   */
  async pinContent(cid) {
    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }

    try {
      await this.client.pin.add(cid);
      console.log(`📌 Content pinned to IPFS: ${cid}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to pin content:', error);
      throw new Error(`IPFS pin failed: ${error.message}`);
    }
  }

  /**
   * Unpin content from IPFS
   */
  async unpinContent(cid) {
    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }

    try {
      await this.client.pin.rm(cid);
      console.log(`📌 Content unpinned from IPFS: ${cid}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to unpin content:', error);
      throw new Error(`IPFS unpin failed: ${error.message}`);
    }
  }

  /**
   * Get IPFS node info
   */
  async getNodeInfo() {
    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }

    try {
      const id = await this.client.id();
      return {
        id: id.id,
        publicKey: id.publicKey,
        addresses: id.addresses,
        agentVersion: id.agentVersion,
        protocolVersion: id.protocolVersion
      };
    } catch (error) {
      console.error('❌ Failed to get IPFS node info:', error);
      throw new Error(`IPFS node info failed: ${error.message}`);
    }
  }

  /**
   * Check if IPFS is available
   */
  async isAvailable() {
    try {
      if (!this.client) {
        return false;
      }
      await this.client.version();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create credential metadata object
   */
  createCredentialMetadata(credentialData) {
    return {
      credentialId: credentialData.credentialId,
      credentialType: credentialData.credentialType,
      issuer: {
        name: credentialData.institutionName,
        did: credentialData.issuerDID,
        logo: credentialData.institutionLogo || null
      },
      subject: {
        name: credentialData.studentName,
        email: credentialData.studentEmail,
        did: credentialData.subjectDID
      },
      achievement: {
        name: credentialData.courseName,
        description: credentialData.courseDescription || null,
        type: credentialData.credentialType,
        grade: credentialData.grade || null,
        completionDate: credentialData.graduationDate
      },
      evidence: credentialData.evidence || [],
      schema: {
        id: 'https://credverse.io/schemas/education-credential.json',
        type: 'JsonSchemaValidator2018'
      },
      display: {
        backgroundColor: credentialData.backgroundColor || '#ffffff',
        textColor: credentialData.textColor || '#000000',
        logo: credentialData.institutionLogo || null
      }
    };
  }

  /**
   * Add any file or data to IPFS
   * @param {Buffer|string|Object} data - Data to upload (Buffer, string, or object)
   * @param {string} fileName - Optional file name for metadata
   * @returns {Promise<{cid: string, url: string, size: number}>}
   */
  async addFile(data, fileName = 'file') {
    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }

    try {
      let buffer;
      
      // Convert different data types to buffer
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (typeof data === 'string') {
        buffer = Buffer.from(data, 'utf8');
      } else if (typeof data === 'object') {
        buffer = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
      } else {
        throw new Error('Unsupported data type. Use Buffer, string, or object.');
      }

      const result = await this.client.add(buffer, {
        pin: true,
        cidVersion: 1
      });

      const cid = result.cid.toString();
      const gatewayUrl = process.env.IPFS_GATEWAY_URL || 'https://ipfs.infura.io/ipfs';
      
      console.log(`✅ File uploaded to IPFS: ${cid} (${buffer.length} bytes)`);
      
      return {
        cid: cid,
        url: `${gatewayUrl}/${cid}`,
        size: buffer.length,
        fileName: fileName
      };
    } catch (error) {
      console.error('❌ Error uploading file to IPFS:', error);
      throw new Error(`Failed to upload file to IPFS: ${error.message}`);
    }
  }

  /**
   * Get file from IPFS by CID
   * @param {string} cid - IPFS Content ID
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Buffer>} - File content as buffer
   */
  async getFile(cid, options = {}) {
    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }

    if (!cid) {
      throw new Error('CID is required');
    }

    try {
      const stream = this.client.cat(cid, {
        timeout: options.timeout || 30000 // 30 seconds timeout
      });

      const chunks = [];
      let totalSize = 0;
      const maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB default limit

      for await (const chunk of stream) {
        totalSize += chunk.length;
        
        if (totalSize > maxSize) {
          throw new Error(`File too large. Maximum size: ${maxSize} bytes`);
        }
        
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      console.log(`✅ File retrieved from IPFS: ${cid} (${buffer.length} bytes)`);
      
      return buffer;
    } catch (error) {
      console.error(`❌ Error retrieving file from IPFS (${cid}):`, error);
      
      if (error.message.includes('timeout')) {
        throw new Error('IPFS request timeout. The content might not be available.');
      } else if (error.message.includes('not found')) {
        throw new Error('Content not found on IPFS network.');
      } else {
        throw new Error(`Failed to retrieve file from IPFS: ${error.message}`);
      }
    }
  }

  /**
   * Get file from IPFS and parse as JSON
   * @param {string} cid - IPFS Content ID
   * @returns {Promise<Object>} - Parsed JSON object
   */
  async getFileAsJson(cid) {
    try {
      const buffer = await this.getFile(cid);
      const jsonString = buffer.toString('utf8');
      return JSON.parse(jsonString);
    } catch (error) {
      if (error.message.includes('JSON')) {
        throw new Error('File is not valid JSON format');
      }
      throw error;
    }
  }

  /**
   * Get file from IPFS and return as text
   * @param {string} cid - IPFS Content ID
   * @param {string} encoding - Text encoding (default: utf8)
   * @returns {Promise<string>} - File content as text
   */
  async getFileAsText(cid, encoding = 'utf8') {
    try {
      const buffer = await this.getFile(cid);
      return buffer.toString(encoding);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a file exists on IPFS
   * @param {string} cid - IPFS Content ID
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(cid) {
    try {
      await this.getFile(cid, { maxSize: 1 }); // Just check first byte
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
module.exports = new IPFSService();