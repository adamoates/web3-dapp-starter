import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  FiCreditCard,
  FiAlertCircle,
  FiCheckCircle,
  FiLoader,
  FiCopy,
  FiExternalLink,
  FiRefreshCw
} from "react-icons/fi";

const WalletConnector = () => {
  const {
    connectWallet,
    verifyWalletSignature,
    wallet,
    challenge,
    loading,
    error,
    clearError
  } = useAuth();

  const [step, setStep] = useState("connect"); // 'connect', 'sign', 'verifying', 'success'
  const [copied, setCopied] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);

  useEffect(() => {
    if (wallet && challenge) {
      setStep("sign");
    }
  }, [wallet, challenge]);

  useEffect(() => {
    if (wallet?.provider) {
      getNetworkInfo();
    }
  }, [wallet]);

  const getNetworkInfo = async () => {
    try {
      const network = await wallet.provider.getNetwork();
      setNetworkInfo({
        name: network.name,
        chainId: network.chainId.toString()
      });
    } catch (error) {
      console.error("Failed to get network info:", error);
    }
  };

  const handleConnect = async () => {
    try {
      setStep("connect");
      clearError();
      await connectWallet();
    } catch (error) {
      console.error("Wallet connection failed:", error);
      setStep("connect");
    }
  };

  const handleSign = async () => {
    if (!wallet || !challenge) return;

    try {
      setStep("verifying");
      const signature = await wallet.signer.signMessage(challenge.challenge);
      await verifyWalletSignature(signature);
      setStep("success");
    } catch (error) {
      console.error("Wallet signature failed:", error);
      setStep("sign");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }] // Ethereum mainnet
      });
      await getNetworkInfo();
    } catch (error) {
      console.error("Failed to switch network:", error);
    }
  };

  const renderConnectStep = () => (
    <div className="text-center space-y-4">
      <div className="mx-auto h-16 w-16 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center">
        <FiCreditCard className="h-8 w-8 text-white" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Connect Your Wallet
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Connect your MetaMask wallet to access the dApp securely
        </p>
      </div>

      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        {loading ? (
          <>
            <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5" />
            Connecting...
          </>
        ) : (
          <>
            <FiCreditCard className="mr-2 h-5 w-5" />
            Connect MetaMask
          </>
        )}
      </button>

      <div className="text-xs text-gray-500">
        Don't have MetaMask?{" "}
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-500"
        >
          Download here
        </a>
      </div>
    </div>
  );

  const renderSignStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <FiCheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Wallet Connected!
        </h3>
      </div>

      {/* Wallet Info */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Address:</span>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-900 font-mono">
              {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
            </span>
            <button
              onClick={() => copyToClipboard(wallet.address)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiCopy className="h-4 w-4" />
            </button>
          </div>
        </div>

        {networkInfo && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Network:</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-900">{networkInfo.name}</span>
              {networkInfo.chainId !== "1" && (
                <button
                  onClick={switchNetwork}
                  className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
                >
                  Switch to Mainnet
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Challenge Info */}
      {challenge && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Authentication Challenge
          </h4>
          <p className="text-xs text-blue-700 mb-3">
            Sign this message to prove you own this wallet:
          </p>
          <div className="bg-white rounded border p-3">
            <p className="text-xs text-gray-600 break-all">
              {challenge.challenge}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={handleSign}
        disabled={loading}
        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        {loading ? (
          <>
            <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5" />
            Signing...
          </>
        ) : (
          <>
            <FiCheckCircle className="mr-2 h-5 w-5" />
            Sign Message
          </>
        )}
      </button>
    </div>
  );

  const renderVerifyingStep = () => (
    <div className="text-center space-y-4">
      <FiLoader className="mx-auto h-12 w-12 text-indigo-500 animate-spin" />
      <h3 className="text-lg font-semibold text-gray-900">
        Verifying Signature
      </h3>
      <p className="text-sm text-gray-600">
        Please wait while we verify your signature...
      </p>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-4">
      <FiCheckCircle className="mx-auto h-12 w-12 text-green-500" />
      <h3 className="text-lg font-semibold text-gray-900">
        Authentication Successful!
      </h3>
      <p className="text-sm text-gray-600">
        You have been successfully authenticated with your wallet.
      </p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <FiAlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-700 font-medium">
                Connection Error
              </p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === "connect" && renderConnectStep()}
      {step === "sign" && renderSignStep()}
      {step === "verifying" && renderVerifyingStep()}
      {step === "success" && renderSuccessStep()}

      {/* Copy Feedback */}
      {copied && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center">
            <FiCheckCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Address copied!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnector;
