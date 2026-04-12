# Pistes d'amélioration

> **Date :** 12 avril 2026
> Organisation par priorité : Haute (avant commercialisation), Moyenne (trimestre suivant), Basse (6-12 mois)

---

## 1. Améliorations fonctionnelles

### Priorité haute - Avant commercialisation

#### A. Onboarding guidé et wizard de première utilisation

**Constat :** L'application a 143 pages. Un nouvel utilisateur risque d'être submergé.

**Ce qu'il faut faire :**
- Wizard en 5 étapes : Créer société > Ajouter immeuble > Créer lot > Ajouter locataire > Configurer bail
- Renforcer la checklist interactive existante avec des vidéos courtes (30 secondes)
- Ajouter un mode "démo" avec données fictives pré-remplies pour explorer sans risque
- Tooltips contextuels sur les fonctionnalités avancées (IA, rapprochement bancaire, FEC)

---

#### B. Application mobile (PWA puis native)

**Constat :** BailFacile et GérerSeul ont une app mobile. Les gestionnaires sont souvent sur le terrain (visites, états des lieux, rendez-vous locataires).

**Ce qu'il faut faire :**
- **Phase 1 :** PWA avec service worker - notifications push et mode offline en lecture
- **Phase 2 :** App React Native (Expo) avec les fonctionnalités clés :
  - Consultation du patrimoine et des baux
  - Alertes et notifications
  - Validation rapide des factures
  - Photos pour états des lieux
- Priorité : consultation et actions rapides (valider, relancer, noter)

---

#### C. Tableaux de bord personnalisables

**Constat :** Le dashboard est riche mais figé. Chaque gestionnaire a des priorités différentes.

**Ce qu'il faut faire :**
- Widgets drag-and-drop repositionnables
- KPIs configurables par l'utilisateur
- Vues filtrables : par propriétaire, par immeuble, par locataire
- Objectifs personnels (taux d'occupation cible, délai d'encaissement cible)

---

#### D. Recherche globale améliorée

**Constat :** La recherche Cmd+K existe mais reste limitée en fonctionnalités.

