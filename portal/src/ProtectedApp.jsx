import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/Login";
import App from "./App";

export default function ProtectedApp() {
  const { user, loading, authDisabled } = useAuth();

  if (loading) {
    return (
      <div className="login-page">
        <p className="login-subtitle">Loading…</p>
      </div>
    );
  }

  if (!user && !authDisabled) {
    return <LoginPage />;
  }

  return <App />;
}
