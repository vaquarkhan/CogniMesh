import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedApp from "./ProtectedApp";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  </React.StrictMode>
);
