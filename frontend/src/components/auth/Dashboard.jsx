import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  FiUser,
  FiLogOut,
  FiActivity,
  FiShield,
  FiCreditCard,
  FiHome,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
  FiCopy,
  FiTrendingUp,
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiLoader
} from "react-icons/fi";

const Dashboard = () => {
  const {
    user,
    logout,
    getProfile,
    getStats,
    getActivity,
    getSessions,
    getSecurityEvents,
    getTenantActivity,
    getTransactions,
    loading,
    error,
    clearError
  } = useAuth();

  const [activeTab, setActiveTab] = useState("overview");
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState({
    stats: null,
    activity: [],
    sessions: [],
    securityEvents: [],
    tenantActivity: [],
    transactions: []
  });
  const [loadingData, setLoadingData] = useState({});

  useEffect(() => {
    if (user) {
      loadOverviewData();
    }
  }, [user]);

  const loadOverviewData = async () => {
    try {
      setLoadingData((prev) => ({ ...prev, stats: true }));
      const stats = await getStats();
      setData((prev) => ({ ...prev, stats }));
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoadingData((prev) => ({ ...prev, stats: false }));
    }
  };

  const loadTabData = async (tab) => {
    if (data[tab] && data[tab].length > 0) return; // Already loaded

    try {
      setLoadingData((prev) => ({ ...prev, [tab]: true }));
      let result;

      switch (tab) {
        case "activity":
          result = await getActivity({ limit: 20 });
          break;
        case "sessions":
          result = await getSessions();
          break;
        case "securityEvents":
          result = await getSecurityEvents({ limit: 20 });
          break;
        case "tenantActivity":
          result = await getTenantActivity({ limit: 20 });
          break;
        case "transactions":
          result = await getTransactions({ limit: 20 });
          break;
        default:
          return;
      }

      setData((prev) => ({ ...prev, [tab]: result[tab] || result }));
    } catch (error) {
      console.error(`Failed to load ${tab}:`, error);
    } finally {
      setLoadingData((prev) => ({ ...prev, [tab]: false }));
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    loadTabData(tab);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "success":
      case "completed":
        return <FiCheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <FiClock className="h-4 w-4 text-yellow-500" />;
      case "failed":
      case "error":
        return <FiXCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FiAlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: FiUser },
    { id: "activity", label: "Activity", icon: FiActivity },
    { id: "sessions", label: "Sessions", icon: FiShield },
    { id: "securityEvents", label: "Security", icon: FiAlertTriangle },
    { id: "tenantActivity", label: "Tenant Activity", icon: FiHome },
    { id: "transactions", label: "Transactions", icon: FiCreditCard }
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-2 text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center">
                <FiUser className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Welcome, {user.name || user.email}
                </h1>
                <p className="text-sm text-gray-600">
                  {user.role || "User"} •{" "}
                  {user.tenantId ? `Tenant: ${user.tenantId}` : "No Tenant"}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <FiLogOut className="h-4 w-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <FiAlertTriangle className="h-5 w-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-700 font-medium">Error</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button
                  onClick={clearError}
                  className="mt-2 text-xs text-red-600 hover:text-red-500"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === "overview" && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* User Info Card */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">User ID</p>
                      <p className="text-2xl font-bold">{user.id}</p>
                    </div>
                    <FiUser className="h-8 w-8 text-blue-200" />
                  </div>
                </div>

                {/* Stats Cards */}
                {data.stats && (
                  <>
                    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-green-100 text-sm">Total Logins</p>
                          <p className="text-2xl font-bold">
                            {data.stats.totalLogins || 0}
                          </p>
                        </div>
                        <FiTrendingUp className="h-8 w-8 text-green-200" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-purple-100 text-sm">
                            Active Sessions
                          </p>
                          <p className="text-2xl font-bold">
                            {data.stats.activeSessions || 0}
                          </p>
                        </div>
                        <FiShield className="h-8 w-8 text-purple-200" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-orange-100 text-sm">Last Login</p>
                          <p className="text-lg font-bold">
                            {data.stats.lastLogin
                              ? formatDate(data.stats.lastLogin)
                              : "Never"}
                          </p>
                        </div>
                        <FiClock className="h-8 w-8 text-orange-200" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Details */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  User Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      <span className="text-sm text-gray-900">
                        {user.email}
                      </span>
                      <button
                        onClick={() => copyToClipboard(user.email)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <FiCopy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {user.walletAddress && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Wallet Address
                      </label>
                      <div className="mt-1 flex items-center space-x-2">
                        <span className="text-sm text-gray-900 font-mono">
                          {showSensitiveData
                            ? user.walletAddress
                            : formatAddress(user.walletAddress)}
                        </span>
                        <button
                          onClick={() =>
                            setShowSensitiveData(!showSensitiveData)
                          }
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {showSensitiveData ? (
                            <FiEyeOff className="h-4 w-4" />
                          ) : (
                            <FiEye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(user.walletAddress)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <FiCopy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {user.role && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <span className="mt-1 text-sm text-gray-900">
                        {user.role}
                      </span>
                    </div>
                  )}

                  {user.tenantId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Tenant ID
                      </label>
                      <span className="mt-1 text-sm text-gray-900">
                        {user.tenantId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Data Tables */}
          {activeTab !== "overview" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </h3>
                <button
                  onClick={() => loadTabData(activeTab)}
                  disabled={loadingData[activeTab]}
                  className="flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <FiRefreshCw
                    className={`h-4 w-4 mr-2 ${
                      loadingData[activeTab] ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </button>
              </div>

              {loadingData[activeTab] ? (
                <div className="text-center py-8">
                  <FiLoader className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                  <p className="mt-2 text-gray-600">Loading data...</p>
                </div>
              ) : data[activeTab]?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(data[activeTab][0]).map((key) => (
                          <th
                            key={key}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (str) => str.toUpperCase())}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data[activeTab].map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {Object.entries(item).map(([key, value]) => (
                            <td
                              key={key}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                            >
                              {key === "status" ? (
                                <div className="flex items-center">
                                  {getStatusIcon(value)}
                                  <span className="ml-2">{value}</span>
                                </div>
                              ) : key.includes("date") ||
                                key.includes("time") ? (
                                formatDate(value)
                              ) : key.includes("address") ? (
                                <span className="font-mono">
                                  {formatAddress(value)}
                                </span>
                              ) : typeof value === "object" ? (
                                <pre className="text-xs">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              ) : (
                                String(value)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No data available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Copy Feedback */}
      {copied && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center">
            <FiCheckCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Copied to clipboard!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
