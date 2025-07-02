import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiCreditCard,
  FiAlertCircle,
  FiLoader,
  FiHome,
  FiUser,
  FiShield
} from "react-icons/fi";

const LoginForm = ({
  onSwitchToRegister,
  onSwitchToReset,
  onWalletConnect
}) => {
  const {
    login,
    connectWallet,
    verifyWalletSignature,
    wallet,
    challenge,
    loading,
    error,
    clearError,
    tenantId,
    setTenantId
  } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState("traditional"); // 'traditional' or 'wallet'
  const [walletStep, setWalletStep] = useState("connect"); // 'connect', 'sign', 'verifying'

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    if (error) clearError();
  };

  const handleTenantChange = (e) => {
    setTenantId(e.target.value);
    if (error) clearError();
  };

  const handleTraditionalLogin = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      return;
    }

    try {
      await login(formData.email, formData.password);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleWalletConnect = async () => {
    try {
      setWalletStep("connect");
      await connectWallet();
      setWalletStep("sign");
    } catch (error) {
      console.error("Wallet connection failed:", error);
      setWalletStep("connect");
    }
  };

  const handleWalletSign = async () => {
    if (!wallet || !challenge) return;

    try {
      setWalletStep("verifying");
      const signature = await wallet.signer.signMessage(challenge.challenge);
      await verifyWalletSignature(signature);
      setWalletStep("connect");
    } catch (error) {
      console.error("Wallet signature failed:", error);
      setWalletStep("sign");
    }
  };

  const isFormValid = formData.email && formData.password;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <FiShield className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-600">Sign in to your account to continue</p>
        </div>

        {/* Tenant ID Input */}
        <div className="mb-6">
          <label
            htmlFor="tenantId"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            <FiHome className="inline h-4 w-4 mr-1" />
            Tenant ID (Optional)
          </label>
          <input
            id="tenantId"
            type="text"
            value={tenantId}
            onChange={handleTenantChange}
            placeholder="Enter tenant ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Authentication Method Toggle */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setAuthMethod("traditional")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMethod === "traditional"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FiMail className="inline h-4 w-4 mr-1" />
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod("wallet")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMethod === "wallet"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FiCreditCard className="inline h-4 w-4 mr-1" />
              Web3 Wallet
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <FiAlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Traditional Login Form */}
        {authMethod === "traditional" && (
          <form onSubmit={handleTraditionalLogin} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                <FiMail className="inline h-4 w-4 mr-1" />
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                <FiLock className="inline h-4 w-4 mr-1" />
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <FiEyeOff className="h-4 w-4" />
                  ) : (
                    <FiEye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={onSwitchToReset}
                  className="text-blue-600 hover:text-blue-500 font-medium"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isFormValid}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                loading || !isFormValid
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? (
                <div className="flex items-center">
                  <FiLoader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        )}

        {/* Wallet Login */}
        {authMethod === "wallet" && (
          <div className="space-y-6">
            <div className="text-center">
              <FiCreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-sm text-gray-600">
                Sign in securely using your Web3 wallet
              </p>
            </div>

            {walletStep === "connect" && (
              <button
                onClick={handleWalletConnect}
                disabled={loading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {loading ? (
                  <div className="flex items-center">
                    <FiLoader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Connecting...
                  </div>
                ) : (
                  "Connect Wallet"
                )}
              </button>
            )}

            {walletStep === "sign" && wallet && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Connected:</strong> {wallet.address}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    Please sign the message to verify your identity
                  </p>
                </div>
                <button
                  onClick={handleWalletSign}
                  disabled={loading}
                  className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <FiLoader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Verifying...
                    </div>
                  ) : (
                    "Sign Message"
                  )}
                </button>
              </div>
            )}

            {walletStep === "verifying" && (
              <div className="text-center">
                <FiLoader className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-4" />
                <p className="text-sm text-gray-600">Verifying signature...</p>
              </div>
            )}
          </div>
        )}

        {/* Switch to Registration */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don't have an account?{" "}
            <button
              onClick={onSwitchToRegister}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Sign up here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
