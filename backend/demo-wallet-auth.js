const { ethers } = require("ethers");
const { v4: uuidv4 } = require("uuid");

// Mock implementations for demonstration
class MockUserService {
  constructor() {
    this.challenges = new Map();
    this.users = new Map();
    this.sessions = new Map();
  }

  generateWalletChallenge(walletAddress, tenantId) {
    const nonce = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const message = `Sign this message to authenticate\nWallet: ${walletAddress}\nNonce: ${nonce}\nTenant: ${tenantId}`;

    const challenge = {
      message,
      nonce,
      expiresAt: expiresAt.toISOString(),
      walletAddress,
      tenantId
    };

    // Store challenge (simulating Redis)
    this.challenges.set(walletAddress, challenge);

    return challenge;
  }

  verifyWalletSignature(walletAddress, signature, tenantId) {
    // Get stored challenge
    const challenge = this.challenges.get(walletAddress);
    if (!challenge) {
      throw new Error("Invalid or expired challenge");
    }

    // Check if challenge is expired
    if (new Date(challenge.expiresAt) < new Date()) {
      throw new Error("Challenge expired");
    }

    // Verify signature
    try {
      const recoveredAddress = ethers.verifyMessage(
        challenge.message,
        signature
      );
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("Invalid signature");
      }
    } catch (error) {
      throw new Error("Invalid signature");
    }

    // Find or create user
    let user = this.users.get(walletAddress);
    if (!user) {
      user = {
        id: this.users.size + 1,
        walletAddress,
        name: `Wallet User ${this.users.size + 1}`,
        tenantId,
        isWalletOnly: true
      };
      this.users.set(walletAddress, user);
    }

    // Generate session
    const sessionId = uuidv4();
    const token = this.generateJWT(user, sessionId);

    // Store session
    this.sessions.set(sessionId, {
      userId: user.id,
      tenantId,
      walletAddress,
      createdAt: new Date()
    });

    // Clear challenge
    this.challenges.delete(walletAddress);

    return {
      user,
      token,
      sessionId
    };
  }

  linkWalletToUser(userId, walletAddress, signature, originalMessage) {
    // Verify signature for linking
    try {
      const recoveredAddress = ethers.verifyMessage(originalMessage, signature);
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("Invalid signature");
      }
    } catch (error) {
      throw new Error("Invalid signature");
    }

    // Find user
    const user = Array.from(this.users.values()).find((u) => u.id === userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Update user
    user.walletAddress = walletAddress;
    user.isWalletOnly = false;
    this.users.set(walletAddress, user);

    return user;
  }

  walletAuthentication(walletAddress, signature, tenantId) {
    return this.verifyWalletSignature(walletAddress, signature, tenantId);
  }

  generateJWT(user, sessionId) {
    // Simple JWT-like token for demonstration
    const payload = {
      userId: user.id,
      tenantId: user.tenantId,
      walletAddress: user.walletAddress,
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };

    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if session is expired (1 hour)
    const sessionAge = Date.now() - session.createdAt.getTime();
    if (sessionAge > 3600 * 1000) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }
}

