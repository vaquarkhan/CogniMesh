import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { signIn, signOut, fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { configureAmplify } from "./amplify";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [error, setError] = useState(null);

  const refreshSession = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      setToken(idToken || null);
      if (idToken) {
        const current = await getCurrentUser();
        setUser(current);
      }
    } catch {
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const cfg = await configureAmplify();
      if (cfg.authDisabled) {
        setAuthDisabled(true);
        setUser({ username: "local-dev" });
        setLoading(false);
        return;
      }
      await refreshSession();
      setLoading(false);
    })();
  }, [refreshSession]);

  const login = async (email, password) => {
    setError(null);
    await signIn({ username: email, password });
    await refreshSession();
  };

  const logout = async () => {
    if (!authDisabled) await signOut();
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      authDisabled,
      error,
      setError,
      login,
      logout,
      userEmail: user?.signInDetails?.loginId || (authDisabled ? "local-dev@cognimesh.local" : user?.username),
    }),
    [user, token, loading, authDisabled, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
