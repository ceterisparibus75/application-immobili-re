"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { createSignatureRequestFromUrl } from "@/actions/signature";
import { useSociety } from "@/providers/society-provider";

interface SignatureRequestDialogProps {
  documentUrl: string;
  documentName: string;
  documentType: "BAIL" | "ETAT_DES_LIEUX" | "MANDAT" | "AUTRE";
  documentId?: string;
  defaultSignerEmail?: string;
  defaultSignerName?: string;
  children?: React.ReactNode;
}

export function SignatureRequestDialog({
  documentUrl,
  documentName,
  documentType,
  documentId,
  defaultSignerEmail = "",
  defaultSignerName = "",
  children,
}: SignatureRequestDialogProps) {
  const { activeSociety } = useSociety();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [subject, setSubject] = useState(`Signature requise : ${documentName}`);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSociety) return;

    setLoading(true);
    try {
      const result = await createSignatureRequestFromUrl(activeSociety.id, {
        documentUrl,
        documentName,
        documentType,
        documentId,
        signerEmail,
        signerName,
        subject: subject || undefined,
        message: message || undefined,
      });

      if (result.success) {
        toast.success("Demande de signature envoyee avec succes");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Erreur lors de l'envoi");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <Send className="h-4 w-4" />
            Envoyer a la signature
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer a la signature</DialogTitle>
          <DialogDescription>
            Le document &quot;{documentName}&quot; sera envoye par email pour
            signature electronique via DocuSign.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signerEmail">Email du signataire</Label>
            <Input
              id="signerEmail"
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              required
              placeholder="email@exemple.fr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signerName">Nom du signataire</Label>
            <Input
              id="signerName"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              required
              placeholder="Prenom Nom"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Objet de l&rsquo;email</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message (optionnel)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message personnalise pour le signataire..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading || !signerEmail || !signerName}
            >
              {loading ? "Envoi en cours..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
