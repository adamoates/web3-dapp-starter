import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { FiMail, FiCheck, FiAlertCircle, FiRefreshCw } from "react-icons/fi";

const EmailVerification = ({ email, onVerificationComplete }) => {
  const { verifyEmail, resendVerification, loading, error, clearError } =
    useAuth();
  const [token, setToken] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("pending"); // 'pending', 'success', 'failed'
  const [resendStatus, setResendStatus] = useState("idle"); // 'idle', 'loading', 'success', 'failed'
  const [countdown, setCountdown] = useState(0);

  // Auto-extract token from URL if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      handleVerifyEmail(urlToken);
    }
  }, []);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerifyEmail = async (verificationToken) => {
    try {
      clearError();
      setVerificationStatus("pending");
      await verifyEmail(verificationToken);
      setVerificationStatus("success");
      if (onVerificationComplete) {
        onVerificationComplete();
      }
    } catch (error) {
      setVerificationStatus("failed");
      console.error("Email verification failed:", error);
    }
  };

  const handleResendVerification = async () => {
    if (!email) return;

    try {
      setResendStatus("loading");
      clearError();
      await resendVerification(email);
      setResendStatus("success");
      setCountdown(60); // 60 second cooldown
    } catch (error) {
      setResendStatus("failed");
      console.error("Resend verification failed:", error);
    }
  };

  const handleManualVerification = (e) => {
    e.preventDefault();
    if (token.trim()) {
      handleVerifyEmail(token.trim());
    }
  };

  const handleInputChange = (e) => {
    setToken(e.target.value);
    if (error) {
      clearError();
    }
    if (verificationStatus === "failed") {
      setVerificationStatus("pending");
    }
  };

  if (verificationStatus === "success") {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <FiCheck className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Email Verified!
            </h2>
            <p className="text-gray-600">
              Your email address has been successfully verified. You can now
              access all features of your account.
            </p>
          </div>

          <button
            onClick={() => onVerificationComplete && onVerificationComplete()}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <FiMail className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Verify Your Email
          </h2>
          <p className="text-gray-600">
            We've sent a verification link to <strong>{email}</strong>
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <FiAlertCircle className="text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {verificationStatus === "failed" && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <FiAlertCircle className="text-yellow-500 mr-2" />
              <span className="text-yellow-700 text-sm">
                Verification failed. Please check your token and try again.
              </span>
            </div>
          </div>
        )}

        {resendStatus === "success" && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <FiCheck className="text-green-500 mr-2" />
              <span className="text-green-700 text-sm">
                Verification email sent successfully!
              </span>
            </div>
          </div>
        )}

        {/* Manual Token Entry */}
        <div className="mb-6">
          <label
            htmlFor="token"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Or enter verification token manually:
          </label>
          <form onSubmit={handleManualVerification} className="flex space-x-2">
            <input
              type="text"
              id="token"
              value={token}
              onChange={handleInputChange}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter verification token"
            />
            <button
              type="submit"
              disabled={loading || !token.trim()}
              className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                loading || !token.trim()
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              }`}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </div>
              ) : (
                "Verify"
              )}
            </button>
          </form>
        </div>

        {/* Resend Verification */}
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-4">
            Didn't receive the email? Check your spam folder or request a new
            verification email.
          </p>

          <button
            onClick={handleResendVerification}
            disabled={resendStatus === "loading" || countdown > 0}
            className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
              resendStatus === "loading" || countdown > 0
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            }`}
          >
            {resendStatus === "loading" ? (
              <>
                <FiRefreshCw className="animate-spin mr-2" />
                Sending...
              </>
            ) : countdown > 0 ? (
              `Resend in ${countdown}s`
            ) : (
              <>
                <FiRefreshCw className="mr-2" />
                Resend Verification Email
              </>
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">What to do next:</h3>
          <ol className="text-sm text-gray-600 space-y-1">
            <li>1. Check your email inbox for the verification link</li>
            <li>2. Click the verification link in the email</li>
            <li>3. Or copy the token from the email and paste it above</li>
            <li>4. Once verified, you'll have full access to your account</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
