"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Eye, EyeOff, RefreshCw } from "lucide-react";
import { confirmSignup, resendConfirmationCode } from "@/actions/confirm-signup";

function ConfirmForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus premier champ au montage
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleCodeChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-focus le champ suivant
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  const codeString = code.join("");

  // Validation mot de passe en temps réel
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    match: password === confirmPassword && password.length > 0,
  };
  const allChecksPass = Object.values(passwordChecks).every(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (codeString.length !== 6 || !allChecksPass) return;

    setError("");
    setIsLoading(true);
    try {
      const result = await confirmSignup({
        email,
        code: codeString,
        password,
        confirmPassword,
      });
      if (result.success) {
        setSuccess(true);
        // Rediriger vers login après 2 secondes
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError(result.error || "Une erreur est survenue");
      }
    } catch {
      setError("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      const result = await resendConfirmationCode(email);
      if (result.success) {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        setError(result.error || "Impossible de renvoyer le code");
      }
    } catch {
      setError("Erreur lors du renvoi du code");
    } finally {
      setResendLoading(false);
    }
  }

  if (!email) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">Adresse email manquante.</p>
        <Link href="/signup">
          <Button className="w-full h-11 rounded-xl font-semibold text-sm">
            Retour à l&apos;inscription
          </Button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
          <Check className="h-7 w-7 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Compte activé !</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Votre mot de passe a été défini. Redirection vers la connexion...
          </p>
        </div>
        <Link href="/login">
          <Button className="w-full h-11 rounded-xl font-semibold text-sm mt-2">
            Se connecter maintenant
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h2 className="text-lg font-bold">Confirmez votre compte</h2>
        <p className="text-xs text-muted-foreground mt-2">
          Un code à 6 chiffres a été envoyé à <strong className="text-foreground">{email}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl bg-destructive/8 border border-destructive/20 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {/* Code à 6 chiffres */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Code de confirmation</Label>
          <div className="flex gap-2 justify-center" onPaste={handleCodePaste}>
            {code.map((digit, i) => (
              <Input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-bold rounded-xl"
                disabled={isLoading}
              />
            ))}
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
            >
              {resendLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {resendSuccess ? "Code renvoyé !" : "Renvoyer le code"}
            </button>
          </div>
        </div>

        {/* Mot de passe */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">Mot de passe</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="rounded-xl h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Indicateurs de robustesse */}
          {password.length > 0 && (
            <div className="space-y-1 mt-2">
              {[
                { check: passwordChecks.length, label: "Au moins 8 caractères" },
                { check: passwordChecks.uppercase, label: "Une majuscule" },
                { check: passwordChecks.lowercase, label: "Une minuscule" },
                { check: passwordChecks.digit, label: "Un chiffre" },
              ].map(({ check, label }) => (
                <div key={label} className={`flex items-center gap-2 text-xs ${check ? "text-green-600" : "text-muted-foreground"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${check ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirmation mot de passe */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmer le mot de passe</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Confirmez votre mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
            className="rounded-xl h-11"
          />
          {confirmPassword.length > 0 && !passwordChecks.match && (
            <p className="text-xs text-destructive mt-1">Les mots de passe ne correspondent pas</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl font-semibold text-sm mt-2"
          disabled={isLoading || codeString.length !== 6 || !allChecksPass}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Activation en cours...
            </>
          ) : (
            "Activer mon compte"
          )}
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t text-center">
        <p className="text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </>
  );
}

export default function ConfirmSignupPage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
      <ConfirmForm />
    </Suspense>
  );
}
