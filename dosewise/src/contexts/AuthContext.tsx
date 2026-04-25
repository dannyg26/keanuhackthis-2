import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, setToken, type User } from "../lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: !!getToken(),
    error: null,
  });

  // On mount, hydrate user from token if present
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    api.auth.me()
      .then(({ user }) => { if (!cancelled) setState({ user, loading: false, error: null }); })
      .catch(() => {
        if (cancelled) return;
        setToken(null);
        setState({ user: null, loading: false, error: null });
      });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const { token, user } = await api.auth.login({ email, password });
      setToken(token);
      setState({ user, loading: false, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Login failed";
      setState(s => ({ ...s, loading: false, error: message }));
      throw e;
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const { token, user } = await api.auth.signup({ name, email, password });
      setToken(token);
      setState({ user, loading: false, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Signup failed";
      setState(s => ({ ...s, loading: false, error: message }));
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setState({ user: null, loading: false, error: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, signup, logout }),
    [state, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