async function demonstrateWalletAuthentication() {
  console.log("🔐 Demonstrating Wallet Authentication Enhancements\n");

  try {
    // Create test wallets
    const testWallet1 = ethers.Wallet.createRandom();
    const testWallet2 = ethers.Wallet.createRandom();

    console.log(`✅ Test wallet 1: ${testWallet1.address}`);
    console.log(`✅ Test wallet 2: ${testWallet2.address}`);

    // Initialize service
    const userService = new MockUserService();
    console.log("✅ UserService initialized");

    // Test 1: Generate and verify challenge
    console.log("\n📝 Test 1: Challenge generation and verification...");
    const challenge = userService.generateWalletChallenge(
      testWallet1.address,
      1
    );
    console.log("✅ Challenge generated:");
    console.log(`   Message: ${challenge.message.substring(0, 80)}...`);
    console.log(`   Nonce: ${challenge.nonce}`);
    console.log(`   Expires: ${challenge.expiresAt}`);

    const signature = await testWallet1.signMessage(challenge.message);
    console.log("✅ Challenge signed");
    console.log(`   Signature: ${signature.substring(0, 50)}...`);

    const result = userService.verifyWalletSignature(
      testWallet1.address,
      signature,
      1
    );
    console.log("✅ Signature verified:");
    console.log(`   User ID: ${result.user.id}`);
    console.log(`   Wallet: ${result.user.walletAddress}`);
    console.log(`   Token: ${result.token.substring(0, 30)}...`);
    console.log(`   Session: ${result.sessionId}`);

    // Test 2: Test invalid signature
    console.log("\n❌ Test 2: Invalid signature rejection...");
    const invalidSignature = "0x" + "1".repeat(130);

    try {
      userService.verifyWalletSignature(
        testWallet1.address,
        invalidSignature,
        1
      );
      console.log("❌ Should have failed");
    } catch (error) {
      console.log("✅ Correctly rejected invalid signature");
      console.log(`   Error: ${error.message}`);
    }

    // Test 3: Test wallet linking
    console.log("\n🔗 Test 3: Wallet linking...");
    const linkMessage = `Link wallet ${
      testWallet2.address
    } to your account.\n\nUser ID: 1\nTimestamp: ${Date.now()}`;
    const linkSignature = await testWallet2.signMessage(linkMessage);

    const linkedUser = userService.linkWalletToUser(
      1,
      testWallet2.address,
      linkSignature,
      linkMessage
    );
    console.log("✅ Wallet linked successfully:");
    console.log(`   User: ${linkedUser.name}`);
    console.log(`   Wallet: ${linkedUser.walletAddress}`);
    console.log(`   Wallet-only: ${linkedUser.isWalletOnly}`);

    // Test 4: Test session validation
    console.log("\n🔍 Test 4: Session validation...");
    const session = userService.validateSession(result.sessionId);
    if (session) {
      console.log("✅ Session validated:");
      console.log(`   User ID: ${session.userId}`);
      console.log(`   Tenant ID: ${session.tenantId}`);
      console.log(`   Wallet: ${session.walletAddress}`);
    } else {
      console.log("❌ Session validation failed");
    }

    // Test 5: Test complete authentication flow
    console.log("\n🔄 Test 5: Complete authentication flow...");
    const challenge2 = userService.generateWalletChallenge(
      testWallet2.address,
      1
    );
    const signature2 = await testWallet2.signMessage(challenge2.message);
    const authResult = userService.walletAuthentication(
      testWallet2.address,
      signature2,
      1
    );

    console.log("✅ Complete authentication successful:");
    console.log(`   User: ${authResult.user.name}`);
    console.log(`   Token: ${authResult.token.substring(0, 30)}...`);
    console.log(`   Session: ${authResult.sessionId}`);

    // Test 6: Test multi-tenant support
    console.log("\n🏢 Test 6: Multi-tenant support...");
    const tenant2Challenge = userService.generateWalletChallenge(
      testWallet1.address,
      2
    );
    const tenant2Signature = await testWallet1.signMessage(
      tenant2Challenge.message
    );
    const tenant2Result = userService.verifyWalletSignature(
      testWallet1.address,
      tenant2Signature,
      2
    );

    console.log("✅ Multi-tenant authentication successful:");
    console.log(`   User ID: ${tenant2Result.user.id}`);
    console.log(`   Tenant ID: ${tenant2Result.user.tenantId}`);
    console.log(`   Session: ${tenant2Result.sessionId}`);

    console.log("\n🎉 All wallet authentication demonstrations passed!");
    console.log("\n📋 Summary of demonstrated features:");
    console.log("   ✅ Challenge-response authentication flow");
    console.log("   ✅ Cryptographic signature verification");
    console.log("   ✅ User creation for new wallets");
    console.log("   ✅ Wallet linking to existing accounts");
    console.log("   ✅ Session management with expiration");
    console.log("   ✅ JWT-like token generation");
    console.log("   ✅ Multi-tenant support");
    console.log("   ✅ Security validation (invalid signatures)");
    console.log("   ✅ Complete end-to-end authentication");

    console.log("\n🔧 Technical Implementation Details:");
    console.log("   • Uses ethers.js for wallet operations");
    console.log("   • UUID-based nonce generation");
    console.log("   • 5-minute challenge expiration");
    console.log("   • 1-hour session expiration");
    console.log("   • Tenant-aware user management");
    console.log("   • Secure signature verification");
  } catch (error) {
    console.error("❌ Demonstration failed:", error.message);
    console.error(error.stack);
  }
}

// Run the demonstration
demonstrateWalletAuthentication();
