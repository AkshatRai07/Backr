// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IENSResolver
 * @notice Interface for ENS Public Resolver text records
 */
interface IENSResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

/**
 * @title IENSRegistry
 * @notice Interface for ENS Registry
 */
interface IENSRegistry {
    function resolver(bytes32 node) external view returns (address);
    function owner(bytes32 node) external view returns (address);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

/**
 * @title BackrENSReputation
 * @notice Lighter-weight reputation system using ENS text records
 * @dev Instead of burning ENS, this sets a visible "backr.status" text record
 * 
 * This is the "Soft Nuke" - doesn't take away ENS but marks it publicly
 * 
 * Flow:
 * 1. Bob grants this contract permission to modify his ENS records
 *    (calls ENSRegistry.setApprovalForAll(backrContract, true))
 * 2. Contract can now set text records on Bob's ENS
 * 3. If Bob defaults, contract sets: backr.status = "DEFAULTED"
 * 4. Anyone checking bob.eth will see the default status
 * 5. If Bob repays, status is cleared
 */
contract BackrENSReputation {
    // ============================================
    // CONSTANTS
    // ============================================
    
    /// @notice ENS Registry on Sepolia
    /// @dev Mainnet: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
    /// @dev Sepolia: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e (same)
    IENSRegistry public constant ENS_REGISTRY = IENSRegistry(0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e);
    
    /// @notice The text record key we use
    string public constant BACKR_STATUS_KEY = "backr.status";
    string public constant BACKR_SCORE_KEY = "backr.score";
    
    // Status values
    string public constant STATUS_GOOD = "GOOD_STANDING";
    string public constant STATUS_DEFAULTED = "DEFAULTED";
    string public constant STATUS_CLEARED = "CLEARED";
    
    // ============================================
    // STATE
    // ============================================
    
    address public backrOracle;
    address public owner;
    
    struct UserReputation {
        bytes32 ensNode;         // The namehash of the ENS name
        bool isRegistered;       // Whether user has registered with Backr
        bool hasDefaulted;       // Current default status
        uint256 defaultCount;    // Total number of defaults (lifetime)
        uint256 creditScore;     // On-chain credit score (300-900)
    }
    
    mapping(address => UserReputation) public userReputation;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event UserRegistered(address indexed user, bytes32 indexed ensNode);
    event ReputationUpdated(address indexed user, string status, uint256 creditScore);
    event DefaultRecorded(address indexed user, uint256 totalDefaults);
    event DefaultCleared(address indexed user);
    
    // ============================================
    // ERRORS
    // ============================================
    
    error NotOwner();
    error NotOracle();
    error NotRegistered();
    error AlreadyRegistered();
    error NotApproved();
    error InvalidNode();
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    modifier onlyOracle() {
        if (msg.sender != backrOracle) revert NotOracle();
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(address _oracle) {
        owner = msg.sender;
        backrOracle = _oracle;
    }
    
    // ============================================
    // USER FUNCTIONS
    // ============================================
    
    /**
     * @notice Register your ENS with Backr reputation system
     * @param ensNode The namehash of your ENS name
     * @dev User must first call ENSRegistry.setApprovalForAll(address(this), true)
     * 
     * To calculate ensNode for "bob.eth":
     * namehash("bob.eth") = keccak256(namehash("eth") + keccak256("bob"))
     * 
     * Or use ethers.js: ethers.namehash("bob.eth")
     */
    function registerENS(bytes32 ensNode) external {
        if (userReputation[msg.sender].isRegistered) revert AlreadyRegistered();
        if (ensNode == bytes32(0)) revert InvalidNode();
        
        // Verify the caller owns this ENS name
        address ensOwner = ENS_REGISTRY.owner(ensNode);
        require(ensOwner == msg.sender, "Not ENS owner");
        
        // Verify we have approval to modify records
        require(
            ENS_REGISTRY.isApprovedForAll(msg.sender, address(this)),
            "Must approve Backr first"
        );
        
        // Register user
        userReputation[msg.sender] = UserReputation({
            ensNode: ensNode,
            isRegistered: true,
            hasDefaulted: false,
            defaultCount: 0,
            creditScore: 650 // Default starting score
        });
        
        // Set initial good standing
        _setENSStatus(ensNode, STATUS_GOOD, 650);
        
        emit UserRegistered(msg.sender, ensNode);
    }
    
    // ============================================
    // ORACLE FUNCTIONS
    // ============================================
    
    /**
     * @notice Update a user's credit score
     * @param user The user's address
     * @param newScore The new credit score (300-900)
     */
    function updateCreditScore(address user, uint256 newScore) external onlyOracle {
        UserReputation storage rep = userReputation[user];
        if (!rep.isRegistered) revert NotRegistered();
        
        // Clamp score to valid range
        if (newScore < 300) newScore = 300;
        if (newScore > 900) newScore = 900;
        
        rep.creditScore = newScore;
        
        // Update ENS record
        string memory status = rep.hasDefaulted ? STATUS_DEFAULTED : STATUS_GOOD;
        _setENSStatus(rep.ensNode, status, newScore);
        
        emit ReputationUpdated(user, status, newScore);
    }
    
    /**
     * @notice Mark a user as defaulted - THE SOCIAL NUKE
     * @param user The user who defaulted
     */
    function markDefault(address user) external onlyOracle {
        UserReputation storage rep = userReputation[user];
        if (!rep.isRegistered) revert NotRegistered();
        
        rep.hasDefaulted = true;
        rep.defaultCount++;
        
        // Reduce credit score significantly
        if (rep.creditScore > 350) {
            rep.creditScore -= 50;
        } else {
            rep.creditScore = 300;
        }
        
        // Update ENS with DEFAULTED status - visible to everyone!
        _setENSStatus(rep.ensNode, STATUS_DEFAULTED, rep.creditScore);
        
        emit DefaultRecorded(user, rep.defaultCount);
        emit ReputationUpdated(user, STATUS_DEFAULTED, rep.creditScore);
    }
    
    /**
     * @notice Clear default status after repayment
     * @param user The user who repaid
     */
    function clearDefault(address user) external onlyOracle {
        UserReputation storage rep = userReputation[user];
        if (!rep.isRegistered) revert NotRegistered();
        
        rep.hasDefaulted = false;
        
        // Small credit boost for repaying
        if (rep.creditScore < 890) {
            rep.creditScore += 10;
        }
        
        // Update ENS - show they've cleared their debt
        // Note: defaultCount remains as permanent record
        _setENSStatus(rep.ensNode, STATUS_CLEARED, rep.creditScore);
        
        emit DefaultCleared(user);
        emit ReputationUpdated(user, STATUS_CLEARED, rep.creditScore);
    }
    
    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @notice Set ENS text records for reputation
     */
    function _setENSStatus(bytes32 node, string memory status, uint256 score) internal {
        address resolver = ENS_REGISTRY.resolver(node);
        if (resolver == address(0)) return;
        
        IENSResolver ensResolver = IENSResolver(resolver);
        
        // Set status record
        try ensResolver.setText(node, BACKR_STATUS_KEY, status) {} catch {}
        
        // Set score record
        try ensResolver.setText(node, BACKR_SCORE_KEY, _uintToString(score)) {} catch {}
    }
    
    /**
     * @notice Convert uint to string
     */
    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    function isRegistered(address user) external view returns (bool) {
        return userReputation[user].isRegistered;
    }
    
    function getCreditScore(address user) external view returns (uint256) {
        return userReputation[user].creditScore;
    }
    
    function getDefaultCount(address user) external view returns (uint256) {
        return userReputation[user].defaultCount;
    }
    
    function isCurrentlyDefaulted(address user) external view returns (bool) {
        return userReputation[user].hasDefaulted;
    }
    
    // ============================================
    // ADMIN
    // ============================================
    
    function setOracle(address _oracle) external onlyOwner {
        backrOracle = _oracle;
    }
    
    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }
}
