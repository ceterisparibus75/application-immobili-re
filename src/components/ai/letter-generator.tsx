"use client";

import { useState, useTransition, useCallback } from "react";
import { generateLetter, type LetterType } from "@/actions/ai-letter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Copy, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";

const LETTER_TYPE_OPTIONS: Array<{ value: LetterType; label: string }> = [
  { value: "MISE_EN_DEMEURE", label: "Mise en demeure" },
  { value: "REGULARISATION", label: "Demande de regularisation" },
  { value: "REVISION_LOYER", label: "Avis de revision de loyer" },
  { value: "RESILIATION_BAIL", label: "Resiliation de bail" },
  { value: "QUITTANCE_PERSONNALISEE", label: "Quittance personnalisee" },
  { value: "COURRIER_LIBRE", label: "Courrier libre" },
];

interface LetterGeneratorProps {
  societyId: string;
  leaseId: string;
}

export function LetterGenerator({ societyId, leaseId }: LetterGeneratorProps) {
  const [letterType, setLetterType] = useState<LetterType>("MISE_EN_DEMEURE");
  const [customInstructions, setCustomInstructions] = useState("");
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = useCallback(() => {
    setError(null);
    setCopied(false);

    startTransition(async () => {
      const result = await generateLetter(
        societyId,
        leaseId,
        letterType,
        customInstructions || undefined
      );

      if (result.success && result.data) {
        setGeneratedContent(result.data.content);
      } else {
        setError(result.error ?? "Erreur inconnue");
        setGeneratedContent(null);
      }
    });
  }, [societyId, leaseId, letterType, customInstructions]);

  const handleCopy = useCallback(async () => {
    if (!generatedContent) return;
    try {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = generatedContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generatedContent]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Generateur de courrier IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Letter type selection */}
        <div className="space-y-2">
          <Label htmlFor="letter-type">Type de courrier</Label>
          <NativeSelect
            id="letter-type"
            options={LETTER_TYPE_OPTIONS}
            value={letterType}
            onChange={(e) => setLetterType(e.target.value as LetterType)}
          />
        </div>

        {/* Custom instructions */}
        <div className="space-y-2">
          <Label htmlFor="custom-instructions">
            Instructions supplementaires (optionnel)
          </Label>
          <Textarea
            id="custom-instructions"
            placeholder="Ex: Mentionner les travaux prevus au 3e etage, rappeler la clause de solidarite..."
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={3}
          />
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generation en cours...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Generer le courrier
            </>
          )}
        </Button>

        {/* Error display */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Generated content preview */}
        {generatedContent && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Courrier genere</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isPending}
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                >
                  <Copy className="h-3 w-3" />
                  {copied ? "Copie !" : "Copier"}
                </Button>
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-4 max-h-[500px] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                {generatedContent}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
