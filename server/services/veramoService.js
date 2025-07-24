const { createAgent } = require('@veramo/core');
const { DIDManager } = require('@veramo/did-manager');
const { EthrDIDProvider } = require('@veramo/did-provider-ethr');
const { KeyDIDProvider } = require('@veramo/did-provider-key');
const { DIDResolverPlugin } = require('@veramo/did-resolver');
const { KeyManager } = require('@veramo/key-manager');
const { KeyManagementSystem, SecretBox } = require('@veramo/kms-local');
const { CredentialPlugin } = require('@veramo/credential-w3c');
const { getResolver as ethrDidResolver } = require('ethr-did-resolver');
const { getResolver as webDidResolver } = require('web-did-resolver');

/**
 * Veramo Agent Service for handling DIDs and Verifiable Credentials
 */
class VeramoService {
  constructor() {
    this.agent = null;
    this.init();
  }

  /**
   * Initialize Veramo agent
   */
  init() {
    // Secret key for local KMS (in production, use proper key management)
    const KMS_SECRET_KEY = process.env.KMS_SECRET_KEY || 
      '29739248cad1bd1a0fc4d9b75cd4d2990de535baf5caadfdf8d8f86664aa830c';

    // Create Veramo agent
    this.agent = createAgent({
      plugins: [
        new KeyManager({
          store: new Proxy({}, {
            get: () => undefined,
            set: () => true
          }), // In-memory store for demo
          kms: {
            local: new KeyManagementSystem(new SecretBox(KMS_SECRET_KEY))
          }
        }),
        new DIDManager({
          store: new Proxy({}, {
            get: () => undefined,
            set: () => true
          }), // In-memory store for demo
          defaultProvider: 'did:ethr:polygon',
          providers: {
            'did:ethr:polygon': new EthrDIDProvider({
              defaultKms: 'local',
              network: process.env.NODE_ENV === 'production' ? 'polygon' : 'mumbai',
              rpcUrl: process.env.NODE_ENV === 'production' 
                ? process.env.POLYGON_RPC_URL 
                : process.env.MUMBAI_RPC_URL,
              gas: 1000000,
              gasPrice: '30000000000'
            }),
            'did:key': new KeyDIDProvider({
              defaultKms: 'local'
            })
          }
        }),
        new DIDResolverPlugin({
          resolver: {
            ...ethrDidResolver({
              networks: [
                {
                  name: 'polygon',
                  rpcUrl: process.env.POLYGON_RPC_URL,
                  registry: '0x41D788c9c5D335362D713152F407692c5EEAfAae'
                },
                {
                  name: 'mumbai',
                  rpcUrl: process.env.MUMBAI_RPC_URL,
                  registry: '0x41D788c9c5D335362D713152F407692c5EEAfAae'
                }
              ]
            }),
            ...webDidResolver()
          }
        }),
        new CredentialPlugin()
      ]
    });
  }

  /**
   * Create a new DID for an institution
   */
  async createInstitutionDID(institutionName, walletAddress) {
    try {
      const identifier = await this.agent.didManagerCreate({
        provider: 'did:ethr:polygon',
        alias: `institution-${institutionName.toLowerCase().replace(/\s+/g, '-')}`
      });

      return {
        did: identifier.did,
        keys: identifier.keys,
        services: identifier.services
      };
    } catch (error) {
      console.error('Error creating institution DID:', error);
      throw new Error(`Failed to create DID: ${error.message}`);
    }
  }

  /**
   * Create a new DID for a student
   */
  async createStudentDID(studentEmail) {
    try {
      const identifier = await this.agent.didManagerCreate({
        provider: 'did:key',
        alias: `student-${studentEmail.toLowerCase().replace('@', '-at-')}`
      });

      return {
        did: identifier.did,
        keys: identifier.keys,
        services: identifier.services
      };
    } catch (error) {
      console.error('Error creating student DID:', error);
      throw new Error(`Failed to create DID: ${error.message}`);
    }
  }

  /**
   * Issue a Verifiable Credential
   */
  async issueCredential(credentialData) {
    try {
      const {
        issuerDID,
        subjectDID,
        credentialType,
        studentName,
        studentEmail,
        courseName,
        institutionName,
        graduationDate,
        grade,
        credentialId,
        expirationDate
      } = credentialData;

      // Create the credential subject
      const credentialSubject = {
        id: subjectDID,
        name: studentName,
        email: studentEmail,
        degree: {
          type: credentialType,
          name: courseName,
          institution: institutionName,
          graduationDate: graduationDate,
          grade: grade
        }
      };

      // Create the verifiable credential
      const credential = await this.agent.createVerifiableCredential({
        credential: {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://credverse.io/contexts/education/v1'
          ],
          type: ['VerifiableCredential', 'EducationCredential'],
          id: credentialId,
          issuer: {
            id: issuerDID,
            name: institutionName
          },
          issuanceDate: new Date().toISOString(),
          ...(expirationDate && { expirationDate: new Date(expirationDate).toISOString() }),
          credentialSubject: credentialSubject,
          credentialSchema: {
            id: 'https://credverse.io/schemas/education-credential.json',
            type: 'JsonSchemaValidator2018'
          }
        },
        proofFormat: 'jwt',
        save: false
      });

      return credential;
    } catch (error) {
      console.error('Error issuing credential:', error);
      throw new Error(`Failed to issue credential: ${error.message}`);
    }
  }

  /**
   * Verify a Verifiable Credential
   */
  async verifyCredential(verifiableCredential) {
    try {
      const result = await this.agent.verifyCredential({
        credential: verifiableCredential
      });

      return {
        verified: result.verified,
        issuer: result.verifiableCredential.issuer,
        subject: result.verifiableCredential.credentialSubject,
        issuanceDate: result.verifiableCredential.issuanceDate,
        expirationDate: result.verifiableCredential.expirationDate,
        errors: result.error ? [result.error] : []
      };
    } catch (error) {
      console.error('Error verifying credential:', error);
      return {
        verified: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Verify a Verifiable Presentation
   */
  async verifyPresentation(verifiablePresentation) {
    try {
      const result = await this.agent.verifyPresentation({
        presentation: verifiablePresentation
      });

      return {
        verified: result.verified,
        credentials: result.verifiablePresentation.verifiableCredential,
        holder: result.verifiablePresentation.holder,
        errors: result.error ? [result.error] : []
      };
    } catch (error) {
      console.error('Error verifying presentation:', error);
      return {
        verified: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Create a Verifiable Presentation
   */
  async createPresentation(credentials, holderDID, domain, challenge) {
    try {
      const presentation = await this.agent.createVerifiablePresentation({
        presentation: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiablePresentation'],
          holder: holderDID,
          verifiableCredential: credentials
        },
        proofFormat: 'jwt',
        domain: domain,
        challenge: challenge,
        save: false
      });

      return presentation;
    } catch (error) {
      console.error('Error creating presentation:', error);
      throw new Error(`Failed to create presentation: ${error.message}`);
    }
  }

  /**
   * Resolve a DID document
   */
  async resolveDID(did) {
    try {
      const result = await this.agent.resolveDid({ didUrl: did });
      return result;
    } catch (error) {
      console.error('Error resolving DID:', error);
      throw new Error(`Failed to resolve DID: ${error.message}`);
    }
  }

  /**
   * Get available DIDs
   */
  async getDIDs() {
    try {
      const identifiers = await this.agent.didManagerFind();
      return identifiers;
    } catch (error) {
      console.error('Error getting DIDs:', error);
      throw new Error(`Failed to get DIDs: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new VeramoService();