**Ce qu'il faut faire :**
- Recherche sémantique IA (comprendre l'intention, pas juste le texte)
- Filtres rapides : par type d'entité, par société, par période
- Résultats avec aperçu (mini-card avec les infos clés)
- Historique des recherches récentes

---

### Priorité moyenne - Trimestre suivant

#### E. Module syndic de copropriété

**Constat :** LOCKimmo couvre ce besoin et c'est un argument de vente majeur. MyGestia ne le propose pas.

**Ce qu'il faut faire :**
- Assemblées générales en ligne : convocations, PV, votes
- Budget prévisionnel de copropriété
- Répartition des charges par tantièmes
- Carnet d'entretien de l'immeuble
- **Impact :** Élargissement considérable de la cible client

---

#### F. Location saisonnière

**Constat :** Créneau non couvert mais en forte croissance (Airbnb, Booking).

**Ce qu'il faut faire :**
- Calendrier de disponibilité
- Tarification dynamique
- Connexion aux OTA (Airbnb, Booking, Abritel)
- Contrats saisonniers conformes à la réglementation
- État des lieux simplifié (photo + checklist)

---

#### G. CRM / Pipeline de candidatures locataires

**Constat :** Aucune gestion des prospects locataires actuellement.

**Ce qu'il faut faire :**
- Pipeline visuel : candidature reçue > visite programmée > dossier déposé > sélection > bail signé
- Scoring automatique des dossiers (revenus, garanties, historique)
- Communication groupée avec les candidats
- Lien avec les annonces publiées sur les plateformes

---

#### H. Automatisation avancée (workflows visuels)

**Constat :** Les automatisations actuelles sont des cron jobs (horaires fixes), pas déclenchées par événement.

**Ce qu'il faut faire :**
- Éditeur de workflows visuels : "Quand facture impayée > 30 jours → envoyer relance niveau 2"
- Triggers personnalisables : bail arrive à échéance, assurance expirée, diagnostic périmé
- Actions chaînables : email + SMS + notification in-app + changement de statut
- Templates de workflows pré-configurés pour les cas courants

---

### Priorité basse - Roadmap 6 à 12 mois

#### I. API publique documentée

- Documentation OpenAPI/Swagger accessible aux clients Enterprise
- Webhooks configurables par le client
- SDK JavaScript et Python
- Marketplace d'intégrations (expert-comptable, courtier, notaire)

#### J. Multi-langue

- Framework i18n (next-intl)
- Anglais en priorité (DOM-TOM anglophones, investisseurs internationaux)
- Espagnol et portugais pour l'expansion outre-mer

#### K. IA générative avancée

- Chatbot interne "Demandez à MyGestia" pour naviguer l'application
- Génération automatique de courriers juridiques adaptés au contexte du bail
- Prédiction des impayés basée sur l'historique de paiement
- Optimisation de loyer en temps réel basée sur les données de marché

---

## 2. Améliorations design et interface

### Priorité haute

#### A. Refonte de la landing page

**Constat :** 12 834 lignes dans un seul fichier. Difficile à maintenir, impact probable sur les performances (PageSpeed).

**Ce qu'il faut faire :**
- Découper en composants réutilisables : Hero, Features, Pricing, Témoignages, FAQ, CTA
- Ajouter des animations au scroll (framer-motion ou Intersection Observer)
- Vidéo de démonstration en hero (30s, autoplay muet)
- Témoignages clients avec photos et métriques chiffrées
- Bandeau de logos clients / partenaires
- Chatbot de qualification (Intercom ou custom)
- **Objectif :** Score PageSpeed > 90

---

#### B. Micro-interactions et feedback visuel

**Ce qu'il faut faire :**
- Transitions fluides entre les pages (pas de flash blanc)
- Skeleton loaders plus détaillés (formes correspondant au contenu réel)
- Animation de succès sur les jalons importants (premier bail créé, première facture payée)
- Indicateurs de progression sur les processus multi-étapes
- État de sauvegarde visible : "Enregistré" avec horodatage

---

#### C. Système de notification enrichi

**Constat :** Les notifications existent mais restent basiques.

**Ce qu'il faut faire :**
- Notifications push navigateur (avec consentement)
- Catégories visuelles : urgence (rouge), information (bleu), action requise (orange)
- Résumé quotidien par email (digest configurable)
- Centre de préférences de notification granulaire

---

### Priorité moyenne

#### D. Modes d'affichage des tableaux

- Toggle densité : confortable / compact / ultra-compact
- Colonnes masquables et réorganisables par l'utilisateur
- Sauvegarde des préférences de vue par utilisateur
- Vues alternatives : tableau classique, cartes, kanban (par exemple : baux par statut)

#### E. Portail locataire amélioré

- Design distinct du back-office avec branding propriétaire personnalisable
- Historique des échanges en timeline visuelle
- Upload de documents avec OCR automatique
- Notifications SMS en complément des emails

#### F. Accessibilité WCAG 2.1 niveau AA

- Audit complet avec axe-core ou Lighthouse
- Navigation 100% clavier
- Contrastes vérifiés sur tous les textes
- Labels ARIA sur tous les composants interactifs
- Support lecteur d'écran (VoiceOver, NVDA)

---

## 3. Améliorations ergonomie et UX

### Priorité haute

#### A. Raccourcis clavier globaux

- `Cmd+K` : Recherche (existe déjà)
- `Cmd+N` : Nouveau (contextuel selon la page : nouveau bail, nouvelle facture, etc.)
- `Cmd+S` : Sauvegarder le formulaire en cours
- `Cmd+E` : Exporter la vue courante
- `?` : Afficher l'aide des raccourcis
- Palette de commandes type VS Code pour les utilisateurs avancés

---

#### B. Actions en masse (bulk actions)

**Constat :** La génération batch existe pour les factures mais pas pour les autres entités.

**Ce qu'il faut faire :**
- Checkbox de sélection multiple dans toutes les tables
- Actions groupées : supprimer, exporter CSV, envoyer email, changer statut
- Validation en lot des révisions de loyer
- Relance en masse de tous les impayés sélectionnés

---

#### C. Navigation contextuelle intelligente

**Constat :** Le breadcrumb est auto-généré par le pathname mais affiche des IDs techniques sur les routes profondes.

**Ce qu'il faut faire :**
- Breadcrumb avec les vrais noms d'entités (nom du locataire, adresse de l'immeuble)
- Navigation latérale contextuelle : sur une page bail, liens rapides vers le locataire, le lot, les factures
- Bouton "Retour" intelligent (dernière page visitée, pas juste le parent dans l'arborescence)
- Onglets persistants sur les pages de détail (infos, documents, historique, factures)

---

### Priorité moyenne

#### D. Formulaires intelligents

- Auto-save brouillon toutes les 30 secondes
- Suggestions IA sur les champs (montant de loyer basé sur le marché, indices appropriés)
- Validation en temps réel (pas seulement à la soumission)
- Pré-remplissage intelligent basé sur l'historique
- Mode multi-étapes pour les formulaires complexes (création de bail, ajout de locataire)

#### E. Tableau de bord d'activité d'équipe

- Fil d'activité type "feed" : qui a fait quoi, quand
- Assignation de tâches entre gestionnaires
- Commentaires internes sur les entités (bail, locataire, facture)
- Mentions @utilisateur dans les commentaires
- Vue kanban des tâches en cours

#### F. Expérience de première connexion

- Écran de bienvenue personnalisé avec le nom de l'utilisateur
- Question : "Quel est votre profil ?" (SCI familiale, cabinet pro, foncière)
- Configuration initiale adaptée au profil choisi
- Données de démonstration chargées automatiquement
- Parcours guidé avec spotlight sur les fonctionnalités clés
