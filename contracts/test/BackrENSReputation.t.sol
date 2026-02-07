// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BackrENSReputation} from "../src/BackrENSReputation.sol";

/**
 * @title BackrENSReputationTest
 * @notice Tests for the ENS reputation (text records) contract
 */
contract BackrENSReputationTest is Test {
    BackrENSReputation public reputation;
    
    address public owner = address(this);
    address public oracle = address(0x1);
    address public bob = address(0x2);
    
    // Mock namehash for "bob.eth"
    bytes32 public bobNode = keccak256(abi.encodePacked(
        keccak256(abi.encodePacked(bytes32(0), keccak256("eth"))),
        keccak256("bob")
    ));
    
    function setUp() public {
        reputation = new BackrENSReputation(oracle);
    }
    
    function test_Constructor() public view {
        assertEq(reputation.owner(), owner);
        assertEq(reputation.backrOracle(), oracle);
    }
    
    function test_Constants() public view {
        assertEq(reputation.BACKR_STATUS_KEY(), "backr.status");
        assertEq(reputation.BACKR_SCORE_KEY(), "backr.score");
        assertEq(reputation.STATUS_GOOD(), "GOOD_STANDING");
        assertEq(reputation.STATUS_DEFAULTED(), "DEFAULTED");
        assertEq(reputation.STATUS_CLEARED(), "CLEARED");
    }
    
    function test_NotRegistered_Reverts() public {
        vm.prank(oracle);
        vm.expectRevert(BackrENSReputation.NotRegistered.selector);
        reputation.markDefault(bob);
    }
    
    function test_UpdateCreditScore_NotOracle_Reverts() public {
        vm.prank(bob);
        vm.expectRevert(BackrENSReputation.NotOracle.selector);
        reputation.updateCreditScore(bob, 700);
    }
    
    function test_ViewFunctions_NotRegistered() public view {
        assertFalse(reputation.isRegistered(bob));
        assertEq(reputation.getCreditScore(bob), 0);
        assertEq(reputation.getDefaultCount(bob), 0);
        assertFalse(reputation.isCurrentlyDefaulted(bob));
    }
    
    function test_SetOracle() public {
        address newOracle = address(0x999);
        reputation.setOracle(newOracle);
        assertEq(reputation.backrOracle(), newOracle);
    }
}
