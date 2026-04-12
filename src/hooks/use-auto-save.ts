"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoSaveOptions<T> {
  /** Clé unique pour le brouillon (ex: "lease-form-new" ou "lease-form-cm123") */
  key: string;
  /** Données actuelles du formulaire */
  data: T;
  /** Délai avant sauvegarde automatique (ms, défaut: 30000 = 30s) */
  delay?: number;
  /** Activer/désactiver l'auto-save */
  enabled?: boolean;
}

interface UseAutoSaveReturn<T> {
  /** Brouillon sauvegardé (null si aucun brouillon) */
  draft: T | null;
  /** Date de dernière sauvegarde */
  lastSaved: Date | null;
  /** État de sauvegarde */
  status: "idle" | "saving" | "saved";
  /** Restaurer le brouillon dans le formulaire */
  restoreDraft: () => T | null;
  /** Effacer le brouillon manuellement */
  clearDraft: () => void;
  /** Sauvegarder immédiatement (sans attendre le délai) */
  saveNow: () => void;
  /** Indique si un brouillon existe pour cette clé */
  hasDraft: boolean;
}

const DRAFT_PREFIX = "mygestia-draft-";

/**
 * Hook pour auto-sauvegarder les brouillons de formulaire en localStorage.
 * Sauvegarde toutes les `delay` ms si les données ont changé.
 */
export function useAutoSave<T>({
  key,
  data,
  delay = 30000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastDataRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Charger le brouillon existant
  const [draft, setDraft] = useState<T | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as { data: T; savedAt: string };
      return parsed.data;
    } catch {
      return null;
    }
  });

  const hasDraft = draft !== null;

  const saveDraft = useCallback(() => {
    const serialized = JSON.stringify(data);
    if (serialized === lastDataRef.current) return; // Pas de changement

    setStatus("saving");
    try {
      const payload = { data, savedAt: new Date().toISOString() };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      lastDataRef.current = serialized;
      setLastSaved(new Date());
      setDraft(data);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("idle");
    }
  }, [data, storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setDraft(null);
    setLastSaved(null);
    setStatus("idle");
    lastDataRef.current = "";
  }, [storageKey]);

  const restoreDraft = useCallback((): T | null => {
    return draft;
  }, [draft]);

  // Auto-save timer
  useEffect(() => {
    if (!enabled) return;

    timerRef.current = setInterval(() => {
      saveDraft();
    }, delay);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, delay, saveDraft]);

  // Sauvegarder avant de quitter la page
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      saveDraft();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, saveDraft]);

  return {
    draft,
    lastSaved,
    status,
    restoreDraft,
    clearDraft,
    saveNow: saveDraft,
    hasDraft,
  };
}

/**
 * Liste tous les brouillons existants (pour affichage dans l'UI).
 */
export function listDrafts(): { key: string; savedAt: string }[] {
  if (typeof window === "undefined") return [];
  const drafts: { key: string; savedAt: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DRAFT_PREFIX)) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? "{}");
        drafts.push({
          key: key.replace(DRAFT_PREFIX, ""),
          savedAt: parsed.savedAt ?? "unknown",
        });
      } catch { /* ignore */ }
    }
  }
  return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/**
 * Efface tous les brouillons.
 */
export function clearAllDrafts(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DRAFT_PREFIX)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) localStorage.removeItem(key);
}
