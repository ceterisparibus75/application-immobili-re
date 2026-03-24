"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { completeTwoFactorLogin } from "@/actions/auth";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await completeTwoFactorLogin(code);
      if (result.success) {
        router.push(result.data?.redirectTo ?? "/dashboard");
        router.refresh();
      } else {
        setError(result.error ?? "Code invalide");
      }
    } catch {
      setError("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
        <Building2 className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">GestImmo</span>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-2xl">Verification 2FA</CardTitle>
          </div>
          <CardDescription>
            Entrez le code a 6 chiffres de votre application d&apos;authentification
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Code d&apos;authentification</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                maxLength={7}
                placeholder="000 000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="one-time-code"
                disabled={isLoading}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || code.replace(/\s/g, "").length < 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verification...
                </>
              ) : (
                "Verifier"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
