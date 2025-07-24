const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry", function () {
  let registry;
  let owner, institution, student, verifier, admin;
  let institutionAddress, studentAddress;

  const INSTITUTION_NAME = "Harvard University";
  const INSTITUTION_DID = "did:ethr:0x123456789abcdef";
  const CREDENTIAL_ID = "urn:uuid:test-credential-123";
  const IPFS_HASH = "QmTest123456789";
  const CREDENTIAL_TYPE = "BachelorDegree";
  
  beforeEach(async function () {
    [owner, institution, student, verifier, admin] = await ethers.getSigners();
    institutionAddress = institution.address;
    studentAddress = student.address;

    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistry.deploy();
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const adminRole = await registry.DEFAULT_ADMIN_ROLE();
      expect(await registry.hasRole(adminRole, owner.address)).to.be.true;
    });

    it("Should initialize with zero stats", async function () {
      const [totalCredentials, totalInstitutions, totalRevoked] = await registry.getStats();
      expect(totalCredentials).to.equal(0);
      expect(totalInstitutions).to.equal(0);
      expect(totalRevoked).to.equal(0);
    });
  });

  describe("Institution Management", function () {
    it("Should allow institution registration", async function () {
      await expect(
        registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID)
      ).to.emit(registry, "InstitutionRegistered")
        .withArgs(institutionAddress, INSTITUTION_NAME, INSTITUTION_DID);

      const institutionData = await registry.getInstitution(institutionAddress);
      expect(institutionData.name).to.equal(INSTITUTION_NAME);
      expect(institutionData.did).to.equal(INSTITUTION_DID);
      expect(institutionData.verified).to.be.false;
      expect(institutionData.active).to.be.true;
    });

    it("Should prevent duplicate institution registration", async function () {
      await registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID);
      
      await expect(
        registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID)
      ).to.be.revertedWith("Institution already registered");
    });

    it("Should allow admin to verify institutions", async function () {
      await registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID);
      
      await expect(
        registry.connect(owner).verifyInstitution(institutionAddress, true)
      ).to.emit(registry, "InstitutionVerified")
        .withArgs(institutionAddress, true);

      const institutionData = await registry.getInstitution(institutionAddress);
      expect(institutionData.verified).to.be.true;

      // Check if institution now has ISSUER_ROLE
      const issuerRole = await registry.ISSUER_ROLE();
      expect(await registry.hasRole(issuerRole, institutionAddress)).to.be.true;
    });

    it("Should reject verification from non-admin", async function () {
      await registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID);
      
      await expect(
        registry.connect(student).verifyInstitution(institutionAddress, true)
      ).to.be.reverted;
    });
  });

  describe("Credential Issuance", function () {
    beforeEach(async function () {
      // Register and verify institution
      await registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID);
      await registry.connect(owner).verifyInstitution(institutionAddress, true);
    });

    it("Should allow verified institutions to issue credentials", async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(CREDENTIAL_ID));
      const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year

      await expect(
        registry.connect(institution).issueCredential(
          credentialHash,
          studentAddress,
          IPFS_HASH,
          CREDENTIAL_TYPE,
          expiresAt
        )
      ).to.emit(registry, "CredentialIssued")
        .withArgs(credentialHash, institutionAddress, studentAddress, IPFS_HASH, CREDENTIAL_TYPE, expiresAt);

      const credential = await registry.getCredential(credentialHash);
      expect(credential.issuer).to.equal(institutionAddress);
      expect(credential.subject).to.equal(studentAddress);
      expect(credential.ipfsHash).to.equal(IPFS_HASH);
      expect(credential.credentialType).to.equal(CREDENTIAL_TYPE);
      expect(credential.revoked).to.be.false;
    });

    it("Should prevent unverified institutions from issuing credentials", async function () {
      // Register but don't verify a new institution
      await registry.connect(verifier).registerInstitution("Fake University", "did:ethr:fake");
      
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(CREDENTIAL_ID));
      const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

      await expect(
        registry.connect(verifier).issueCredential(
          credentialHash,
          studentAddress,
          IPFS_HASH,
          CREDENTIAL_TYPE,
          expiresAt
        )
      ).to.be.reverted;
    });

    it("Should prevent duplicate credential IDs", async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(CREDENTIAL_ID));
      const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

      // Issue first credential
      await registry.connect(institution).issueCredential(
        credentialHash,
        studentAddress,
        IPFS_HASH,
        CREDENTIAL_TYPE,
        expiresAt
      );

      // Try to issue duplicate
      await expect(
        registry.connect(institution).issueCredential(
          credentialHash,
          studentAddress,
          IPFS_HASH,
          CREDENTIAL_TYPE,
          expiresAt
        )
      ).to.be.revertedWith("Credential already exists");
    });

    it("Should reject invalid expiration dates", async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(CREDENTIAL_ID));
      const pastDate = Math.floor(Date.now() / 1000) - 1000; // Past date

      await expect(
        registry.connect(institution).issueCredential(
          credentialHash,
          studentAddress,
          IPFS_HASH,
          CREDENTIAL_TYPE,
          pastDate
        )
      ).to.be.revertedWith("Expiration date must be in the future");
    });
  });

  describe("Credential Validation", function () {
    let credentialHash;

    beforeEach(async function () {
      // Register and verify institution, then issue a credential
      await registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID);
      await registry.connect(owner).verifyInstitution(institutionAddress, true);
      
      credentialHash = ethers.keccak256(ethers.toUtf8Bytes(CREDENTIAL_ID));
      const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

      await registry.connect(institution).issueCredential(
        credentialHash,
        studentAddress,
        IPFS_HASH,
        CREDENTIAL_TYPE,
        expiresAt
      );
    });

    it("Should validate active credentials correctly", async function () {
      const [isValid, isExpired, isRevoked] = await registry.isValid(credentialHash);
      
      expect(isValid).to.be.true;
      expect(isExpired).to.be.false;
      expect(isRevoked).to.be.false;
    });

    it("Should detect expired credentials", async function () {
      // Issue a credential that expires immediately
      const expiredCredentialId = "expired-credential";
      const expiredHash = ethers.keccak256(ethers.toUtf8Bytes(expiredCredentialId));
      const expiresAt = Math.floor(Date.now() / 1000) + 1; // Expires in 1 second

      await registry.connect(institution).issueCredential(
        expiredHash,
        studentAddress,
        IPFS_HASH,
        CREDENTIAL_TYPE,
        expiresAt
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2000));

      const [isValid, isExpired, isRevoked] = await registry.isValid(expiredHash);
      
      expect(isValid).to.be.false;
      expect(isExpired).to.be.true;
      expect(isRevoked).to.be.false;
    });

    it("Should detect revoked credentials", async function () {
      const revokeReason = "Student withdrew";
      
      await expect(
        registry.connect(institution).revokeCredential(credentialHash, revokeReason)
      ).to.emit(registry, "CredentialRevoked")
        .withArgs(credentialHash, institutionAddress, revokeReason);

      const [isValid, isExpired, isRevoked] = await registry.isValid(credentialHash);
      
      expect(isValid).to.be.false;
      expect(isExpired).to.be.false;
      expect(isRevoked).to.be.true;

      const credential = await registry.getCredential(credentialHash);
      expect(credential.revoked).to.be.true;
      expect(credential.revokedReason).to.equal(revokeReason);
    });

    it("Should only allow issuer to revoke credentials", async function () {
      await expect(
        registry.connect(student).revokeCredential(credentialHash, "Unauthorized")
      ).to.be.revertedWith("Only issuer can revoke");
    });
  });

  describe("Credential Queries", function () {
    beforeEach(async function () {
      // Setup multiple institutions and credentials
      await registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID);
      await registry.connect(owner).verifyInstitution(institutionAddress, true);
    });

    it("Should return issuer credentials", async function () {
      const credentialHash1 = ethers.keccak256(ethers.toUtf8Bytes("cred-1"));
      const credentialHash2 = ethers.keccak256(ethers.toUtf8Bytes("cred-2"));
      const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

      await registry.connect(institution).issueCredential(
        credentialHash1, studentAddress, IPFS_HASH, CREDENTIAL_TYPE, expiresAt
      );
      
      await registry.connect(institution).issueCredential(
        credentialHash2, studentAddress, "QmOther123", "Certificate", expiresAt
      );

      const issuerCredentials = await registry.getIssuerCredentials(institutionAddress);
      expect(issuerCredentials).to.have.lengthOf(2);
      expect(issuerCredentials[0]).to.equal(credentialHash1);
      expect(issuerCredentials[1]).to.equal(credentialHash2);
    });

    it("Should return subject credentials", async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(CREDENTIAL_ID));
      const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

      await registry.connect(institution).issueCredential(
        credentialHash, studentAddress, IPFS_HASH, CREDENTIAL_TYPE, expiresAt
      );

      const subjectCredentials = await registry.getSubjectCredentials(studentAddress);
      expect(subjectCredentials).to.have.lengthOf(1);
      expect(subjectCredentials[0]).to.equal(credentialHash);
    });
  });

  describe("Utility Functions", function () {
    it("Should hash credential IDs correctly", async function () {
      const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(CREDENTIAL_ID));
      const contractHash = await registry.hashCredentialId(CREDENTIAL_ID);
      
      expect(contractHash).to.equal(expectedHash);
    });

    it("Should update statistics correctly", async function () {
      await registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID);
      await registry.connect(owner).verifyInstitution(institutionAddress, true);
      
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(CREDENTIAL_ID));
      const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

      await registry.connect(institution).issueCredential(
        credentialHash, studentAddress, IPFS_HASH, CREDENTIAL_TYPE, expiresAt
      );

      await registry.connect(institution).revokeCredential(credentialHash, "Test revocation");

      const [totalCredentials, totalInstitutions, totalRevoked] = await registry.getStats();
      expect(totalCredentials).to.equal(1);
      expect(totalInstitutions).to.equal(1);
      expect(totalRevoked).to.equal(1);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to pause and unpause", async function () {
      await registry.connect(owner).pause();
      
      await registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID);
      await registry.connect(owner).verifyInstitution(institutionAddress, true);
      
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(CREDENTIAL_ID));
      const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

      await expect(
        registry.connect(institution).issueCredential(
          credentialHash, studentAddress, IPFS_HASH, CREDENTIAL_TYPE, expiresAt
        )
      ).to.be.revertedWith("Pausable: paused");

      await registry.connect(owner).unpause();

      await expect(
        registry.connect(institution).issueCredential(
          credentialHash, studentAddress, IPFS_HASH, CREDENTIAL_TYPE, expiresAt
        )
      ).to.not.be.reverted;
    });

    it("Should allow admin to deactivate institutions", async function () {
      await registry.connect(institution).registerInstitution(INSTITUTION_NAME, INSTITUTION_DID);
      await registry.connect(owner).verifyInstitution(institutionAddress, true);
      
      await registry.connect(owner).deactivateInstitution(institutionAddress);
      
      const institutionData = await registry.getInstitution(institutionAddress);
      expect(institutionData.active).to.be.false;
      
      // Should lose issuer role
      const issuerRole = await registry.ISSUER_ROLE();
      expect(await registry.hasRole(issuerRole, institutionAddress)).to.be.false;
    });
  });
});