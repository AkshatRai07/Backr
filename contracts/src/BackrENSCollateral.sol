// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "forge-std/interfaces/IERC721.sol";

/**
 * @title BackrENSCollateral
 * @notice Stake your ENS as collateral for credit. Default = lose your ENS.
 * @dev Works with ENS on Sepolia (0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85)
 * 
 * Flow:
 * 1. Bob approves this contract for his ENS NFT
 * 2. Bob calls stakeENS(tokenId) - ENS is transferred to this contract
 * 3. Alice vouches for Bob through the Backr system
 * 4. Bob borrows and must repay within deadline
 * 5. If Bob repays: he can call unstakeENS() to get his ENS back
 * 6. If Bob defaults: anyone can call slashENS() to burn his ENS reputation
 */
contract BackrENSCollateral {
    // ============================================
    // CONSTANTS
    // ============================================
    
    /// @notice ENS BaseRegistrar
    /// @dev Mainnet: 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85
    /// @dev Sepolia: 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85 (ENS deployed same address)
    /// @dev For hackathon demo, users need actual Sepolia ENS names from app.ens.domains
    IERC721 public immutable ENS_REGISTRAR;
    
    /// @notice Burn address for slashed ENS
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    // ============================================
    // STATE
    // ============================================
    
    /// @notice Backend/Oracle address that can mark defaults
    address public backrOracle;
    
    /// @notice Owner who can update oracle
    address public owner;
    
    struct StakedENS {
        address owner;           // Original owner of the ENS
        uint256 tokenId;         // ENS token ID (labelhash of the name)
        uint256 stakedAt;        // Timestamp when staked
        bool isDefaulted;        // Whether the user has defaulted
        uint256 defaultedAt;     // When default was marked
    }
    
    /// @notice Mapping from user address to their staked ENS
    mapping(address => StakedENS) public stakedENS;
    
    /// @notice Mapping from tokenId to staker address (for reverse lookup)
    mapping(uint256 => address) public tokenToStaker;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event ENSStaked(address indexed user, uint256 indexed tokenId, uint256 timestamp);
    event ENSUnstaked(address indexed user, uint256 indexed tokenId, uint256 timestamp);
    event ENSSlashed(address indexed user, uint256 indexed tokenId, address slashedBy, uint256 timestamp);
    event DefaultMarked(address indexed user, uint256 timestamp);
    event DefaultCleared(address indexed user, uint256 timestamp);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    
    // ============================================
    // ERRORS
    // ============================================
    
    error NotOwner();
    error NotOracle();
    error AlreadyStaked();
    error NotStaked();
    error NotDefaulted();
    error StillDefaulted();
    error GracePeriodNotOver();
    error InvalidTokenId();
    
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
    
    constructor(address _oracle, address _ensRegistrar) {
        owner = msg.sender;
        backrOracle = _oracle;
        // Sepolia ENS: 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85
        // Mainnet ENS: 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85
        ENS_REGISTRAR = IERC721(_ensRegistrar);
    }
    
    // ============================================
    // USER FUNCTIONS
    // ============================================
    
    /**
     * @notice Stake your ENS as collateral
     * @param tokenId The ENS token ID (labelhash of your .eth name)
     * @dev User must approve this contract first: ENS_REGISTRAR.approve(address(this), tokenId)
     */
    function stakeENS(uint256 tokenId) external {
        if (stakedENS[msg.sender].tokenId != 0) revert AlreadyStaked();
        if (tokenId == 0) revert InvalidTokenId();
        
        // Transfer ENS from user to this contract
        ENS_REGISTRAR.transferFrom(msg.sender, address(this), tokenId);
        
        // Record the stake
        stakedENS[msg.sender] = StakedENS({
            owner: msg.sender,
            tokenId: tokenId,
            stakedAt: block.timestamp,
            isDefaulted: false,
            defaultedAt: 0
        });
        
        tokenToStaker[tokenId] = msg.sender;
        
        emit ENSStaked(msg.sender, tokenId, block.timestamp);
    }
    
    /**
     * @notice Unstake your ENS and get it back
     * @dev Only works if you haven't defaulted
     */
    function unstakeENS() external {
        StakedENS storage stake = stakedENS[msg.sender];
        if (stake.tokenId == 0) revert NotStaked();
        if (stake.isDefaulted) revert StillDefaulted();
        
        uint256 tokenId = stake.tokenId;
        
        // Clear the stake
        delete tokenToStaker[tokenId];
        delete stakedENS[msg.sender];
        
        // Return ENS to owner
        ENS_REGISTRAR.transferFrom(address(this), msg.sender, tokenId);
        
        emit ENSUnstaked(msg.sender, tokenId, block.timestamp);
    }
    
    // ============================================
    // ORACLE FUNCTIONS (Called by Backr Backend)
    // ============================================
    
    /**
     * @notice Mark a user as defaulted on their debt
     * @param user The address that defaulted
     * @dev Called by Backr backend when debt is overdue
     */
    function markDefault(address user) external onlyOracle {
        StakedENS storage stake = stakedENS[user];
        if (stake.tokenId == 0) revert NotStaked();
        
        stake.isDefaulted = true;
        stake.defaultedAt = block.timestamp;
        
        emit DefaultMarked(user, block.timestamp);
    }
    
    /**
     * @notice Clear a user's default status (they repaid)
     * @param user The address that repaid
     */
    function clearDefault(address user) external onlyOracle {
        StakedENS storage stake = stakedENS[user];
        if (stake.tokenId == 0) revert NotStaked();
        
        stake.isDefaulted = false;
        stake.defaultedAt = 0;
        
        emit DefaultCleared(user, block.timestamp);
    }
    
    // ============================================
    // SLASH FUNCTION (Anyone can call after grace period)
    // ============================================
    
    /// @notice Grace period after default before ENS can be slashed (7 days)
    uint256 public constant GRACE_PERIOD = 7 days;
    
    /**
     * @notice Slash a defaulter's ENS - sends it to burn address
     * @param user The defaulted user's address
     * @dev Anyone can call this after the grace period
     * @dev This is the "Social Nuke" - permanent reputation damage
     */
    function slashENS(address user) external {
        StakedENS storage stake = stakedENS[user];
        if (stake.tokenId == 0) revert NotStaked();
        if (!stake.isDefaulted) revert NotDefaulted();
        if (block.timestamp < stake.defaultedAt + GRACE_PERIOD) revert GracePeriodNotOver();
        
        uint256 tokenId = stake.tokenId;
        
        // Clear the stake
        delete tokenToStaker[tokenId];
        delete stakedENS[user];
        
        // BURN THE ENS - Send to dead address
        ENS_REGISTRAR.transferFrom(address(this), BURN_ADDRESS, tokenId);
        
        emit ENSSlashed(user, tokenId, msg.sender, block.timestamp);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Check if a user has staked ENS
     */
    function hasStakedENS(address user) external view returns (bool) {
        return stakedENS[user].tokenId != 0;
    }
    
    /**
     * @notice Check if a user is in default
     */
    function isInDefault(address user) external view returns (bool) {
        return stakedENS[user].isDefaulted;
    }
    
    /**
     * @notice Check if a user's ENS can be slashed
     */
    function canBeSlashed(address user) external view returns (bool) {
        StakedENS storage stake = stakedENS[user];
        return stake.isDefaulted && block.timestamp >= stake.defaultedAt + GRACE_PERIOD;
    }
    
    /**
     * @notice Get time remaining before ENS can be slashed
     */
    function timeUntilSlashable(address user) external view returns (uint256) {
        StakedENS storage stake = stakedENS[user];
        if (!stake.isDefaulted) return type(uint256).max;
        
        uint256 slashableAt = stake.defaultedAt + GRACE_PERIOD;
        if (block.timestamp >= slashableAt) return 0;
        
        return slashableAt - block.timestamp;
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function setOracle(address _newOracle) external onlyOwner {
        emit OracleUpdated(backrOracle, _newOracle);
        backrOracle = _newOracle;
    }
    
    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }
    
    // ============================================
    // ERC721 RECEIVER (Required to receive ENS NFTs)
    // ============================================
    
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
