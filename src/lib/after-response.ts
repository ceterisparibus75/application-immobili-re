import { after } from "next/server";

/**
 * Planifie une tâche à exécuter après l'envoi de la réponse, sans la perdre.
 *
 * Sur Vercel, une promesse lancée sans `await` (« fire-and-forget ») peut être
 * gelée dès que la Server Action a répondu : la tâche ne se termine jamais.
 * `after()` prolonge l'exécution de la fonction jusqu'à la fin de la tâche
 * (dans la limite du `maxDuration` de la route).
 *
 * Hors contexte de requête (tests, scripts), `after()` lève une erreur : on
 * retombe alors sur une exécution non bloquante classique.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): void {
  const guarded = (): Promise<void> =>
    task().then(
      () => undefined,
      (err: unknown) => {
        console.error(`[${label}] Tâche différée échouée:`, err);
      }
    );
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}
