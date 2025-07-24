// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title CredVerseRegistry
 * @dev Smart contract for managing verifiable credentials registry
 * Stores credential metadata and provides verification functionality
 */
contract CredVerseRegistry is 
    Initializable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    UUPSUpgradeable 
{
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    struct Credential {
        string credentialId;      // Unique credential identifier
        address issuer;           // Issuer's wallet address
        address recipient;        // Recipient's wallet address
        string ipfsHash;          // IPFS hash of credential metadata
        string credentialType;    // Type of credential (degree, certificate, etc.)
        uint256 issuedAt;        // Timestamp when issued
        uint256 expiresAt;       // Expiration timestamp (0 for no expiry)
        bool isRevoked;          // Revocation status
        string revokedReason;    // Reason for revocation
    }

    struct Institution {
        string name;
        string did;              // Decentralized Identifier
        bool isVerified;         // Verification status by admin
        bool isActive;           // Active status
        uint256 registeredAt;    // Registration timestamp
    }

    // Mappings
    mapping(string => Credential) public credentials;
    mapping(address => Institution) public institutions;
    mapping(address => string[]) public issuerCredentials;
    mapping(address => string[]) public recipientCredentials;
    mapping(string => bool) public credentialExists;

    // Events
    event CredentialIssued(
        string indexed credentialId,
        address indexed issuer,
        address indexed recipient,
        string ipfsHash,
        string credentialType
    );

    event CredentialRevoked(
        string indexed credentialId,
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    /**
     * @dev Register a new institution
     */
    function registerInstitution(
        string memory _name,
        string memory _did
    ) external {
        require(bytes(_name).length > 0, "Institution name required");
        require(bytes(_did).length > 0, "DID required");
        require(bytes(institutions[msg.sender].name).length == 0, "Institution already registered");

        institutions[msg.sender] = Institution({
            name: _name,
            did: _did,
            isVerified: false,
            isActive: true,
            registeredAt: block.timestamp
        });

        emit InstitutionRegistered(msg.sender, _name, _did);
    }

    /**
     * @dev Verify an institution (admin only)
     */
    function verifyInstitution(address _institution, bool _verified) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(bytes(institutions[_institution].name).length > 0, "Institution not registered");
        
        institutions[_institution].isVerified = _verified;
        if (_verified) {
            _grantRole(ISSUER_ROLE, _institution);
        } else {
            _revokeRole(ISSUER_ROLE, _institution);
        }

        emit InstitutionVerified(_institution, _verified);
    }

    /**
     * @dev Issue a new credential
     */
    function issueCredential(
        string memory _credentialId,
        address _recipient,
        string memory _ipfsHash,
        string memory _credentialType,
        uint256 _expiresAt
    ) 
        external 
        onlyRole(ISSUER_ROLE)
        whenNotPaused
    {
        require(bytes(_credentialId).length > 0, "Credential ID required");
        require(_recipient != address(0), "Invalid recipient address");
        require(bytes(_ipfsHash).length > 0, "IPFS hash required");
        require(!credentialExists[_credentialId], "Credential already exists");
        require(institutions[msg.sender].isVerified, "Institution not verified");
        require(institutions[msg.sender].isActive, "Institution not active");

        credentials[_credentialId] = Credential({
            credentialId: _credentialId,
            issuer: msg.sender,
            recipient: _recipient,
            ipfsHash: _ipfsHash,
            credentialType: _credentialType,
            issuedAt: block.timestamp,
            expiresAt: _expiresAt,
            isRevoked: false,
            revokedReason: ""
        });

        credentialExists[_credentialId] = true;
        issuerCredentials[msg.sender].push(_credentialId);
        recipientCredentials[_recipient].push(_credentialId);

        emit CredentialIssued(
            _credentialId,
            msg.sender,
            _recipient,
            _ipfsHash,
            _credentialType
        );
    }

    /**
     * @dev Revoke a credential
     */
    function revokeCredential(
        string memory _credentialId,
        string memory _reason
    ) 
        external 
        whenNotPaused
    {
        require(credentialExists[_credentialId], "Credential does not exist");
        
        Credential storage credential = credentials[_credentialId];
        require(credential.issuer == msg.sender, "Only issuer can revoke");
        require(!credential.isRevoked, "Credential already revoked");

        credential.isRevoked = true;
        credential.revokedReason = _reason;

        emit CredentialRevoked(_credentialId, msg.sender, _reason);
    }

    /**
     * @dev Verify a credential
     */
    function verifyCredential(string memory _credentialId) 
        external 
        view 
        returns (
            bool isValid,
            bool isExpired,
            bool isRevoked,
            address issuer,
            address recipient,
            string memory credentialType
        ) 
    {
        require(credentialExists[_credentialId], "Credential does not exist");
        
        Credential memory credential = credentials[_credentialId];
        
        isValid = institutions[credential.issuer].isVerified && 
                 institutions[credential.issuer].isActive;
        isExpired = credential.expiresAt > 0 && block.timestamp > credential.expiresAt;
        isRevoked = credential.isRevoked;
        issuer = credential.issuer;
        recipient = credential.recipient;
        credentialType = credential.credentialType;
    }

    /**
     * @dev Get credential details
     */
    function getCredential(string memory _credentialId) 
        external 
        view 
        returns (Credential memory) 
    {
        require(credentialExists[_credentialId], "Credential does not exist");
        return credentials[_credentialId];
    }

    /**
     * @dev Get credentials issued by an institution
     */
    function getIssuerCredentials(address _issuer) 
        external 
        view 
        returns (string[] memory) 
    {
        return issuerCredentials[_issuer];
    }

    /**
     * @dev Get credentials received by a recipient
     */
    function getRecipientCredentials(address _recipient) 
        external 
        view 
        returns (string[] memory) 
    {
        return recipientCredentials[_recipient];
    }

    /**
     * @dev Get institution details
     */
    function getInstitution(address _institution) 
        external 
        view 
        returns (Institution memory) 
    {
        return institutions[_institution];
    }

    /**
     * @dev Pause contract (admin only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause contract (admin only)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Authorize upgrade (upgrader role only)
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}

    /**
     * @dev Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}