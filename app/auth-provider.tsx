"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { installAuthInterceptor, onUnauthorized } from "@/lib/auth-client.mjs";
import { LoginScreen, type LoginResult } from "@/components/auth/login-screen";

/** Public user shape returned by the /api/auth endpoints (matches app/api/auth/route.ts). */
export interface AuthUser {
  id: string;
  staffCode: string;
  fullName: string;
  role: string;
  active: boolean;
  wards: string[];
}

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: AuthUser };

interface AuthContextValue {
  auth: AuthState;
  currentUser: AuthUser | null;
  login: (staffCode: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        กำลังตรวจสอบการเข้าสู่ระบบ…
      </div>
    </div>
  );
}

/**
 * Authentication gate for the whole app.
 *
 *  - On mount it checks the existing session via `GET /api/auth`.
 *  - While checking: renders a splash.
 *  - No session / 401 (now or later, via the fetch interceptor): renders the login screen.
 *  - Authenticated: renders the real app and exposes login/logout/currentUser/hasRole.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const restoreSession = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/auth", { signal });
      if (!res.ok) {
        setState({ status: "unauthenticated" });
        return;
      }
      const data = await res.json();
      if (data && data.user) {
        setState({ status: "authenticated", user: data.user });
      } else {
        setState({ status: "unauthenticated" });
      }
    } catch (err) {
      if (err && (err as { name?: string }).name === "AbortError") return;
      setState({ status: "unauthenticated" });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void restoreSession(controller.signal);
    const offUnauthorized = onUnauthorized(() => setState({ status: "unauthenticated" }));
    const disposeInterceptor = installAuthInterceptor();
    return () => {
      controller.abort();
      offUnauthorized();
      disposeInterceptor();
    };
  }, [restoreSession]);

  const login = useCallback(async (staffCode: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffCode, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || "รหัสบุคลากรหรือรหัสผ่านไม่ถูกต้อง" };
      }
      if (!data.user) {
        return { ok: false, error: "เข้าสู่ระบบไม่สำเร็จ" };
      }
      setState({ status: "authenticated", user: data.user });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // ล้างสแตทท้องถิ่นเสมอ แม้การเรียก API จะล้มเหลว
    }
    setState({ status: "unauthenticated" });
  }, []);

  const currentUser = state.status === "authenticated" ? state.user : null;

  const hasRole = useCallback(
    (role: string | string[]) => {
      if (!currentUser) return false;
      const allowed = Array.isArray(role) ? role : [role];
      return allowed.includes(currentUser.role);
    },
    [currentUser]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ auth: state, currentUser, login, logout, hasRole }),
    [state, currentUser, login, logout, hasRole]
  );

  if (state.status === "loading") {
    return <AuthSplash />;
  }

  if (state.status === "unauthenticated") {
    return <LoginScreen login={login} />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

export default AuthProvider;
