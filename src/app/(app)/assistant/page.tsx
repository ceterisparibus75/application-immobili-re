"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  FileText,
  TrendingDown,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────────── */

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface GeneratedLetter {
  subject: string;
  bodyHtml: string;
  legalReferences: string[];
  tone: string;
  summary: string;
}

interface PredictionResult {
  tenantId: string;
  tenantName: string;
  lotLabel: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  defaultProbability: number;
  predictedDaysLate: number;
  riskFactors: string[];
  recommendations: string[];
}

interface PredictionSummary {
  predictions: PredictionResult[];
  generatedAt: string;
  totalTenants: number;
  highRiskCount: number;
  totalExposure: number;
}

/* ─── Chatbot Tab ───────────────────────────────────────────────── */

function ChatbotTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error ?? "Erreur inconnue" }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erreur de connexion au serveur." }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
    }
  }, [input, loading, messages]);

  return (
    <div className="flex flex-col h-[600px]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Bot className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Assistant MyGestia</p>
            <p className="text-sm mt-1">Posez vos questions sur la gestion immobilière</p>
            <div className="mt-6 grid gap-2 text-sm">
              {[
                "Quels sont les diagnostics obligatoires pour une location ?",
                "Comment calculer la révision de loyer avec l'IRL ?",
                "Quelle est la procédure pour un congé bailleur ?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-left px-3 py-2 rounded-lg border hover:bg-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-4 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            {msg.role === "user" && (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Posez votre question..."
            className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Letter Generator Tab ──────────────────────────────────────── */

const LETTER_TYPES = [
  { value: "mise_en_demeure", label: "Mise en demeure" },
  { value: "relance_loyer", label: "Relance loyer impayé" },
  { value: "conge_bailleur", label: "Congé du bailleur" },
  { value: "revision_loyer", label: "Notification révision de loyer" },
  { value: "regularisation_charges", label: "Régularisation des charges" },
  { value: "attestation", label: "Attestation de loyer" },
  { value: "demande_assurance", label: "Demande d'attestation d'assurance" },
  { value: "avis_travaux", label: "Avis de travaux" },
  { value: "courrier_libre", label: "Courrier libre" },
];

function LetterGeneratorTab() {
  const [letterType, setLetterType] = useState("relance_loyer");
  const [description, setDescription] = useState("");
  const [bailleurNom, setBailleurNom] = useState("");
  const [bailleurAdresse, setBailleurAdresse] = useState("");
  const [locataireNom, setLocataireNom] = useState("");
  const [bienAdresse, setBienAdresse] = useState("");
  const [montantImpayes, setMontantImpayes] = useState("");
  const [letter, setLetter] = useState<GeneratedLetter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError("");
    setLetter(null);

    try {
      const res = await fetch("/api/ai/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letterType,
          description,
          context: {
            bailleurNom: bailleurNom || "[Nom du bailleur]",
            bailleurAdresse: bailleurAdresse || "[Adresse du bailleur]",
            locataireNom: locataireNom || undefined,
            bienAdresse: bienAdresse || undefined,
            montantImpayes: montantImpayes ? parseFloat(montantImpayes) : undefined,
          },
        }),
      });
      const data = (await res.json()) as { letter?: GeneratedLetter; error?: string };
      if (data.letter) {
        setLetter(data.letter);
      } else {
        setError(data.error ?? "Erreur inconnue");
      }
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  const copyHtml = () => {
    if (!letter) return;
    navigator.clipboard.writeText(letter.bodyHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paramètres du courrier</CardTitle>
          <CardDescription>Remplissez les informations pour générer le courrier</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Type de courrier</label>
            <select
              value={letterType}
              onChange={(e) => setLetterType(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {LETTER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Description de la demande *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez la situation : ex. Le locataire n'a pas payé depuis 2 mois, relancer avec un ton ferme..."
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm min-h-[100px]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Nom du bailleur</label>
              <input
                value={bailleurNom}
                onChange={(e) => setBailleurNom(e.target.value)}
                placeholder="SCI Exemple"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Adresse du bailleur</label>
              <input
                value={bailleurAdresse}
                onChange={(e) => setBailleurAdresse(e.target.value)}
                placeholder="12 rue de la Paix, Paris"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nom du locataire</label>
              <input
                value={locataireNom}
                onChange={(e) => setLocataireNom(e.target.value)}
                placeholder="M. / Mme Dupont"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Adresse du bien</label>
              <input
                value={bienAdresse}
                onChange={(e) => setBienAdresse(e.target.value)}
                placeholder="5 avenue des Champs, Lyon"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Montant impayé (EUR)</label>
            <input
              type="number"
              value={montantImpayes}
              onChange={(e) => setMontantImpayes(e.target.value)}
              placeholder="1500"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={generate}
            disabled={loading || !description.trim()}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Génération en cours...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Générer le courrier</>
            )}
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Aperçu du courrier</CardTitle>
            {letter && (
              <button onClick={copyHtml} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copié" : "Copier HTML"}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!letter && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">Le courrier généré apparaîtra ici</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">L&apos;IA rédige votre courrier...</p>
            </div>
          )}

          {letter && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{letter.tone}</Badge>
                <span className="text-sm text-muted-foreground">{letter.summary}</span>
              </div>

              <div className="border rounded-lg p-4">
                <p className="font-medium mb-3">{letter.subject}</p>
                <div
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: letter.bodyHtml }}
                />
              </div>

              {letter.legalReferences.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Références légales</p>
                  <div className="flex flex-wrap gap-1">
                    {letter.legalReferences.map((ref, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{ref}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Prediction Tab ────────────────────────────────────────────── */

const RISK_CONFIG: Record<string, { color: string; bg: string; icon: typeof ShieldCheck }> = {
  low: { color: "text-emerald-600", bg: "bg-emerald-50", icon: ShieldCheck },
  medium: { color: "text-amber-600", bg: "bg-amber-50", icon: Shield },
  high: { color: "text-orange-600", bg: "bg-orange-50", icon: ShieldAlert },
  critical: { color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle },
};

function PredictionTab() {
  const [data, setData] = useState<PredictionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPredictions = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/predict-defaults");
      const json = (await res.json()) as PredictionSummary | { error: string };
      if ("error" in json) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Analyse les historiques de paiement pour prédire les risques d&apos;impayés
          </p>
        </div>
        <button
          onClick={loadPredictions}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours...</>
          ) : (
            <><TrendingDown className="h-4 w-4" /> Lancer l&apos;analyse</>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Summary cards */}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold">{data.totalTenants}</p>
                <p className="text-xs text-muted-foreground">Locataires analysés</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-red-600">{data.highRiskCount}</p>
                <p className="text-xs text-muted-foreground">Risque élevé / critique</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold">
                  {data.totalExposure.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                </p>
                <p className="text-xs text-muted-foreground">Exposition totale</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold">
                  {new Date(data.generatedAt).toLocaleDateString("fr-FR")}
                </p>
                <p className="text-xs text-muted-foreground">Date d&apos;analyse</p>
              </CardContent>
            </Card>
          </div>

          {/* Predictions list */}
          {data.predictions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun locataire avec un bail actif trouvé.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.predictions.map((p) => {
                const config = RISK_CONFIG[p.riskLevel] ?? RISK_CONFIG.low;
                const RiskIcon = config.icon;
                return (
                  <Card key={p.tenantId}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className={cn("flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center", config.bg)}>
                          <RiskIcon className={cn("h-5 w-5", config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{p.tenantName}</p>
                            <Badge variant="outline" className="text-xs">{p.lotLabel}</Badge>
                            <Badge
                              className={cn(
                                "text-xs",
                                p.riskLevel === "critical" && "bg-red-100 text-red-800",
                                p.riskLevel === "high" && "bg-orange-100 text-orange-800",
                                p.riskLevel === "medium" && "bg-amber-100 text-amber-800",
                                p.riskLevel === "low" && "bg-emerald-100 text-emerald-800",
                              )}
                            >
                              Score : {p.riskScore}/100
                            </Badge>
                          </div>

                          {/* Risk factors */}
                          <div className="mt-2 space-y-1">
                            {p.riskFactors.map((f, i) => (
                              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                <span className="text-muted-foreground/50 mt-0.5">-</span>
                                {f}
                              </p>
                            ))}
                          </div>

                          {/* Recommendations */}
                          {p.recommendations.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs font-medium mb-1">Recommandations</p>
                              {p.recommendations.map((r, i) => (
                                <p key={i} className="text-xs text-primary flex items-start gap-1">
                                  <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  {r}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Stats row */}
                          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                            <span>Probabilité impayé : <strong>{Math.round(p.defaultProbability * 100)}%</strong></span>
                            {p.predictedDaysLate > 0 && (
                              <span>Retard estimé : <strong>{p.predictedDaysLate}j</strong></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Prédiction d&apos;impayés</p>
            <p className="text-sm mt-1">Cliquez sur &quot;Lancer l&apos;analyse&quot; pour démarrer</p>
            <p className="text-xs mt-3 max-w-md mx-auto">
              L&apos;analyse utilise l&apos;historique de paiement de vos locataires pour calculer
              un score de risque et recommander des actions préventives.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */

export default function AssistantPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assistant IA</h1>
        <p className="text-muted-foreground">
          Chatbot, génération de courriers et analyse prédictive
        </p>
      </div>

      <Tabs defaultValue="chatbot">
        <TabsList>
          <TabsTrigger value="chatbot">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chatbot
          </TabsTrigger>
          <TabsTrigger value="letters">
            <FileText className="h-4 w-4 mr-2" />
            Courriers IA
          </TabsTrigger>
          <TabsTrigger value="predictions">
            <TrendingDown className="h-4 w-4 mr-2" />
            Prédiction impayés
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chatbot">
          <Card>
            <ChatbotTab />
          </Card>
        </TabsContent>

        <TabsContent value="letters">
          <LetterGeneratorTab />
        </TabsContent>

        <TabsContent value="predictions">
          <PredictionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
