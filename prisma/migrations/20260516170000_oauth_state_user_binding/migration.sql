-- Sécurise le state PKCE de l'OAuth PA (e-invoicing) :
--   - state opaque aléatoire (au lieu de societyId)
--   - lié à l'utilisateur ayant initié l'authorize
--
-- Les états en cours sont invalidés (ils auraient échoué de toute façon
-- après ce déploiement, expire dans 10 min, usage unique).

DELETE FROM "PAOAuthState";

ALTER TABLE "PAOAuthState"
  ADD COLUMN "state"  TEXT NOT NULL,
  ADD COLUMN "userId" TEXT NOT NULL;

CREATE UNIQUE INDEX "PAOAuthState_state_key" ON "PAOAuthState"("state");
CREATE INDEX "PAOAuthState_state_idx" ON "PAOAuthState"("state");
CREATE INDEX "PAOAuthState_userId_idx" ON "PAOAuthState"("userId");

ALTER TABLE "PAOAuthState"
  ADD CONSTRAINT "PAOAuthState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
