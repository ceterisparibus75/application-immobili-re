"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import Link from "next/link";

export function ArticleFeedback() {
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);

  if (voted === "yes") {
    return (
      <div className="mt-12 pt-8 border-t text-center">
        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
          Merci, nous sommes ravis que cet article vous ait aidé !
        </p>
      </div>
    );
  }

  if (voted === "no") {
    return (
      <div className="mt-12 pt-8 border-t text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Merci pour votre retour. Pour obtenir de l'aide supplémentaire :
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <MessageSquare className="h-4 w-4" />
          Contacter le support
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-12 pt-8 border-t text-center">
      <p className="text-sm text-muted-foreground mb-3">Cet article vous a-t-il été utile ?</p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => setVoted("yes")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800 transition-colors"
        >
          <ThumbsUp className="h-4 w-4" />
          Oui, merci
        </button>
        <button
          onClick={() => setVoted("no")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 dark:hover:bg-rose-950/30 dark:hover:border-rose-800 transition-colors"
        >
          <ThumbsDown className="h-4 w-4" />
          Pas vraiment
        </button>
      </div>
    </div>
  );
}
