# Registre des DPA / Accords de sous-traitance

**Statut au :** 2026-05-16
**Responsable du suivi :** DPO mygestia
**Mise à jour :** à chaque changement de sous-traitant ou à minima 1× / 12 mois

Conformément à l'article 28 du RGPD, mygestia (Responsable de traitement
au sens où il fournit le service à ses propres clients responsables de
traitement) doit conclure un DPA avec chaque sous-traitant ultérieur. Ce
fichier est le **registre interne** ; la version publique destinée aux
clients est exposée sur https://app.mygestia.immo/dpa.

## Légende

| Statut | Description |
|---|---|
| ✅ Signé | DPA bilatéral signé et archivé |
| 🟡 En cours | Demande envoyée / négociation en cours |
| 🟠 DPA standard accepté | Acceptation des CGU du fournisseur (qui incluent un DPA standard) — pas de signature bilatérale séparée. Acceptable si le DPA standard couvre nos besoins. |
| ❌ Manquant | À traiter avant commercialisation |

## Sous-traitants ultérieurs

| Sous-traitant | Catégorie | Localisation | URL DPA officiel | Statut | Action |
|---|---|---|---|---|---|
| **Supabase** | Hébergement PostgreSQL + Storage | UE (Frankfurt) | https://supabase.com/legal/dpa | 🟠 DPA standard | Vérifier que le DPA standard couvre Pro plan + Storage |
| **Vercel** | Hébergement Next.js + CDN | UE (auto-routing) + US (fallback) | https://vercel.com/legal/dpa | 🟠 DPA standard | OK pour Pro tier. Activer "Data Residency: EU only" sur le projet. |
| **Stripe** | Paiements + Billing | UE + US (transferts CCT) | https://stripe.com/legal/dpa | 🟠 DPA standard | Auto-accepté lors de l'activation du compte Stripe |
| **Resend** | Envoi d'emails transactionnels | UE (Frankfurt + Ireland) | https://resend.com/legal/dpa | ❌ À demander | Contacter support@resend.com pour DPA bilatéral signé |
| **Sentry** | Monitoring d'erreurs | UE (Frankfurt) — `eu.sentry.io` | https://sentry.io/legal/dpa/ | 🟠 DPA standard | Vérifier le projet est bien sur la région UE (DSN `de.sentry.io`) |
| **Anthropic** | IA (Claude API) | US uniquement | https://www.anthropic.com/legal/commercial-terms | 🟠 DPA standard | API Terms inclut DPA. Vérifier l'opt-out training est actif (par défaut OUI pour API commerciale). Activer "Zero Data Retention" si éligible (Enterprise tier). |
| **GoCardless** (optionnel) | SEPA + Open Banking | UE | https://gocardless.com/legal/dpa/ | ❌ À signer si activé | Uniquement si le client active GoCardless |
| **Powens** (optionnel) | Open Banking | UE | https://www.powens.com/legal/ | ❌ À signer si activé | Uniquement si le client active Powens |
| **Qonto** (optionnel) | Open Banking | UE | (via API Stripe pour Stripe Connect) | 🟠 N/A | Pas de DPA séparé — fonctionne via API publique |
| **DocuSign** (ENTERPRISE) | Signature électronique | US (transferts CCT) | https://www.docusign.com/trust/agreements | ❌ À signer | Uniquement plan ENTERPRISE — DPA bilatéral nécessaire |
| **OpenAI** (optionnel fallback) | IA fallback | US | https://openai.com/policies/data-processing-addendum | ❌ À signer si activé | Uniquement si `OPENAI_API_KEY` configuré |
| **Google AI** (optionnel fallback) | IA fallback (Gemini) | US | https://cloud.google.com/terms/data-processing-addendum | ❌ À signer si activé | Uniquement si `GOOGLE_AI_API_KEY` configuré |
| **Mistral AI** (optionnel) | IA fallback | UE | https://mistral.ai/terms/ | ❌ À signer si activé | Uniquement si `MISTRAL_API_KEY` configuré |
| **INSEE** | Indices IRL/ILC/ILAT/ICC | UE (API publique) | https://api.insee.fr/catalogue/ | 🟠 N/A | API publique sans données personnelles |
| **PISTE / Chorus Pro** | Facturation B2G | UE (État français) | https://piste.gouv.fr/ | 🟠 N/A | Service public de l'État — pas de DPA bilatéral nécessaire |
| **PA B2B (SUPER PDP)** | Facturation B2B 2026 | UE | À définir | ❌ En cours | Contrat partenaire à signer avant production réelle |

## Actions prioritaires avant commercialisation publique

### Critique (P0) — bloquant go-live

- [ ] **Resend** : demander DPA bilatéral signé (le standard suffit si vraiment urgent, mais préférer signé)
- [ ] **Vercel** : activer "Data Residency: EU only" sur le projet `application-immobili-re`
- [ ] **Supabase** : vérifier que le projet `db.ziehiuvtskzategrhqgs` est sur région EU (Frankfurt)
- [ ] **Anthropic** : vérifier que `metadata.user_id` n'est pas envoyé (RGPD minimisation). Activer ZDR si éligible.

### Haut (P1) — à faire dans le mois post-launch

- [ ] **Sentry** : confirmer projet sur région EU (DSN `de.sentry.io` ✅ déjà OK)
- [ ] **Stripe** : confirmer compte Stripe en mode test/live propre, DPA standard accepté
- [ ] Archiver les DPA dans `dpa-archive/` (dossier privé) avec date de signature

### Conditionnel — à signer uniquement si activé pour un client

- [ ] **DocuSign** (plan ENTERPRISE)
- [ ] **GoCardless / Powens** (si Open Banking activé)
- [ ] **OpenAI / Google AI / Mistral** (si fallback IA activé)
- [ ] **PA B2B (SUPER PDP)** — contrat partenaire SC (Solution Compatible) à signer avant que l'e-invoicing puisse passer en prod réelle

## Process de mise à jour

1. À chaque ajout d'un nouveau sous-traitant : compléter ce registre + la page publique `/dpa`
2. Notifier les clients existants si changement substantiel (article 28.2 RGPD : préavis de 30 jours)
3. Réviser ce fichier tous les 12 mois ou à chaque renouvellement de contrat sous-traitant

## Lien public

La version client-facing (pour information des Responsables de traitement
qui sont nos clients) est publiée sur **https://app.mygestia.immo/dpa** —
[src/app/dpa/page.tsx](../src/app/dpa/page.tsx).
