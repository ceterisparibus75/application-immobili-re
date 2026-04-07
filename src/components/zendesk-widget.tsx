"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSociety } from "@/providers/society-provider";

declare global {
  interface Window {
    zE?: (...args: unknown[]) => void;
  }
}

const ZENDESK_KEY = process.env.NEXT_PUBLIC_ZENDESK_KEY;

/**
 * Widget Zendesk Messaging.
 *
 * - Sur les pages publiques : widget anonyme (pas de session).
 * - Dans l'application : identifie automatiquement l'utilisateur
 *   (nom, email, societe) pour que le support ait le contexte.
 *
 * Le SocietyContext a une valeur par defaut, donc useSociety()
 * retourne { activeSociety: null } meme sans SocietyProvider.
 */
export function ZendeskWidget() {
  const { data: session } = useSession();
  const { activeSociety } = useSociety();

  // 1. Charger le script Zendesk une seule fois
  useEffect(() => {
    if (!ZENDESK_KEY) return;
    if (document.getElementById("ze-snippet")) return;

    const script = document.createElement("script");
    script.id = "ze-snippet";
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${ZENDESK_KEY}`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // 2. Identifier l'utilisateur connecte aupres de Zendesk
  useEffect(() => {
    if (!ZENDESK_KEY || !session?.user) return;

    const identify = () => {
      if (!window.zE) return;

      // Prefill les informations utilisateur dans le widget
      window.zE("messenger:set", "conversationFields", [
        { id: "name", value: session.user.name ?? "" },
        { id: "email", value: session.user.email ?? "" },
      ]);

      // Tags pour identifier la societe dans les tickets
      if (activeSociety) {
        window.zE("messenger:set", "conversationTags", [
          `societe:${activeSociety.name}`,
          `plan:${activeSociety.legalForm}`,
        ]);
      }
    };

    // Le script peut ne pas etre encore charge
    const timer = setInterval(() => {
      if (window.zE) {
        identify();
        clearInterval(timer);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [session, activeSociety]);

  // Pas de cle = pas de widget
  if (!ZENDESK_KEY) return null;

  return null;
}
