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
}

// Export singleton instance
module.exports = new IPFSService();