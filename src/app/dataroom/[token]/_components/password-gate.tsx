"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, FolderLock, Loader2, Eye, EyeOff } from "lucide-react";
import { verifyDataroomPassword } from "@/actions/dataroom";

export function PasswordGate({ token, dataroomName }: { token: string; dataroomName: string }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GestImmo";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);

    const result = await verifyDataroomPassword(token, password);

    if (result.success) {
      // Set cookie client-side then reload
      document.cookie = `dr_auth_${token}=authorized; path=/; max-age=3600; SameSite=Strict`;
      window.location.reload();
    } else {
      setError(result.error ?? "Mot de passe incorrect");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-foreground">{appName}</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FolderLock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Accès protégé</h1>
            <p className="text-sm text-muted-foreground">
              La dataroom <strong className="text-foreground">{dataroomName}</strong> est protégée par un mot de passe.
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez le mot de passe…"
                  className="pr-9"
                  autoFocus
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading || !password.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderLock className="h-4 w-4" />}
              Accéder à la dataroom
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Accès sécurisé fourni par {appName}
        </p>
      </div>
    </div>
  );
}
