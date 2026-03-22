"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBankAccount } from "@/actions/bank";
import { getGocardlessInstitutions, initiateOpenBanking } from "@/actions/bank-connection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Building2, ExternalLink, Loader2, Lock, Search, Wifi } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { toast } from "sonner";
import type { GocardlessInstitution } from "@/lib/gocardless";

type Tab = "manuel" | "openbanking";

export default function NouveauComptePage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [tab, setTab] = useState<Tab>("manuel");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Onglet Manuel ────────────────────────────────────────────────────────

  async function handleSubmitManuel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) { setError("Aucune société sélectionnée"); return; }

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createBankAccount(activeSociety.id, {
      bankName: data.bankName!,
      accountName: data.accountName!,
      iban: data.iban!,
      initialBalance: parseFloat(data.initialBalance ?? "0") || 0,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/banque/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  // ─── Onglet Open Banking ─────────────────────────────────────────────────

  const [institutions, setInstitutions] = useState<GocardlessInstitution[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<GocardlessInstitution | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  async function loadInstitutions() {
    if (!activeSociety) return;
    setLoadingInstitutions(true);
    const result = await getGocardlessInstitutions(activeSociety.id);
    setLoadingInstitutions(false);
    if (result.success && result.data) {
      setInstitutions(result.data);
    } else {
      toast.error(result.error ?? "Impossible de charger les banques");
    }
  }

  async function handleConnectBank() {
    if (!activeSociety || !selectedInstitution) return;
    setIsConnecting(true);
    const result = await initiateOpenBanking(
      activeSociety.id,
      selectedInstitution.id,
      selectedInstitution.name
    );
    setIsConnecting(false);
    if (result.success && result.data) {
      // Rediriger vers le lien d'autorisation GoCardless
      window.location.href = result.data.authLink;
    } else {
      toast.error(result.error ?? "Erreur lors de la connexion");
    }
  }

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(institutionSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/banque">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau compte bancaire</h1>
          <p className="text-muted-foreground">Ajout manuel ou connexion Open Banking</p>
        </div>
      </div>

      {/* Sélection du mode */}
      <div className="flex gap-2 border rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("manuel")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "manuel"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-4 w-4" />
          Manuel
        </button>
        <button
          onClick={() => {
            setTab("openbanking");
            if (institutions.length === 0) loadInstitutions();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "openbanking"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wifi className="h-4 w-4" />
          Open Banking
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ─── Onglet Manuel ─────────────────────────────────────────────── */}
      {tab === "manuel" && (
        <form onSubmit={handleSubmitManuel} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations du compte</CardTitle>
              <CardDescription className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                L&apos;IBAN est chiffré en AES-256-GCM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Banque *</Label>
                  <Input
                    id="bankName"
                    name="bankName"
                    placeholder="BNP Paribas, Crédit Agricole..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountName">Nom du compte *</Label>
                  <Input
                    id="accountName"
                    name="accountName"
                    placeholder="Compte courant SCI"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="iban">IBAN *</Label>
                <Input
                  id="iban"
                  name="iban"
                  placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                  required
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Les espaces sont ignorés automatiquement
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialBalance">Solde initial (€)</Label>
                <Input
                  id="initialBalance"
                  name="initialBalance"
                  type="number"
                  step={0.01}
                  defaultValue={0}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Solde au moment de l&apos;ouverture du suivi
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/banque">
              <Button variant="outline" type="button">Annuler</Button>
            </Link>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Création...</>
              ) : (
                "Créer le compte"
              )}
            </Button>
          </div>
        </form>
      )}

      {/* ─── Onglet Open Banking ────────────────────────────────────────── */}
      {tab === "openbanking" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-blue-500" />
                Connexion Open Banking (PSD2)
              </CardTitle>
              <CardDescription>
                Connectez directement votre compte bancaire. Les transactions seront importées automatiquement.
                Accès sécurisé via GoCardless — vos identifiants bancaires ne sont jamais stockés.
              </CardDescription>
            </CardHeader>
          </Card>

          {loadingInstitutions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Rechercher votre banque..."
                  value={institutionSearch}
                  onChange={(e) => setInstitutionSearch(e.target.value)}
                />
              </div>

              <div className="grid gap-2 max-h-80 overflow-y-auto">
                {filteredInstitutions.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Aucune banque trouvée
                  </p>
                )}
                {filteredInstitutions.map((institution) => (
                  <button
                    key={institution.id}
                    onClick={() => setSelectedInstitution(institution)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      selectedInstitution?.id === institution.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {institution.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={institution.logo} alt={institution.name} className="h-8 w-8 object-contain" />
                    ) : (
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{institution.name}</p>
                      <p className="text-xs text-muted-foreground">{institution.bic}</p>
                    </div>
                  </button>
                ))}
              </div>

              {selectedInstitution && (
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedInstitution(null)}
                  >
                    Annuler
                  </Button>
                  <Button onClick={handleConnectBank} disabled={isConnecting}>
                    {isConnecting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Connexion...</>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        Connecter {selectedInstitution.name}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
