"use client";

import { useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/auth-provider";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  WAREHOUSE: "คลัง",
  WARD: "หอผู้ป่วย",
  AUDITOR: "ผู้ตรวจสอบ",
};

/**
 * Compact "who is logged in + logout" chip for the top bar.
 * Only renders when there is a current user (guaranteed inside the app shell,
 * which is only mounted after authentication).
 */
export function AuthUserChip() {
  const { currentUser, logout, hasRole } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!currentUser) return null;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const label = ROLE_LABELS[currentUser.role] || currentUser.role;
  const source = currentUser.fullName || currentUser.staffCode || "?";
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div className="avatar flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold" title={`${currentUser.fullName} · ${label}`}>
        {initials}
      </div>
      {hasRole("ADMIN") && (
        <span className="hidden items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground sm:inline-flex">
          <ShieldCheck size={12} /> {label}
        </span>
      )}
      <button type="button" onClick={handleLogout} disabled={loggingOut} className="btn btn-ghost btn-sm" title="ออกจากระบบ">
        <LogOut size={14} />
        <span className="hidden sm:inline">{loggingOut ? "กำลังออก…" : "ออกจากระบบ"}</span>
      </button>
    </div>
  );
}

export default AuthUserChip;
