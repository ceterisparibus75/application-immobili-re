"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import {
  initSetupTwoFactor,
  confirmSetupTwoFactor,
  disableTwoFactor,
} from "@/actions/two-factor";

interface TwoFactorSectionProps {
  twoFactorEnabled: boolean;
}

export function TwoFactorSection({ twoFactorEnabled: initialEnabled }: TwoFactorSectionProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<"idle" | "setup" | "disable" | "recovery-codes">("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function handleStartSetup() {
    setIsLoading(true);
    try {
      const result = await initSetupTwoFactor();
      if (result.success && result.data) {
        setQrCode(result.data.qrCode);
        setSecret(result.data.secret);
        setStep("setup");
      } else {
        toast.error(result.error ?? "Erreur lors de l'initialisation");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmSetup() {
    setIsLoading(true);
    try {
      const result = await confirmSetupTwoFactor(code);
      if (result.success && result.data?.recoveryCodes) {
        setRecoveryCodes(result.data.recoveryCodes);
        setCode("");
        setStep("recovery-codes");
      } else {
        toast.error(result.error ?? "Code invalide");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisable() {
    setIsLoading(true);
    try {
      const result = await disableTwoFactor(password);
      if (result.success) {
        setEnabled(false);
        setStep("idle");
        setPassword("");
        toast.success("Authentification 2FA desactivee");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <ShieldX className="h-5 w-5 text-muted-foreground" />
          )}
          <CardTitle>Authentification a deux facteurs</CardTitle>
        </div>
        <CardDescription>
          {enabled
            ? "L&apos;authentification a deux facteurs est activee sur votre compte."
            : "Renforcez la securite de votre compte avec une application d&apos;authentification."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "idle" && (
          <>
            {enabled ? (
              <Button variant="destructive" onClick={() => setStep("disable")}>
                Desactiver le 2FA
              </Button>
            ) : (
              <Button onClick={handleStartSetup} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Activer le 2FA
              </Button>
            )}
          </>
        )}

        {step === "setup" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Scannez ce QR code avec votre application d&apos;authentification (Google Authenticator, Authy, etc.)
              </p>
              {qrCode && (
                <Image
                  src={qrCode}
                  alt="QR Code 2FA"
                  width={200}
                  height={200}
                  className="rounded-lg border"
                />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Ou entrez manuellement ce code :</p>
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{secret}</code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-code">Code de verification</Label>
              <Input
                id="confirm-code"
                type="text"
                inputMode="numeric"
                maxLength={7}
                placeholder="000 000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="max-w-[200px] text-center font-mono tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleConfirmSetup}
                disabled={isLoading || code.replace(/\s/g, "").length < 6}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmer
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("idle");
                  setCode("");
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {step === "recovery-codes" && (
          <div className="space-y-4">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                Sauvegardez ces codes de recuperation
              </p>
              <p className="text-xs text-amber-700 mb-3">
                Chaque code ne peut etre utilise qu&apos;une seule fois. Conservez-les dans un endroit sur (gestionnaire de mots de passe, papier sous clef...).
              </p>
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((code, i) => (
                  <code key={i} className="bg-white border rounded px-2 py-1 text-sm font-mono text-center">
                    {code}
                  </code>
                ))}
              </div>
            </div>
            <Button
              onClick={() => {
                setEnabled(true);
                setStep("idle");
                setRecoveryCodes([]);
                toast.success("Authentification 2FA activee avec succes");
              }}
            >
              J&apos;ai sauvegarde mes codes
            </Button>
          </div>
        )}

        {step === "disable" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Confirmez avec votre mot de passe pour desactiver le 2FA.
            </p>
            <div className="space-y-2">
              <Label htmlFor="disable-password">Mot de passe</Label>
              <Input
                id="disable-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={isLoading || !password}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Desactiver
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("idle");
                  setPassword("");
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
