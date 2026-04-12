"use client";

import { useEffect, useState } from "react";

/**
 * Composant qui ajoute la classe "keyboard-nav" sur le body
 * quand l'utilisateur navigue au clavier (Tab).
 * Utile pour afficher les outlines de focus uniquement au clavier.
 */
export function KeyboardFocusIndicator() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        document.body.classList.add("keyboard-nav");
      }
    };
    const handleMouseDown = () => {
      document.body.classList.remove("keyboard-nav");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  return null;
}

/**
 * Skip link pour l'accessibilité — permet de sauter la navigation
 * et aller directement au contenu principal.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-medium"
    >
      Aller au contenu principal
    </a>
  );
}

/**
 * Annonce pour les lecteurs d'écran (live region).
 * Utilisé pour annoncer les changements dynamiques.
 */
export function ScreenReaderAnnounce({ message }: { message: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (message) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText("");
      // Double RAF pour forcer le lecteur d'écran à re-lire
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setText(message);
        });
      });
    }
  }, [message]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {text}
    </div>
  );
}
