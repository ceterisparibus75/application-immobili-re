# Prompt de commercialisation — MyGestia

> Copier-coller ce prompt dans une nouvelle session Claude Code pour continuer le travail de commercialisation.

---

## Contexte du projet

Je développe **MyGestia** (`src/app/page.tsx`), un SaaS B2B de gestion locative immobilière multi-tenant.
Stack : Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, Prisma 6 / Supabase, shadcn/ui.

La landing page (`src/components/landing/`) est structurée en sections :
Navbar → Hero (avec mockup dashboard) → SocialProof → ProblemSection → SolutionSection → FeaturesGrid → HighlightsBanner → HowItWorks → Pricing (toggle mensuel/annuel) → Solutions → Comparison (table vs Excel/concurrents) → CaseStudies → FAQ → FinalCTA → Footer.

Les plans commerciaux sont : **Essentiel** (19€/mois, 20 lots), **Professionnel** (79€/mois, 50 lots, recommandé), **Institutionnel** (199€/mois, illimité).

---

## Pages manquantes à créer

### 1. Page `/signup` — Inscription / démarrage essai
Créer `src/app/(auth)/signup/page.tsx` avec :
- Formulaire : Prénom, Nom, Email, Mot de passe, Nom de la société, Téléphone (optionnel)
- Checkbox RGPD obligatoire avec lien CGU et politique de confidentialité
- Affichage du plan choisi si `?plan=` et `?billing=` dans l'URL (transmettre à la création du compte)
- Lien "Déjà un compte ? Se connecter"
- Design cohérent avec la charte (couleurs brand-blue, brand-cyan)
- Appel à l'action : "Démarrer l'évaluation gratuite — 14 jours sans CB"
- Après souscription, rediriger vers `/proprietaire/setup` pour le premier paramétrage

### 2. Page `/contact` — Formulaire de demande
Créer `src/app/(public)/contact/page.tsx` avec :
- Formulaire : Prénom, Nom, Email, Société, Taille du portefeuille (select : < 10 lots / 10–50 lots / 50–200 lots / 200+ lots), Message, Plan d'intérêt (select : Essentiel / Professionnel / Institutionnel / Je ne sais pas)
- Envoi via Resend (EMAIL_FROM configuré) vers maxime.langet@gmail.com
- Message de confirmation visible après envoi
- SEO : title "Contactez MyGestia — Démonstration et questions"
- Page `/contact/merci` de confirmation post-envoi

### 3. Page `/securite` — Sécurité & Conformité
Créer `src/app/(public)/securite/page.tsx` avec :
- Section Chiffrement (AES-256-GCM, TLS 1.3, données bancaires isolées)
- Section RGPD (droit d'accès, portabilité, suppression, DPO)
- Section Hébergement (AWS Frankfurt / eu-west-1, SOC2, ISO 27001)
- Section Authentification (2FA TOTP, verrouillage compte, timeout 10 min)
- Section Audit (logs exhaustifs, 12 mois de rétention, traçabilité complète)

### 4. Page `/mentions-legales` et `/politique-confidentialite`
Créer les pages légales standard françaises pour un SaaS :
- Éditeur : MTG HOLDING, SIRET à compléter `[SIRET_A_COMPLETER]`
- Hébergeur : Vercel (CDN) + Supabase (données, Frankfurt)
- Politique de confidentialité conforme RGPD avec les traitements de MyGestia

---

## Améliorations landing page à implémenter

### A. Navbar mobile responsive
Dans `src/components/landing/navbar.tsx`, ajouter :
- Bouton hamburger (Menu icon de lucide-react) visible sur mobile (md:hidden)
- Drawer/sheet mobile avec tous les liens de navigation
- Utiliser le composant Sheet de shadcn/ui

### B. Améliorer le Footer
Dans `src/components/landing/footer.tsx`, s'assurer que le footer contient :
- Logo MyGestia
- 4 colonnes : Produit (Fonctionnalités, Tarifs, Sécurité, Comparaison), Solutions (Foncières & Family Offices, Cabinets de gestion, SCI familiales), Ressources (Documentation, Contact, Blog), Légal (Mentions légales, CGU, Politique de confidentialité, RGPD)
- Copyright "© 2025 MTG HOLDING — MyGestia"
- Badges de confiance : RGPD, hébergement UE, chiffrement AES-256

### C. Cookie banner RGPD
Créer `src/components/landing/cookie-banner.tsx` :
- Bandeau bas de page avec : "Nous utilisons des cookies analytiques pour améliorer l'expérience."
- Bouton "Accepter" et "Refuser"
- Persistence en localStorage (`cookie-consent: accepted|rejected`)
- Conditionnel : n'afficher que si pas encore de choix enregistré
- Pas de tracking tiers sans consentement explicite

### D. Section Témoignages (optionnel, si temps)
Remplacer ou compléter `case-studies.tsx` avec de vrais témoignages formatés :
- Avatar avec initiales colorées
- Note sur 5 étoiles (★★★★★)
- Citation courte et percutante
- Nom, titre, nombre de lots gérés

---

## SEO & Meta

Dans `src/app/page.tsx` :
- Vérifier que `openGraph.images` pointe vers une image OG 1200×630 (`/og-image.png`)
- Ajouter `twitter: { card: "summary_large_image" }`
- Ajouter `alternates: { canonical: "https://mygestia.immo" }`

Créer `src/app/sitemap.ts` pour générer automatiquement le sitemap XML avec toutes les pages publiques.

Créer `src/app/robots.ts` avec allow sur tout, sitemap pointant vers `https://mygestia.immo/sitemap.xml`.

---

## Email de bienvenue (onboarding)

Dans `src/lib/email.ts`, ajouter un template `sendWelcomeTrialEmail(email, firstName, planName)` :
- Objet : "Bienvenue sur MyGestia — votre essai commence maintenant"
- Corps : Introduction chaleureuse, les 3 premières actions à faire (ajouter un immeuble, créer un bail, connecter un compte bancaire), lien vers la documentation, contact support
- Design HTML responsive cohérent avec la charte bleue/cyan

---

## Règles impératives à respecter

- Toujours scoper les données par `societyId` (jamais de requête sans)
- Valider avec Zod avant toute écriture en base
- Env vars via `env.NOM_VAR` depuis `src/lib/env.ts`, pas `process.env` directement
- Composants shadcn/ui en priorité (`src/components/ui/`)
- Toasts pour feedback succès/erreur
- Mobile-first, responsive obligatoire
- Aucun tracking sans consentement RGPD explicite
