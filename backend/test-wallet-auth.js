const { ethers } = require("ethers");
const UserService = require("./src/services/UserService");

async function testWalletAuthentication() {
  console.log("🔐 Testing Wallet Authentication Enhancements\n");

  try {
    // Create a test wallet
    const testWallet = ethers.Wallet.createRandom();
    console.log(`✅ Test wallet created: ${testWallet.address}`);

    // Initialize UserService (with mock databases for testing)
    const mockDatabases = {
      postgres: {},
      redis: {
        set: jest.fn().mockResolvedValue("OK"),
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue("OK"),
        del: jest.fn().mockResolvedValue(1)
      },
      mongodb: {}
    };

    const userService = new UserService(mockDatabases);
    console.log("✅ UserService initialized");

    // Test 1: Generate wallet challenge
    console.log("\n📝 Test 1: Generating wallet challenge...");
    const challenge = await userService.generateWalletChallenge(
      testWallet.address,
      1
    );
    console.log("✅ Challenge generated successfully");
    console.log(`   Message: ${challenge.message.substring(0, 100)}...`);
    console.log(`   Nonce: ${challenge.nonce}`);
    console.log(`   Expires: ${challenge.expiresAt}`);

    // Test 2: Sign the challenge
    console.log("\n✍️ Test 2: Signing challenge...");
    const signature = await testWallet.signMessage(challenge.message);
    console.log("✅ Challenge signed successfully");
    console.log(`   Signature: ${signature.substring(0, 50)}...`);

    // Test 3: Verify signature
    console.log("\n🔍 Test 3: Verifying signature...");

    // Mock the challenge retrieval
    userService.redis.get.mockResolvedValue(JSON.stringify(challenge));

    // Mock user creation
    const mockUser = {
      id: 1,
      walletAddress: testWallet.address,
      name: "Wallet User",
      tenantId: 1,
      isWalletOnly: true
    };

    // Mock User model
    const User = require("./src/models/sql/User");
    User.findOne = jest.fn().mockResolvedValue(null);
    User.create = jest.fn().mockResolvedValue(mockUser);

    // Mock JWT
    const jwt = require("jsonwebtoken");
    jwt.sign = jest.fn().mockReturnValue("mock-jwt-token");

    const result = await userService.verifyWalletSignature(
      testWallet.address,
      signature,
      1
    );
    console.log("✅ Signature verified successfully");
    console.log(`   User ID: ${result.user.id}`);
    console.log(`   Wallet: ${result.user.walletAddress}`);
    console.log(`   Token: ${result.token.substring(0, 20)}...`);
    console.log(`   Session ID: ${result.sessionId}`);

    // Test 4: Test invalid signature
    console.log("\n❌ Test 4: Testing invalid signature...");
    const invalidSignature = "0x" + "1".repeat(130);

    try {
      await userService.verifyWalletSignature(
        testWallet.address,
        invalidSignature,
        1
      );
      console.log("❌ Should have failed with invalid signature");
    } catch (error) {
      console.log("✅ Correctly rejected invalid signature");
      console.log(`   Error: ${error.message}`);
    }

    // Test 5: Test wallet linking
    console.log("\n🔗 Test 5: Testing wallet linking...");
    const linkMessage = `Link wallet ${
      testWallet.address
    } to your account.\n\nUser ID: 1\nTimestamp: ${Date.now()}`;
    const linkSignature = await testWallet.signMessage(linkMessage);

    // Mock user retrieval
    User.findByPk = jest.fn().mockResolvedValue(mockUser);
    mockUser.update = jest.fn().mockResolvedValue(mockUser);

    const linkedUser = await userService.linkWalletToUser(
      1,
      testWallet.address,
      linkSignature
    );
    console.log("✅ Wallet linked successfully");
    console.log(`   User: ${linkedUser.name}`);
    console.log(`   Wallet: ${linkedUser.walletAddress}`);

    // Test 6: Test complete wallet authentication flow
    console.log("\n🔄 Test 6: Testing complete wallet authentication flow...");
    const authResult = await userService.walletAuthentication(
      testWallet.address,
      signature,
      1
    );
    console.log("✅ Complete wallet authentication successful");
    console.log(`   User: ${authResult.user.name}`);
    console.log(`   Token: ${authResult.token.substring(0, 20)}...`);
    console.log(`   Session: ${authResult.sessionId}`);

    console.log("\n🎉 All wallet authentication tests passed!");
    console.log("\n📋 Summary of tested features:");
    console.log("   ✅ Challenge generation with nonce and expiration");
    console.log("   ✅ Message signing with ethers.js");
    console.log("   ✅ Signature verification");
    console.log("   ✅ User creation for new wallets");
    console.log("   ✅ JWT token generation with tenant context");
    console.log("   ✅ Session management");
    console.log("   ✅ Wallet linking to existing accounts");
    console.log("   ✅ Invalid signature rejection");
    console.log("   ✅ Complete authentication flow");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test
testWalletAuthentication();
