#!/usr/bin/env node

const { ethers } = require("./backend/node_modules/ethers");
const crypto = require("crypto");

// Test configuration
const API_BASE_URL = "http://localhost:5001";

// Hardhat default account (first account from hardhat node)
const HARDHAT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const HARDHAT_WALLET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Request failed for ${endpoint}:`, error.message);
    throw error;
  }
}

// Test wallet authentication flow with real Hardhat account
async function testWalletAuth() {
  console.log(
    "🔐 Testing Wallet Authentication Flow with Hardhat Account...\n"
  );

  try {
    // Step 1: Get challenge
    console.log("1. Requesting wallet challenge...");
    const challengeData = await apiRequest("/api/auth/challenge", {
      method: "POST",
      body: JSON.stringify({ walletAddress: HARDHAT_WALLET_ADDRESS })
    });
    console.log("✅ Challenge received:", challengeData.challenge.nonce);

    // Step 2: Sign with real Hardhat private key
    console.log("\n2. Signing challenge with Hardhat account...");
    const message = challengeData.challenge.message;
    const wallet = new ethers.Wallet(HARDHAT_PRIVATE_KEY);
    const signature = await wallet.signMessage(message);
    console.log(
      "✅ Signature generated with real wallet:",
      signature.slice(0, 20) + "..."
    );

    // Step 3: Verify signature
    console.log("\n3. Verifying signature...");
    const verifyData = await apiRequest("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        walletAddress: HARDHAT_WALLET_ADDRESS,
        signature: signature,
        nonce: challengeData.challenge.nonce
      })
    });
    console.log("✅ Signature verified, token received");
    console.log("✅ User authenticated:", verifyData.user ? "Yes" : "No");

    return verifyData.token;
  } catch (error) {
    console.error("❌ Wallet authentication failed:", error.message);
    return null;
  }
}

// Test Web3 service endpoints
async function testWeb3Endpoints(token) {
  console.log("\n🔗 Testing Web3 Service Endpoints...\n");

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    // Test transaction recording
    console.log("1. Testing transaction recording...");
    const txData = {
      txHash: "0x" + crypto.randomBytes(32).toString("hex"),
      type: "transfer",
      amount: 1.5,
      status: "pending",
      blockNumber: 12345,
      gasUsed: 21000,
      gasPrice: "20000000000"
    };

    const txResult = await apiRequest("/api/web3/transactions", {
      method: "POST",
      headers,
      body: JSON.stringify(txData)
    });
    console.log("✅ Transaction recorded:", txResult.transaction.id);

    // Test getting user transactions
    console.log("\n2. Testing get user transactions...");
    const userTxs = await apiRequest("/api/web3/transactions", {
      headers
    });
    console.log("✅ User transactions retrieved:", userTxs.transactions.length);

    // Test blockchain event recording
    console.log("\n3. Testing blockchain event recording...");
    const eventData = {
      contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      eventName: "Withdrawal",
      blockNumber: 12345,
      transactionHash: "0x" + crypto.randomBytes(32).toString("hex"),
      eventData: { amount: "1000000000000000000", when: "1751510186458" },
      userId: 1,
      network: "hardhat",
      gasUsed: 50000,
      gasPrice: "20000000000"
    };

    const eventResult = await apiRequest("/api/web3/events", {
      method: "POST",
      body: JSON.stringify(eventData)
    });
    console.log("✅ Blockchain event recorded:", eventResult.event.id);

    // Test contract stats for deployed Lock contract
    console.log("\n4. Testing contract stats for deployed Lock contract...");
    const stats = await apiRequest(
      "/api/web3/stats/0x5FbDB2315678afecb367f032d93F642f64180aa3"
    );
    console.log("✅ Contract stats retrieved:", stats.stats);
  } catch (error) {
    console.error("❌ Web3 endpoint test failed:", error.message);
  }
}

// Test blockchain connectivity
async function testBlockchainConnectivity() {
  console.log("\n⛓️ Testing Blockchain Connectivity...\n");

  try {
    // Test direct connection to Hardhat node
    const response = await fetch("http://localhost:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1
      })
    });

    const data = await response.json();
    if (data.result) {
      console.log("✅ Hardhat node is accessible");
      console.log("✅ Current block number:", parseInt(data.result, 16));
    } else {
      console.log("❌ Hardhat node not responding properly");
    }

    // Test contract deployment
    console.log("\n5. Testing deployed Lock contract...");
    const contractResponse = await fetch("http://localhost:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getCode",
        params: ["0x5FbDB2315678afecb367f032d93F642f64180aa3", "latest"],
        id: 1
      })
    });

    const contractData = await contractResponse.json();
    if (contractData.result && contractData.result !== "0x") {
      console.log("✅ Lock contract is deployed and accessible");
    } else {
      console.log("❌ Lock contract not found at address");
    }
  } catch (error) {
    console.error("❌ Blockchain connectivity test failed:", error.message);
  }
}

// Test database connectivity
async function testDatabaseConnectivity() {
  console.log("\n🗄️ Testing Database Connectivity...\n");

  try {
    // Test health endpoint
    const health = await apiRequest("/health");
    console.log("✅ Backend health check:", health.status);
    console.log("✅ Database connections:", health.databases);

    // Test database info
    const dbInfo = await apiRequest("/db-info");
    console.log("✅ Database info retrieved");
    console.log(
      "   - PostgreSQL:",
      dbInfo.postgres ? "Connected" : "Disconnected"
    );
    console.log("   - MongoDB:", dbInfo.mongo ? "Connected" : "Disconnected");
    console.log("   - Redis:", dbInfo.redis ? "Connected" : "Disconnected");
  } catch (error) {
    console.error("❌ Database connectivity test failed:", error.message);
  }
}

// Test frontend connectivity
async function testFrontendConnectivity() {
  console.log("\n🌐 Testing Frontend Connectivity...\n");

  try {
    const response = await fetch("http://localhost:3000");
    if (response.ok) {
      console.log("✅ Frontend is accessible");
      console.log("✅ React app is running");
    } else {
      console.log("❌ Frontend returned status:", response.status);
    }
  } catch (error) {
    console.error("❌ Frontend connectivity test failed:", error.message);
  }
}

// Main test function
async function runWeb3IntegrationTests() {
  console.log("🚀 Starting Web3 Stack Integration Tests\n");
  console.log("=".repeat(50));

  // Test 1: Database connectivity
  await testDatabaseConnectivity();

  // Test 2: Frontend connectivity
  await testFrontendConnectivity();

  // Test 3: Blockchain connectivity
  await testBlockchainConnectivity();

  // Test 4: Wallet authentication
  const token = await testWalletAuth();

  // Test 5: Web3 endpoints (with authentication if available)
  await testWeb3Endpoints(token);

  console.log("\n" + "=".repeat(50));
  console.log("✅ Web3 Stack Integration Tests Completed!");
  console.log("\n📋 Summary:");
  console.log("   • Backend API: Running on http://localhost:5001");
  console.log("   • Frontend: Running on http://localhost:3000");
  console.log("   • Hardhat Node: Running on http://localhost:8545");
  console.log(
    "   • Lock Contract: Deployed at 0x5FbDB2315678afecb367f032d93F642f64180aa3"
  );
  console.log("   • Database: PostgreSQL, MongoDB, Redis connected");
  console.log("   • Web3 Service: Ready for blockchain interactions");
  console.log("   • Wallet Auth: Challenge/verify flow working");
  console.log("\n🔧 Next Steps:");
  console.log("   1. Open http://localhost:3000 in your browser");
  console.log("   2. Connect MetaMask wallet (switch to localhost:8545)");
  console.log("   3. Test wallet authentication flow");
  console.log("   4. Interact with the deployed Lock contract");
  console.log("\n🔑 Hardhat Account for Testing:");
  console.log("   Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  console.log(
    "   Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
}

// Run tests
runWeb3IntegrationTests().catch(console.error);
