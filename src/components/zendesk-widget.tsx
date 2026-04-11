"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSociety } from "@/providers/society-provider";

declare global {
  interface Window {
    zE?: (...args: unknown[]) => void;
    zESettings?: Record<string, unknown>;
  }
}

const ZENDESK_KEY = process.env.NEXT_PUBLIC_ZENDESK_KEY;

/**
 * Widget Zendesk Messaging.
 *
 * - Sur les pages publiques : widget anonyme (pas de session).
 * - Dans l'application : identifie automatiquement l'utilisateur
 *   (nom, email, société) pour que le support ait le contexte.
 */
export function ZendeskWidget() {
  const { data: session } = useSession();
  const { activeSociety } = useSociety();
  const identifiedRef = useRef(false);

  // 1. Charger le script Zendesk une seule fois
  useEffect(() => {
    if (!ZENDESK_KEY) return;
    if (document.getElementById("ze-snippet")) return;

    // Pré-configuration avant chargement du script
    window.zESettings = {
      webWidget: {
        color: { theme: "#1B4F8A" },
        launcher: { label: { "fr": "Aide" } },
        contactForm: {
          title: { "fr": "Contactez-nous" },
          fields: [
            { id: "description", prefill: { "*": "" } },
          ],
        },
      },
    };

    const script = document.createElement("script");
    script.id = "ze-snippet";
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${ZENDESK_KEY}`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // 2. Identifier l'utilisateur connecté auprès de Zendesk
  useEffect(() => {
    if (!ZENDESK_KEY || !session?.user) return;

    const identify = () => {
      if (!window.zE) return;

      try {
        // Identification de l'utilisateur via Zendesk Messaging
        window.zE("messenger", "loginUser", function (callback: (jwt: string) => void) {
          // Sans JWT : on utilise le prefill à la place
          void callback;
        });
      } catch {
        // loginUser peut échouer sans JWT — pas grave
      }

      try {
        // Pré-remplir le nom et l'email dans le formulaire de contact
        window.zE("messenger:set", "conversationFields", [
          { id: "name", value: session.user.name ?? "" },
          { id: "email", value: session.user.email ?? "" },
        ]);
      } catch {
        // Fallback silencieux
      }

      try {
        // Tags pour identifier la société et le contexte dans les tickets
        const tags: string[] = ["mygestia"];
        if (activeSociety) {
          tags.push(`societe:${activeSociety.name?.replace(/\s+/g, "_")}`);
          if (activeSociety.legalForm) {
            tags.push(`forme:${activeSociety.legalForm}`);
          }
        }
        window.zE("messenger:set", "conversationTags", tags);
      } catch {
        // Fallback silencieux
      }

      identifiedRef.current = true;
    };

    // Le script peut ne pas être encore chargé — on réessaie
    if (window.zE) {
      identify();
    } else {
      const timer = setInterval(() => {
        if (window.zE) {
          identify();
          clearInterval(timer);
        }
      }, 500);

      // Timeout : arrêter après 15s si le script ne charge pas
      const timeout = setTimeout(() => clearInterval(timer), 15000);

      return () => {
        clearInterval(timer);
        clearTimeout(timeout);
      };
    }
  }, [session, activeSociety]);

  // Pas de clé = pas de widget
  if (!ZENDESK_KEY) return null;

  return null;
}
