"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { changePassword } from "@/actions/user";
import { useTheme } from "@/providers/theme-provider";
import {
  getTwoFactorStatus,
  initSetupTwoFactor,
  confirmSetupTwoFactor,
  disableTwoFactor,
} from "@/actions/two-factor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Moon, Sun, Monitor, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import Image from "next/image";

type TwoFAStep = "idle" | "setup" | "recovery" | "disable";

export default function ParametresPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  // --- Mot de passe ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --- 2FA ---
  const [twoFAEnabled, setTwoFAEnabled] = useState<boolean | null>(null);
  const [twoFAStep, setTwoFAStep] = useState<TwoFAStep>("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAError, setTwoFAError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getTwoFactorStatus().then((res) => {
      if (res.success) setTwoFAEnabled(res.data!.enabled);
    });
  }, []);

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const result = await changePassword({
      currentPassword: formData.get("currentPassword") as string,
      newPassword: formData.get("newPassword") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    });

    if (result.success) {
      setSuccess("Mot de passe modifié avec succès");
      (e.target as HTMLFormElement).reset();
    } else {
      setError(result.error ?? "Erreur");
    }

    setIsLoading(false);
  }

  async function handleStart2FASetup() {
    setTwoFALoading(true);
    setTwoFAError("");
    const res = await initSetupTwoFactor();
    if (res.success) {
      setQrCode(res.data!.qrCode);
      setSecret(res.data!.secret);
      setTwoFAStep("setup");
    } else {
      setTwoFAError(res.error ?? "Erreur");
    }
    setTwoFALoading(false);
  }

  async function handleConfirm2FA() {
    setTwoFALoading(true);
    setTwoFAError("");
    const res = await confirmSetupTwoFactor(codeInput);
    if (res.success) {
      setRecoveryCodes(res.data!.recoveryCodes);
      setTwoFAStep("recovery");
      setCodeInput("");
    } else {
      setTwoFAError(res.error ?? "Code invalide");
    }
    setTwoFALoading(false);
  }

  function handleRecoveryDone() {
    setTwoFAEnabled(true);
    setTwoFAStep("idle");
    setRecoveryCodes([]);
  }

  async function handleDisable2FA() {
    setTwoFALoading(true);
    setTwoFAError("");
    const res = await disableTwoFactor(passwordInput);
    if (res.success) {
      setTwoFAEnabled(false);
      setTwoFAStep("idle");
      setPasswordInput("");
    } else {
      setTwoFAError(res.error ?? "Erreur");
    }
    setTwoFALoading(false);
  }

  async function handleCopyCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">
          Préférences de votre compte
        </p>
      </div>

      {/* Profil */}
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Nom</span>
            <span className="font-medium">{session?.user?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{session?.user?.email}</span>
          </div>
        </CardContent>
      </Card>

      {/* Thème */}
      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>
            Choisissez le thème de l'interface
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
            >
              <Sun className="h-4 w-4" />
              Clair
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-4 w-4" />
              Sombre
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("system")}
            >
              <Monitor className="h-4 w-4" />
              Système
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mot de passe */}
      <Card>
        <CardHeader>
          <CardTitle>Changer le mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-[var(--color-status-positive-bg)] p-3 text-sm text-[var(--color-status-positive)] mb-4">
              {success}
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mot de passe actuel</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Changer le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Authentification à deux facteurs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Authentification à deux facteurs</CardTitle>
              <CardDescription>
                Renforcez la sécurité de votre compte avec une application d'authentification (Google Authenticator, Authy…)
              </CardDescription>
            </div>
            {twoFAEnabled !== null && (
              <Badge variant={twoFAEnabled ? "default" : "secondary"} className="shrink-0">
                {twoFAEnabled ? (
                  <><ShieldCheck className="h-3 w-3 mr-1" /> Activée</>
                ) : (
                  <><ShieldOff className="h-3 w-3 mr-1" /> Désactivée</>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {twoFAError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
              {twoFAError}
            </div>
          )}

          {/* État initial */}
          {twoFAStep === "idle" && twoFAEnabled === false && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sans la 2FA, votre compte n'est protégé que par votre mot de passe. En l'activant, chaque connexion nécessitera un code temporaire généré par votre application.
              </p>
              <Button onClick={handleStart2FASetup} disabled={twoFALoading}>
                {twoFALoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Activer la 2FA
              </Button>
            </div>
          )}

          {twoFAStep === "idle" && twoFAEnabled === true && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                La 2FA est active. Pour la désactiver, saisissez votre mot de passe.
              </p>
              <Button variant="outline" onClick={() => { setTwoFAStep("disable"); setTwoFAError(""); }}>
                <ShieldOff className="h-4 w-4" />
                Désactiver la 2FA
              </Button>
            </div>
          )}

          {/* Étape setup : QR code */}
          {twoFAStep === "setup" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scannez ce QR code avec votre application d'authentification, puis saisissez le code à 6 chiffres affiché.
              </p>
              {qrCode && (
                <div className="flex justify-center">
                  <Image src={qrCode} alt="QR code 2FA" width={180} height={180} className="rounded-md border" />
                </div>
              )}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Saisie manuelle du code secret</summary>
                <code className="mt-1 block break-all font-mono bg-muted p-2 rounded text-xs">{secret}</code>
              </details>
              <div className="space-y-2">
                <Label htmlFor="twofa-code">Code de vérification</Label>
                <Input
                  id="twofa-code"
                  placeholder="123 456"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.replace(/\s/g, ""))}
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConfirm2FA} disabled={twoFALoading || codeInput.length !== 6}>
                  {twoFALoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Vérifier et activer
                </Button>
                <Button variant="ghost" onClick={() => { setTwoFAStep("idle"); setTwoFAError(""); }}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Étape recovery : codes de secours */}
          {twoFAStep === "recovery" && (
            <div className="space-y-4">
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Sauvegardez vos codes de récupération
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Ces codes vous permettront d'accéder à votre compte si vous perdez votre téléphone. Conservez-les en lieu sûr — ils ne seront plus affichés.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((code) => (
                  <code key={code} className="font-mono text-sm bg-muted px-3 py-1.5 rounded text-center">
                    {code}
                  </code>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyCodes}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copié !" : "Copier les codes"}
                </Button>
              </div>
              <Button onClick={handleRecoveryDone}>
                <ShieldCheck className="h-4 w-4" />
                J'ai sauvegardé mes codes
              </Button>
            </div>
          )}

          {/* Étape désactivation */}
          {twoFAStep === "disable" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirmez votre mot de passe pour désactiver la 2FA.
              </p>
              <div className="space-y-2">
                <Label htmlFor="disable-password">Mot de passe</Label>
                <Input
                  id="disable-password"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Votre mot de passe actuel"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDisable2FA} disabled={twoFALoading || !passwordInput}>
                  {twoFALoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Désactiver
                </Button>
                <Button variant="ghost" onClick={() => { setTwoFAStep("idle"); setTwoFAError(""); setPasswordInput(""); }}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
