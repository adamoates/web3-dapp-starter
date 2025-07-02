// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import LandingPage from "./pages/index";
import LockUI from "./components/LockUI";
import AuthApp from "./components/AuthApp";
import "./App.css";

// Wrapper component to handle navigation
function LandingPageWrapper() {
  const navigate = useNavigate();

  const handleNavigateToAuth = () => {
    navigate("/auth");
  };

  return <LandingPage onNavigateToAuth={handleNavigateToAuth} />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Landing page route */}
          <Route path="/" element={<LandingPageWrapper />} />

          {/* LockUI interface route */}
          <Route path="/lock" element={<LockUI />} />

          {/* Authentication app route */}
          <Route path="/auth" element={<AuthApp />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
