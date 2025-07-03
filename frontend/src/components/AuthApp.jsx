import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import LoginForm from "./auth/LoginForm";
import RegisterForm from "./auth/RegisterForm";
import PasswordResetForm from "./auth/PasswordResetForm";
import EmailVerification from "./auth/EmailVerification";
import Dashboard from "./auth/Dashboard";
import WalletConnector from "./auth/WalletConnector";
import WalletProfileForm from "./auth/WalletProfileForm";
import {
  FiShield,
  FiLoader,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiUsers,
  FiActivity,
  FiSettings,
  FiLogOut,
  FiUser,
  FiMail,
  FiKey,
  FiHome,
  FiArrowLeft
} from "react-icons/fi";

const AuthApp = () => {
  const {
    user,
    isAuthenticated,
    loading,
    error,
    registrationSuccess,
    newWalletUser,
    clearError,
    clearRegistrationSuccess
  } = useAuth();

  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("login");
  const [showWalletConnector, setShowWalletConnector] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [apiTestResults, setApiTestResults] = useState({});
  const [testingApi, setTestingApi] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setCurrentView("dashboard");
    }
  }, [isAuthenticated, user]);

  // Handle registration success
  useEffect(() => {
    if (registrationSuccess) {
      setCurrentView("verification");
      clearRegistrationSuccess();
    }
  }, [registrationSuccess, clearRegistrationSuccess]);

  // Handle new wallet user requiring profile completion
  useEffect(() => {
    if (newWalletUser) {
      setCurrentView("wallet-profile");
    }
  }, [newWalletUser]);

  const handleViewChange = (view) => {
    setCurrentView(view);
    clearError();
    setShowWalletConnector(false);
  };

  const handleRegistrationSuccess = (email) => {
    setVerificationEmail(email);
    setCurrentView("verification");
  };

  const handleVerificationComplete = () => {
    setCurrentView("login");
    setVerificationEmail("");
  };

  const handleProfileComplete = () => {
    setCurrentView("dashboard");
  };

  const handleWalletConnect = () => {
    setShowWalletConnector(true);
  };

  const handleWalletClose = () => {
    setShowWalletConnector(false);
  };

  const handleNavigateToLanding = () => {
    navigate("/");
  };

  // API Testing Functions
  const testApiEndpoint = async (endpoint, method = "GET", body = null) => {
    const token = localStorage.getItem("authToken");
    const tenantId = localStorage.getItem("tenantId");

    const config = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(tenantId && { "X-Tenant-ID": tenantId })
      },
      ...(body && { body: JSON.stringify(body) })
    };

    try {
      const response = await fetch(`http://localhost:5001${endpoint}`, config);
      const data = await response.json();

      return {
        success: response.ok,
        status: response.status,
        data: response.ok ? data : null,
        error: response.ok ? null : data.error || `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        status: 0,
        data: null,
        error: error.message
      };
    }
  };

  const runApiTests = async () => {
    setTestingApi(true);
    const results = {};

    // Test all endpoints
    const endpoints = [
      { name: "Profile", endpoint: "/api/auth/profile" },
      { name: "Stats", endpoint: "/api/auth/stats" },
      { name: "Activity", endpoint: "/api/auth/activity" },
      { name: "Sessions", endpoint: "/api/auth/sessions" },
      { name: "Security Events", endpoint: "/api/auth/security-events" },
      { name: "Tenant Activity", endpoint: "/api/tenants/activity" },
      { name: "Transactions", endpoint: "/api/web3/transactions" },
      { name: "Health Check", endpoint: "/health" }
    ];

    for (const endpoint of endpoints) {
      results[endpoint.name] = await testApiEndpoint(endpoint.endpoint);
    }

    setApiTestResults(results);
    setTestingApi(false);
  };

  const renderApiTestResults = () => (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          API Endpoint Tests
        </h3>
        <button
          onClick={runApiTests}
          disabled={testingApi}
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <FiRefreshCw
            className={`h-4 w-4 mr-2 ${testingApi ? "animate-spin" : ""}`}
          />
          {testingApi ? "Testing..." : "Test All Endpoints"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(apiTestResults).map(([name, result]) => (
          <div
            key={name}
            className={`p-4 rounded-lg border ${
              result.success
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">{name}</h4>
              {result.success ? (
                <FiCheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <FiAlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className="text-xs text-gray-600">Status: {result.status}</p>
            {result.error && (
              <p className="text-xs text-red-600 mt-1">{result.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderView = () => {
    switch (currentView) {
      case "login":
        return <LoginForm />;
      case "register":
        return <RegisterForm />;
      case "reset":
        return <PasswordResetForm />;
      case "verification":
        return <EmailVerification />;
      case "dashboard":
        return (
          <div>
            {renderApiTestResults()}
            <Dashboard />
          </div>
        );
      case "wallet-profile":
        return <WalletProfileForm onComplete={handleProfileComplete} />;
      default:
        return <LoginForm />;
    }
  };

  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <FiShield className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">
                Blockchain DApp
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Back to Landing Page Button - Always visible */}
              <button
                onClick={handleNavigateToLanding}
                className="flex items-center px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <FiArrowLeft className="mr-2" />
                Back to Home
              </button>

              {isAuthenticated && user && (
                <>
                  <div className="text-sm text-gray-600">
                    Welcome, {user.firstName} {user.lastName}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {user.role || "User"}
                    </span>
                    {user.tenantId && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Tenant: {user.tenantId}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isAuthenticated && user ? (
          // Authenticated User Dashboard
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FiUser className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Profile Status
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {user.emailVerified ? "Verified" : "Pending"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FiMail className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Email</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FiKey className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Auth Method
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {user.walletAddress ? "Wallet" : "Email"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <FiActivity className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Last Login
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Dashboard */}
            <Dashboard />
          </div>
        ) : (
          // Authentication Forms
          <div className="flex justify-center">
            {currentView === "login" && (
              <LoginForm
                onSwitchToRegister={() => handleViewChange("register")}
                onSwitchToReset={() => handleViewChange("reset")}
                onWalletConnect={handleWalletConnect}
              />
            )}

            {currentView === "register" && (
              <RegisterForm
                onSwitchToLogin={() => handleViewChange("login")}
                onRegistrationSuccess={handleRegistrationSuccess}
              />
            )}

            {currentView === "reset" && (
              <PasswordResetForm
                onBackToLogin={() => handleViewChange("login")}
              />
            )}

            {currentView === "verification" && (
              <EmailVerification
                email={verificationEmail}
                onVerificationComplete={handleVerificationComplete}
              />
            )}
          </div>
        )}
      </main>

      {/* Wallet Connector Modal */}
      {showWalletConnector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <WalletConnector onClose={handleWalletClose} />
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center">
            <FiAlertTriangle className="mr-2" />
            <span>{error}</span>
            <button
              onClick={clearError}
              className="ml-4 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 Blockchain DApp. All rights reserved.</p>
            <div className="mt-2 space-x-4 text-sm">
              <a href="#" className="hover:text-blue-600">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-blue-600">
                Terms of Service
              </a>
              <a href="#" className="hover:text-blue-600">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AuthApp;
