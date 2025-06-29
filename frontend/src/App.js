// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/index";
import LockUI from "./components/LockUI";

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page route */}
        <Route path="/" element={<LandingPage />} />

        {/* LockUI interface route */}
        <Route
          path="/app"
          element={
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
              <LockUI />
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
