import React, { createContext, useContext, useReducer, useEffect } from "react";
import { ethers } from "ethers";

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

// Action Types
const AUTH_ACTIONS = {
  SET_LOADING: "SET_LOADING",
  SET_USER: "SET_USER",
  SET_TOKEN: "SET_TOKEN",
  SET_TENANT: "SET_TENANT",
  SET_ERROR: "SET_ERROR",
  LOGOUT: "LOGOUT",
  SET_WALLET: "SET_WALLET",
  SET_CHALLENGE: "SET_CHALLENGE",
  CLEAR_ERROR: "CLEAR_ERROR",
  SET_REGISTRATION_SUCCESS: "SET_REGISTRATION_SUCCESS",
  SET_NEW_WALLET_USER: "SET_NEW_WALLET_USER",
  CLEAR_NEW_WALLET_USER: "CLEAR_NEW_WALLET_USER"
};

// Initial State
const initialState = {
  user: null,
  token: localStorage.getItem("authToken"),
  tenantId: localStorage.getItem("tenantId") || "",
  wallet: null,
  challenge: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  registrationSuccess: false,
  newWalletUser: null
};

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload
      };
    case AUTH_ACTIONS.SET_TOKEN:
      return { ...state, token: action.payload };
    case AUTH_ACTIONS.SET_TENANT:
      return { ...state, tenantId: action.payload };
    case AUTH_ACTIONS.SET_WALLET:
      return { ...state, wallet: action.payload };
    case AUTH_ACTIONS.SET_CHALLENGE:
      return { ...state, challenge: action.payload };
    case AUTH_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    case AUTH_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    case AUTH_ACTIONS.SET_REGISTRATION_SUCCESS:
      return { ...state, registrationSuccess: action.payload };
    case AUTH_ACTIONS.SET_NEW_WALLET_USER:
      return { ...state, newWalletUser: action.payload };
    case AUTH_ACTIONS.CLEAR_NEW_WALLET_USER:
      return { ...state, newWalletUser: null };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        token: null,
        tenantId: state.tenantId // Keep tenant ID for convenience
      };
    default:
      return state;
  }
}

// Create Context
const AuthContext = createContext();

// API Helper Functions
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem("authToken");
  const tenantId = localStorage.getItem("tenantId");

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(tenantId && { "X-Tenant-ID": tenantId }),
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
    console.error("API Request failed:", error);
    throw error;
  }
};

// Provider Component
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state on mount
  useEffect(() => {
    if (state.token) {
      verifyToken();
    }
  }, []);

  // Verify token validity
  const verifyToken = async () => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      const data = await apiRequest("/api/auth/verify");
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.user });
    } catch (error) {
      console.error("Token verification failed:", error);
      logout();
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // User Registration
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(userData)
      });

      dispatch({ type: AUTH_ACTIONS.SET_REGISTRATION_SUCCESS, payload: true });

      return data;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Email Verification
  const verifyEmail = async (token) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const data = await apiRequest("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token })
      });

      return data;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Resend Verification Email
  const resendVerification = async (email) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const data = await apiRequest("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email })
      });

      return data;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Password Reset Request
  const requestPasswordReset = async (email) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const data = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });

      return data;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Reset Password
  const resetPassword = async (token, newPassword) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const data = await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword })
      });

      return data;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Traditional Login
  const login = async (email, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem("authToken", data.token);
      dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: data.token });
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.user });

      return data;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Wallet Authentication
  const connectWallet = async () => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      // Check if MetaMask is available
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const walletAddress = accounts[0];
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      dispatch({
        type: AUTH_ACTIONS.SET_WALLET,
        payload: { address: walletAddress, provider, signer }
      });

      // Get challenge from server
      const challengeData = await apiRequest("/api/auth/challenge", {
        method: "POST",
        body: JSON.stringify({ walletAddress })
      });

      dispatch({ type: AUTH_ACTIONS.SET_CHALLENGE, payload: challengeData });

      return { walletAddress, challenge: challengeData.challenge };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Verify Wallet Signature
  const verifyWalletSignature = async (signature) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const data = await apiRequest("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: state.wallet.address,
          signature
        })
      });

      // Check if this is a new user requiring profile completion
      if (data.isNewUser && data.requiresProfileCompletion) {
        dispatch({
          type: AUTH_ACTIONS.SET_NEW_WALLET_USER,
          payload: data.user
        });
        return { requiresProfileCompletion: true, user: data.user };
      }

      // Existing user - proceed with normal login
      localStorage.setItem("authToken", data.token);
      dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: data.token });
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.user });
      dispatch({ type: AUTH_ACTIONS.SET_CHALLENGE, payload: null });

      return data;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Complete Wallet User Profile
  const completeWalletProfile = async (profileData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const data = await apiRequest("/api/auth/complete-profile", {
        method: "POST",
        body: JSON.stringify({
          userId: state.newWalletUser.id,
          name: profileData.name,
          email: profileData.email
        })
      });

      localStorage.setItem("authToken", data.token);
      dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: data.token });
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.user });
      dispatch({ type: AUTH_ACTIONS.CLEAR_NEW_WALLET_USER });

      return data;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Logout
  const logout = async () => {
    try {
      if (state.token) {
        await apiRequest("/api/auth/logout", { method: "POST" });
      }
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      localStorage.removeItem("authToken");
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Set Tenant ID
  const setTenantId = (tenantId) => {
    localStorage.setItem("tenantId", tenantId);
    dispatch({ type: AUTH_ACTIONS.SET_TENANT, payload: tenantId });
  };

  // Get User Profile
  const getProfile = async () => {
    try {
      const data = await apiRequest("/api/auth/profile");
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.user });
      return data;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Get User Stats
  const getStats = async () => {
    try {
      return await apiRequest("/api/auth/stats");
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Get User Activity
  const getActivity = async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      return await apiRequest(`/api/auth/activity?${queryString}`);
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Get Active Sessions
  const getSessions = async () => {
    try {
      return await apiRequest("/api/auth/sessions");
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Get Security Events
  const getSecurityEvents = async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      return await apiRequest(`/api/auth/security-events?${queryString}`);
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Admin: Get Tenant Activity
  const getTenantActivity = async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      return await apiRequest(`/api/tenants/activity?${queryString}`);
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Web3: Get Transactions
  const getTransactions = async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      return await apiRequest(`/api/web3/transactions?${queryString}`);
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Clear Error
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Clear Registration Success
  const clearRegistrationSuccess = () => {
    dispatch({ type: AUTH_ACTIONS.SET_REGISTRATION_SUCCESS, payload: false });
  };

  const value = {
    ...state,
    register,
    verifyEmail,
    resendVerification,
    requestPasswordReset,
    resetPassword,
    login,
    logout,
    connectWallet,
    verifyWalletSignature,
    completeWalletProfile,
    setTenantId,
    getProfile,
    getStats,
    getActivity,
    getSessions,
    getSecurityEvents,
    getTenantActivity,
    getTransactions,
    clearError,
    clearRegistrationSuccess
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
