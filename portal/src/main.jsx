import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedApp from "./ProtectedApp";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary name="Application">
      <AuthProvider>
        <ProtectedApp />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
