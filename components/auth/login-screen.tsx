"use client";

import { useState, type FormEvent } from "react";
import { Layers3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LoginResult {
  ok: boolean;
  error?: string;
}

interface LoginScreenProps {
  login: (staffCode: string, password: string) => Promise<LoginResult>;
}

export function LoginScreen({ login }: LoginScreenProps) {
  const [staffCode, setStaffCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const result = await login(staffCode.trim(), password);
    setSubmitting(false);
    if (!result.ok) setError(result.error || "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="brand-icon mb-3 flex h-12 w-12 items-center justify-center">
            <Layers3 size={26} />
          </div>
          <h1 className="text-lg font-semibold">UTH Smart Assets</h1>
          <p className="text-sm text-muted-foreground">โรงพยาบาลอุดรธานี · ระบบบริหารครุภัณฑ์</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-background p-5 shadow-sm"
          aria-busy={submitting}
        >
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <ShieldCheck size={16} />
            เข้าสู่ระบบ
          </div>

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium">รหัสบุคลากร</span>
            <input
              value={staffCode}
              onChange={(e) => setStaffCode(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="เช่น 12345"
              className="h-9 w-full rounded-md border px-3 text-sm bg-background"
              required
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium">รหัสผ่าน</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-9 w-full rounded-md border px-3 text-sm bg-background"
              required
            />
          </label>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full justify-center">
            {submitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          เข้าสู่ระบบด้วยรหัสบุคลากรที่โรงพยาบาลมอบให้
        </p>
      </div>
    </main>
  );
}

export default LoginScreen;
