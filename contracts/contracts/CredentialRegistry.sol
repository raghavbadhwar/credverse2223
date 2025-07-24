// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CredentialRegistry
 * @dev Smart contract for registering and managing W3C Verifiable Credentials
 * Stores credential metadata on-chain with IPFS references
 */
contract CredentialRegistry is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Credential {
        address issuer;          // Institution's wallet address
        address subject;         // Student's wallet address (optional)
        string ipfsHash;         // IPFS CID containing full VC
        uint256 issuedAt;       // Block timestamp when issued
        uint256 expiresAt;      // Expiration timestamp (0 for no expiry)
        bool revoked;           // Revocation status
        string revokedReason;   // Reason for revocation
        string credentialType;  // Type of credential (degree, certificate, etc.)
    }

    struct Institution {
        string name;
        string did;             // Institution's DID
        bool verified;          // Verified by platform admin
        bool active;            // Active status
        uint256 registeredAt;   // Registration timestamp
    }

    // Mappings
    mapping(bytes32 => Credential) public credentials;  // VC ID hash → Credential
    mapping(address => Institution) public institutions; // Institution address → Institution info
    mapping(address => bytes32[]) public issuerCredentials; // Issuer → array of credential IDs
    mapping(address => bytes32[]) public subjectCredentials; // Subject → array of credential IDs
    mapping(bytes32 => bool) public credentialExists; // Quick existence check

    // Statistics
    uint256 public totalCredentials;
    uint256 public totalInstitutions;
    uint256 public totalRevoked;

    // Events
    event CredentialIssued(
        bytes32 indexed credentialId,
        address indexed issuer,
        address indexed subject,
        string ipfsHash,
        string credentialType,
        uint256 expiresAt
    );

    event CredentialRevoked(
        bytes32 indexed credentialId,
        address indexed issuer,
        string reason
    );

    event InstitutionRegistered(
        address indexed institutionAddress,
        string name,
        string did
    );

    event InstitutionVerified(
        address indexed institutionAddress,
        bool verified
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Register a new institution
     * @param _name Institution name
     * @param _did Institution's DID
     */
    function registerInstitution(
        string calldata _name,
        string calldata _did
    ) external {
        require(bytes(_name).length > 0, "Institution name required");
        require(bytes(_did).length > 0, "DID required");
        require(bytes(institutions[msg.sender].name).length == 0, "Institution already registered");

        institutions[msg.sender] = Institution({
            name: _name,
            did: _did,
            verified: false,
            active: true,
            registeredAt: block.timestamp
        });

        totalInstitutions++;
        emit InstitutionRegistered(msg.sender, _name, _did);
    }

    /**
     * @dev Verify an institution (admin only)
     * @param _institution Institution address to verify
     * @param _verified Verification status
     */
    function verifyInstitution(address _institution, bool _verified) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(bytes(institutions[_institution].name).length > 0, "Institution not registered");
        
        institutions[_institution].verified = _verified;
        
        if (_verified) {
            _grantRole(ISSUER_ROLE, _institution);
        } else {
            _revokeRole(ISSUER_ROLE, _institution);
        }

        emit InstitutionVerified(_institution, _verified);
    }

    /**
     * @dev Issue a new verifiable credential
     * @param _vcId Unique credential ID (hashed)
     * @param _subject Student's wallet address (can be zero address)
     * @param _ipfsHash IPFS CID containing the full VC JSON
     * @param _credentialType Type of credential
     * @param _expiresAt Expiration timestamp (0 for no expiry)
     */
    function issueCredential(
        bytes32 _vcId,
        address _subject,
        string calldata _ipfsHash,
        string calldata _credentialType,
        uint256 _expiresAt
    ) external onlyRole(ISSUER_ROLE) whenNotPaused nonReentrant {
        require(_vcId != bytes32(0), "Invalid credential ID");
        require(bytes(_ipfsHash).length > 0, "IPFS hash required");
        require(bytes(_credentialType).length > 0, "Credential type required");
        require(!credentialExists[_vcId], "Credential already exists");
        require(institutions[msg.sender].verified, "Institution not verified");
        require(institutions[msg.sender].active, "Institution not active");

        // Validate expiration date
        if (_expiresAt > 0) {
            require(_expiresAt > block.timestamp, "Expiration date must be in the future");
        }

        credentials[_vcId] = Credential({
            issuer: msg.sender,
            subject: _subject,
            ipfsHash: _ipfsHash,
            issuedAt: block.timestamp,
            expiresAt: _expiresAt,
            revoked: false,
            revokedReason: "",
            credentialType: _credentialType
        });

        credentialExists[_vcId] = true;
        issuerCredentials[msg.sender].push(_vcId);
        
        if (_subject != address(0)) {
            subjectCredentials[_subject].push(_vcId);
        }

        totalCredentials++;

        emit CredentialIssued(
            _vcId,
            msg.sender,
            _subject,
            _ipfsHash,
            _credentialType,
            _expiresAt
        );
    }

    /**
     * @dev Revoke a credential
     * @param _vcId Credential ID to revoke
     * @param _reason Reason for revocation
     */
    function revokeCredential(bytes32 _vcId, string calldata _reason) 
        external 
        whenNotPaused 
    {
        require(credentialExists[_vcId], "Credential does not exist");
        require(bytes(_reason).length > 0, "Revocation reason required");
        
        Credential storage cred = credentials[_vcId];
        require(cred.issuer == msg.sender, "Only issuer can revoke");
        require(!cred.revoked, "Credential already revoked");

        cred.revoked = true;
        cred.revokedReason = _reason;
        totalRevoked++;

        emit CredentialRevoked(_vcId, msg.sender, _reason);
    }

    /**
     * @dev Check if a credential is valid
     * @param _vcId Credential ID to check
     * @return isValid True if credential is valid (not revoked and not expired)
     * @return isExpired True if credential is expired
     * @return isRevoked True if credential is revoked
     */
    function isValid(bytes32 _vcId) 
        public 
        view 
        returns (bool isValid, bool isExpired, bool isRevoked) 
    {
        require(credentialExists[_vcId], "Credential does not exist");
        
        Credential memory cred = credentials[_vcId];
        Institution memory inst = institutions[cred.issuer];
        
        isRevoked = cred.revoked;
        isExpired = cred.expiresAt > 0 && block.timestamp >= cred.expiresAt;
        isValid = !isRevoked && !isExpired && inst.verified && inst.active;
    }

    /**
     * @dev Get credential details
     * @param _vcId Credential ID
     * @return credential The credential struct
     */
    function getCredential(bytes32 _vcId) 
        external 
        view 
        returns (Credential memory credential) 
    {
        require(credentialExists[_vcId], "Credential does not exist");
        return credentials[_vcId];
    }

    /**
     * @dev Get all credentials issued by an institution
     * @param _issuer Issuer address
     * @return credentialIds Array of credential IDs
     */
    function getIssuerCredentials(address _issuer) 
        external 
        view 
        returns (bytes32[] memory credentialIds) 
    {
        return issuerCredentials[_issuer];
    }

    /**
     * @dev Get all credentials for a subject
     * @param _subject Subject address
     * @return credentialIds Array of credential IDs
     */
    function getSubjectCredentials(address _subject) 
        external 
        view 
        returns (bytes32[] memory credentialIds) 
    {
        return subjectCredentials[_subject];
    }

    /**
     * @dev Get institution details
     * @param _institution Institution address
     * @return institution The institution struct
     */
    function getInstitution(address _institution) 
        external 
        view 
        returns (Institution memory institution) 
    {
        return institutions[_institution];
    }

    /**
     * @dev Get platform statistics
     * @return _totalCredentials Total credentials issued
     * @return _totalInstitutions Total institutions registered
     * @return _totalRevoked Total credentials revoked
     */
    function getStats() 
        external 
        view 
        returns (uint256 _totalCredentials, uint256 _totalInstitutions, uint256 _totalRevoked) 
    {
        return (totalCredentials, totalInstitutions, totalRevoked);
    }

    /**
     * @dev Pause the contract (admin only)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the contract (admin only)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Emergency function to deactivate an institution
     * @param _institution Institution to deactivate
     */
    function deactivateInstitution(address _institution) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(bytes(institutions[_institution].name).length > 0, "Institution not registered");
        institutions[_institution].active = false;
        _revokeRole(ISSUER_ROLE, _institution);
    }

    /**
     * @dev Utility function to hash a credential ID string
     * @param _credentialId String credential ID
     * @return Hash of the credential ID
     */
    function hashCredentialId(string calldata _credentialId) 
        external 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encodePacked(_credentialId));
    }
}