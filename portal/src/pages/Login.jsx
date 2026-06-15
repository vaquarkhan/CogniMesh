import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { login, error, setError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setLocalError(err.message || "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>CogniMesh</h1>
        <p className="login-subtitle">Secure pipeline designer</p>

        <div className="login-notice">
          Access is invite-only. Self-registration is disabled. Contact your administrator for an account.
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@yourcompany.com"
              required
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {(localError || error) && <p className="login-error">{localError || error}</p>}
          <button type="submit" className="deploy-btn login-btn" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
