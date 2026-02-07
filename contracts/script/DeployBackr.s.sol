// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BackrENSCollateral} from "../src/BackrENSCollateral.sol";
import {BackrENSReputation} from "../src/BackrENSReputation.sol";

/**
 * @title DeployBackr
 * @notice Deploy Backr contracts to Sepolia
 * 
 * Usage:
 * forge script script/DeployBackr.s.sol:DeployBackr --rpc-url $SEPOLIA_RPC --broadcast --verify
 */
contract DeployBackr is Script {
    function run() external {
        // The oracle address (your backend's wallet that will call markDefault, etc.)
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the "Hard" collateral contract (locks ENS)
        BackrENSCollateral collateral = new BackrENSCollateral(oracle);
        console.log("BackrENSCollateral deployed at:", address(collateral));
        
        // Deploy the "Soft" reputation contract (text records)
        BackrENSReputation reputation = new BackrENSReputation(oracle);
        console.log("BackrENSReputation deployed at:", address(reputation));
        
        vm.stopBroadcast();
        
        // Log summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Oracle Address:", oracle);
        console.log("Collateral Contract:", address(collateral));
        console.log("Reputation Contract:", address(reputation));
        console.log("\nNext steps:");
        console.log("1. Update backend .env with contract addresses");
        console.log("2. Fund oracle address with ETH for gas");
        console.log("3. Users can now stake ENS or register for reputation tracking");
    }
}
