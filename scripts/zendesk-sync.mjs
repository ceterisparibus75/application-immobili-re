#!/usr/bin/env node

/**
 * zendesk-sync.mjs
 *
 * Synchronise le contenu du Centre d'aide MyGestia vers Zendesk Help Center.
 *
 * Usage :
 *   ZENDESK_SUBDOMAIN=mygestia ZENDESK_EMAIL=admin@mygestia.immo ZENDESK_API_TOKEN=xxx node scripts/zendesk-sync.mjs
 *
 * Variables d'environnement (ou arguments CLI) :
 *   ZENDESK_SUBDOMAIN  - sous-domaine Zendesk (ex: mygestia)
 *   ZENDESK_EMAIL      - email de l'agent Zendesk
 *   ZENDESK_API_TOKEN   - API token Zendesk
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN || process.argv[2];
const EMAIL = process.env.ZENDESK_EMAIL || process.argv[3];
const API_TOKEN = process.env.ZENDESK_API_TOKEN || process.argv[4];
const LOCALE = "fr";

if (!SUBDOMAIN || !EMAIL || !API_TOKEN) {
  console.error(
    "Erreur : variables manquantes.\n\n" +
      "Usage :\n" +
      "  ZENDESK_SUBDOMAIN=xxx ZENDESK_EMAIL=xxx ZENDESK_API_TOKEN=xxx node scripts/zendesk-sync.mjs\n\n" +
      "  ou : node scripts/zendesk-sync.mjs <subdomain> <email> <api_token>\n"
  );
  process.exit(1);
}

const BASE_URL = `https://${SUBDOMAIN}.zendesk.com/api/v2/help_center`;
const AUTH = Buffer.from(`${EMAIL}/token:${API_TOKEN}`).toString("base64");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function zendeskRequest(method, path, body = null) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Basic ${AUTH}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  // Rate limiting : attendre et réessayer
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
    console.log(`  ⏳ Rate limited — attente ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return zendeskRequest(method, path, body);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zendesk API ${method} ${path} → ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return null;
}

// ─── Idempotency helpers ─────────────────────────────────────────────────────

async function findCategoryByName(name) {
  try {
    const data = await zendeskRequest("GET", `/categories.json`);
    return (data.categories || []).find((c) => c.name === name) || null;
  } catch {
    return null;
  }
}

async function findSectionByName(categoryId, name) {
  try {
    const data = await zendeskRequest(
      "GET",
      `/categories/${categoryId}/sections.json`
    );
    return (data.sections || []).find((s) => s.name === name) || null;
  } catch {
    return null;
  }
}

async function findArticleByTitle(sectionId, title) {
  try {
    const data = await zendeskRequest(
      "GET",
      `/sections/${sectionId}/articles.json`
    );
    return (data.articles || []).find((a) => a.title === title) || null;
  } catch {
    return null;
  }
}

// ─── Create or update helpers ────────────────────────────────────────────────

async function ensureCategory(name, description) {
  const existing = await findCategoryByName(name);
  if (existing) {
    console.log(`  ↳ Catégorie existante : "${name}" (id: ${existing.id})`);
    return existing;
  }
  const data = await zendeskRequest("POST", `/categories.json`, {
    category: { name, description, locale: LOCALE, position: 0 },
  });
  console.log(`  ✓ Catégorie créée : "${name}" (id: ${data.category.id})`);
  await sleep(500);
  return data.category;
}

async function ensureSection(categoryId, name, description, position) {
  const existing = await findSectionByName(categoryId, name);
  if (existing) {
    console.log(`  ↳ Section existante : "${name}" (id: ${existing.id})`);
    return existing;
  }
  const data = await zendeskRequest(
    "POST",
    `/categories/${categoryId}/sections.json`,
    {
      section: { name, description, locale: LOCALE, position },
    }
  );
  console.log(`  ✓ Section créée : "${name}" (id: ${data.section.id})`);
  await sleep(500);
  return data.section;
}

async function getDefaultPermissionGroupId() {
  try {
    const data = await zendeskRequest("GET", `https://${SUBDOMAIN}.zendesk.com/api/v2/guide/permission_groups.json`);
    const groups = data.permission_groups || [];
    if (groups.length > 0) return groups[0].id;
  } catch { /* ignore */ }
  return null;
}

let _permissionGroupId = null;

async function ensureArticle(sectionId, title, body, position) {
  // Charger le permission_group_id une seule fois
  if (!_permissionGroupId) {
    _permissionGroupId = await getDefaultPermissionGroupId();
  }

  const existing = await findArticleByTitle(sectionId, title);
  if (existing) {
    // Met à jour le contenu si l'article existe déjà
    await zendeskRequest("PUT", `/articles/${existing.id}.json`, {
      article: { body, position },
    });
    console.log(`  ↳ Article mis à jour : "${title}" (id: ${existing.id})`);
    await sleep(500);
    return existing;
  }
  const articleData = {
    title,
    body,
    locale: LOCALE,
    position,
    draft: false,
    promoted: false,
  };
  if (_permissionGroupId) {
    articleData.permission_group_id = _permissionGroupId;
    articleData.user_segment_id = null;
  }
  const data = await zendeskRequest(
    "POST",
    `/sections/${sectionId}/articles.json`,
    { article: articleData }
  );
  console.log(`  ✓ Article créé : "${title}" (id: ${data.article.id})`);
  await sleep(500);
  return data.article;
}

// ─── HTML Helpers ────────────────────────────────────────────────────────────

function infoBox(type, content) {
  const colors = {
    info: { bg: "#EFF6FF", border: "#3B82F6", icon: "ℹ️", label: "Information" },
    tip: { bg: "#F0FDF4", border: "#22C55E", icon: "💡", label: "Astuce" },
    warning: { bg: "#FFFBEB", border: "#F59E0B", icon: "⚠️", label: "Attention" },
  };
  const c = colors[type] || colors.info;
  return `<div style="background:${c.bg};border-left:4px solid ${c.border};padding:12px 16px;border-radius:4px;margin:16px 0;">
<strong>${c.icon} ${c.label}</strong><br/>${content}
</div>`;
}

function faqItem(question, answer) {
  return `<div style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:12px;">
<p style="font-weight:600;margin:0 0 6px 0;">${question}</p>
<p style="margin:0;color:#6B7280;">${answer}</p>
</div>`;
}

function stepBlock(number, title, content) {
  return `<div style="display:flex;gap:12px;margin:12px 0;">
<div style="background:#3B82F6;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">${number}</div>
<div><p style="font-weight:600;margin:0 0 4px 0;">${title}</p><p style="margin:0;color:#6B7280;">${content}</p></div>
</div>`;
}

// ─── Contenu des articles ────────────────────────────────────────────────────

const CATEGORY_NAME = "MyGestia - Centre d'aide";
const CATEGORY_DESC =
  "Guides détaillés et réponses aux questions fréquentes pour la gestion de votre patrimoine immobilier avec MyGestia.";

const SECTIONS = [
  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 1 : Démarrage rapide
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Démarrage rapide",
    description:
      "Créez votre société, ajoutez vos immeubles et commencez à gérer en quelques minutes.",
    articles: [
      {
        title: "Guide de démarrage rapide",
        body: `
<h2>Essai gratuit de 14 jours</h2>
<p>À votre première connexion, vous bénéficiez automatiquement d'un <strong>essai gratuit de 14 jours</strong>, sans carte bancaire requise. Pendant cette période, toutes les fonctionnalités sont accessibles sans restriction (équivalent du plan Enterprise).</p>
<p>Une bannière en haut de l'application vous indique le nombre de jours restants. À la fin de l'essai, votre compte passe en <strong>lecture seule</strong> : vous pouvez toujours consulter vos données, mais les créations et modifications sont désactivées.</p>
${infoBox("tip", "Vous pouvez souscrire un abonnement à tout moment depuis <strong>Mon compte &gt; Abonnement</strong>. Vos données sont conservées intégralement lors du passage à un plan payant.")}

<h2>Créer votre première société</h2>
<p>La société est l'entité centrale de MyGestia. Tous vos immeubles, locataires, factures et documents sont rattachés à une société. Vous pouvez gérer plusieurs sociétés (SCI, SARL, personne physique, etc.).</p>
${stepBlock(1, "Accédez à la création", "Cliquez sur le bouton <strong>Nouvelle société</strong> depuis le menu principal ou depuis la page Sociétés.")}
${stepBlock(2, "Renseignez les informations", "Remplissez le formulaire : raison sociale, forme juridique (SCI, SARL, SAS, personne physique...), numéro SIRET, adresse du siège social. Les champs obligatoires sont marqués d'un astérisque.")}
${stepBlock(3, "Ajoutez votre logo (optionnel)", "Uploadez le logo de votre société. Il apparaîtra sur vos factures, quittances et courriers.")}
${stepBlock(4, "Configurez votre compte bancaire", "Renseignez l'IBAN et le BIC de votre compte principal. Ces informations sont <strong>chiffrées en AES-256-GCM</strong> et apparaîtront sur vos factures et mandats SEPA.")}

<h2>Ajouter votre premier immeuble</h2>
<p>Un immeuble représente un bâtiment physique dans votre patrimoine. Il contient un ou plusieurs lots (appartements, locaux commerciaux, parkings, etc.).</p>
${stepBlock(1, "Menu Patrimoine > Nouvel immeuble", "Depuis le menu latéral, cliquez sur <strong>Patrimoine</strong> puis sur le bouton <strong>Nouvel immeuble</strong>.")}
${stepBlock(2, "Informations de l'immeuble", "Renseignez le nom, l'adresse complète, le type (habitation, bureau, commerce, mixte), l'année de construction et la surface totale.")}
${stepBlock(3, "Ajoutez des lots", "Depuis la fiche immeuble, cliquez sur <strong>Ajouter un lot</strong>. Renseignez le numéro, le type, l'étage, la surface et le loyer de référence.")}
${infoBox("info", "Vous pouvez également importer vos données depuis un fichier Excel ou CSV via le module Import (<strong>Administration &gt; Import</strong>).")}

<h2>Enregistrer un locataire et créer un bail</h2>
${stepBlock(1, "Créez le locataire", "Allez dans <strong>Locataires &gt; Nouveau locataire</strong>. Renseignez son identité (nom, prénom ou raison sociale pour une personne morale), ses coordonnées (email, téléphone) et son adresse.")}
${stepBlock(2, "Créez le bail", "Allez dans <strong>Baux &gt; Nouveau bail</strong>. Sélectionnez le locataire et le lot concerné, puis renseignez les conditions : type de bail (habitation, meublé, commercial 3/6/9...), loyer mensuel, charges, dépôt de garantie, dates de début et fin.")}
${stepBlock(3, "Configurez la révision de loyer", "Si le bail est indexé, sélectionnez l'indice (IRL, ILC, ILAT), le trimestre de référence et la fréquence de révision. Les révisions seront calculées automatiquement.")}
${stepBlock(4, "Première facture automatique", "La facturation est automatique : chaque jour à 7h, un brouillon de facture est généré pour tous les baux actifs. Validez-le et envoyez-le par email en un clic.")}

<h2>Checklist de démarrage</h2>
<ol>
<li>Créer votre société (raison sociale, forme juridique, SIRET)</li>
<li>Renseigner votre IBAN/BIC</li>
<li>Ajouter votre premier immeuble</li>
<li>Créer les lots de cet immeuble</li>
<li>Enregistrer vos locataires</li>
<li>Créer les baux actifs</li>
<li>Vérifier la génération automatique des factures</li>
<li>Inviter vos collaborateurs (si applicable)</li>
</ol>

<h2>Questions fréquentes sur le démarrage</h2>
${faqItem("Combien de temps dure l'essai gratuit ?", "L'essai gratuit dure <strong>14 jours</strong>, sans carte bancaire requise. Pendant cette période, toutes les fonctionnalités sont accessibles. Une fois l'essai terminé, votre compte passe en lecture seule jusqu'à la souscription d'un abonnement.")}
${faqItem("Puis-je importer mes données depuis un autre logiciel ?", "Oui, rendez-vous dans <strong>Administration &gt; Import</strong>. Vous pouvez importer vos données au format CSV ou Excel. Un assistant de mappage vous guide pour faire correspondre vos colonnes aux champs de l'application.")}
${faqItem("Faut-il créer la société avant les immeubles ?", "Oui, la société est l'entité centrale de l'application. Tous les immeubles, locataires, baux et factures sont rattachés à une société. Vous devez donc créer votre société en premier.")}
${faqItem("Puis-je modifier les informations de ma société plus tard ?", "Oui, vous pouvez modifier les informations de votre société à tout moment depuis la fiche société en cliquant sur le bouton Modifier.")}
${faqItem("Comment ajouter mon logo sur les factures ?", "Depuis la fiche de votre société (menu <strong>Sociétés &gt; Modifier</strong>), rendez-vous dans la section Logo et uploadez votre image. Le logo apparaîtra automatiquement sur vos factures, quittances et courriers.")}
${faqItem("Est-ce que les factures sont générées automatiquement ?", "Oui, chaque jour à 7h, l'application génère automatiquement des brouillons de factures pour tous les baux actifs. Il vous suffit de les vérifier et de les valider avant envoi.")}
${faqItem("Comment inviter un collaborateur ?", "Rendez-vous dans <strong>Mon compte &gt; Utilisateurs</strong>, puis cliquez sur Créer. Renseignez l'adresse email et le rôle souhaité. Un email d'invitation sera envoyé automatiquement.")}
${faqItem("Que se passe-t-il si je dépasse les limites de mon plan ?", "Une alerte s'affiche pour vous prévenir. Vous ne pourrez pas créer de nouveaux éléments au-delà des limites. <strong>Starter</strong> : 20 lots, 1 société, 2 utilisateurs. <strong>Pro</strong> : 50 lots, 3 sociétés, 5 utilisateurs. <strong>Enterprise</strong> : illimité.")}
${faqItem("Comment passer d'un plan gratuit à un plan payant ?", "Rendez-vous dans <strong>Mon compte &gt; Abonnement</strong>, choisissez le plan qui vous convient et procédez au paiement par carte bancaire via Stripe. Vos données sont conservées intégralement.")}
${faqItem("Puis-je tester toutes les fonctionnalités pendant l'essai ?", "Oui, l'essai gratuit donne accès à toutes les fonctionnalités du plan Enterprise, sans aucune restriction.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 2 : Utilisateurs et droits d'accès
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Utilisateurs et droits d'accès",
    description:
      "Gérez les utilisateurs, les rôles et les permissions par société et par module.",
    articles: [
      {
        title: "Gestion des utilisateurs et permissions",
        body: `
<h2>Les 5 rôles hiérarchiques</h2>
<p>Chaque utilisateur se voit attribuer un rôle par société. Les rôles sont hiérarchiques : un rôle supérieur inclut toutes les permissions des rôles inférieurs.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;font-weight:600;">Rôle</th>
<th style="text-align:center;padding:10px;border:1px solid #E5E7EB;font-weight:600;">Niveau</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;font-weight:600;">Description</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Super Admin</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">50</td><td style="padding:10px;border:1px solid #E5E7EB;">Accès total à toutes les sociétés. Peut créer et supprimer des sociétés, gérer tous les utilisateurs et accéder à toutes les données sans restriction.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Admin Société</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">40</td><td style="padding:10px;border:1px solid #E5E7EB;">Gestion complète d'une société. Peut inviter des utilisateurs, modifier les paramètres de la société, et accéder à tous les modules.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Gestionnaire</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">30</td><td style="padding:10px;border:1px solid #E5E7EB;">Gestion quotidienne du patrimoine. Peut créer et modifier les immeubles, lots, baux, locataires et factures. Ne peut pas gérer les utilisateurs.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Comptable</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">20</td><td style="padding:10px;border:1px solid #E5E7EB;">Lecture sur tous les modules + écriture sur la facturation, la comptabilité, la banque et les relances. Idéal pour un comptable externe.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Lecture seule</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">10</td><td style="padding:10px;border:1px solid #E5E7EB;">Consultation uniquement. Peut voir toutes les données mais ne peut rien créer, modifier ou supprimer.</td></tr>
</tbody>
</table>

<h2>Permissions par module</h2>
<p>Les droits sont organisés en 3 niveaux par module : <strong>Lecture</strong> (L) pour consulter les données, <strong>Écriture</strong> (E) pour créer et modifier, et <strong>Suppression</strong> (S) pour supprimer des éléments.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:0.9em;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:8px;border:1px solid #E5E7EB;font-weight:600;">Module</th>
<th style="text-align:center;padding:8px;border:1px solid #E5E7EB;font-weight:600;">Super Admin</th>
<th style="text-align:center;padding:8px;border:1px solid #E5E7EB;font-weight:600;">Admin</th>
<th style="text-align:center;padding:8px;border:1px solid #E5E7EB;font-weight:600;">Gestionnaire</th>
<th style="text-align:center;padding:8px;border:1px solid #E5E7EB;font-weight:600;">Comptable</th>
<th style="text-align:center;padding:8px;border:1px solid #E5E7EB;font-weight:600;">Lecture</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Patrimoine</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Baux</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Locataires</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Facturation</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Comptabilité</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Banque</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Relances</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Charges</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Documents</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Dashboard</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">L</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Utilisateurs</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">&mdash;</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">&mdash;</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">&mdash;</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">Paramètres</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LES</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">LE</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">&mdash;</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">&mdash;</td><td style="text-align:center;padding:8px;border:1px solid #E5E7EB;">&mdash;</td></tr>
</tbody>
</table>
<p style="font-size:0.85em;color:#9CA3AF;">L = Lecture, E = Écriture, S = Suppression. Exemple : &laquo; LE &raquo; signifie Lecture + Écriture.</p>
${infoBox("info", "Un administrateur peut personnaliser les droits module par module pour chaque utilisateur. Par exemple, donner l'accès écriture en facturation à un utilisateur en lecture seule.")}

<h2>Ajouter un utilisateur</h2>
${stepBlock(1, "Accédez à la gestion des utilisateurs", "Depuis le menu déroulant utilisateur en haut à droite, cliquez sur <strong>Utilisateurs</strong>, ou allez dans <strong>Administration &gt; Utilisateurs</strong>.")}
${stepBlock(2, "Créez le nouvel utilisateur", "Cliquez sur <strong>Créer un utilisateur</strong>. Renseignez l'email, le nom et le prénom. Un mot de passe temporaire sera envoyé automatiquement par email.")}
${stepBlock(3, "Attribuez un rôle", "Sélectionnez le rôle de l'utilisateur pour la société courante. Vous pouvez aussi l'ajouter à d'autres sociétés avec des rôles différents.")}
${infoBox("warning", "Le nombre d'utilisateurs est limité selon votre plan d'abonnement. Vérifiez votre quota dans <strong>Mon compte &gt; Abonnement</strong>.")}

<h2>Accès aux propriétaires</h2>
<p>L'accès aux propriétaires est <strong>automatique et indirect</strong>. Un utilisateur voit le propriétaire de chaque société dont il est membre, sans avoir besoin d'un accès direct. Seuls les utilisateurs Admin Société ou Super Admin peuvent modifier les informations d'un propriétaire.</p>

<h2>Gestion multi-société</h2>
<p>Un même utilisateur peut être membre de plusieurs sociétés avec des rôles différents. Par exemple, Admin sur la SCI A et Comptable sur la SARL B. Le sélecteur de société dans la barre de navigation permet de basculer d'une société à l'autre.</p>

<h2>Questions fréquentes</h2>
${faqItem("Un utilisateur peut-il avoir des rôles différents selon la société ?", "Oui, le rôle est attribué par société. Un même utilisateur peut par exemple être Admin Société sur la SCI A et Comptable sur la SARL B.")}
${faqItem("Comment réinitialiser le mot de passe d'un utilisateur ?", "L'utilisateur doit cliquer sur &laquo; Mot de passe oublié &raquo; sur la page de connexion. Il recevra un email avec un lien pour définir un nouveau mot de passe.")}
${faqItem("Combien d'utilisateurs puis-je créer ?", "Cela dépend de votre plan : <strong>Starter</strong> = 2 utilisateurs, <strong>Pro</strong> = 5, <strong>Enterprise</strong> = illimité. Consultez Mon compte &gt; Abonnement.")}
${faqItem("Comment supprimer un utilisateur ?", "Administration &gt; Utilisateurs, cliquez sur l'utilisateur puis sur Supprimer. Ses données (logs d'audit, actions passées) restent dans le système pour la traçabilité.")}
${faqItem("Un comptable externe peut-il accéder à l'application ?", "Oui, créez un utilisateur avec le rôle <strong>Comptable</strong>. Il aura accès en lecture sur tous les modules et en écriture sur la facturation, la comptabilité, la banque et les relances.")}
${faqItem("Comment personnaliser les droits d'un utilisateur par module ?", "Depuis la fiche de l'utilisateur, rendez-vous dans la section Permissions. Vous pouvez cocher les droits par module : Lecture, Écriture et Suppression, indépendamment du rôle global.")}
${faqItem("Que voit un utilisateur en lecture seule ?", "Il peut consulter toutes les données de la société (immeubles, locataires, baux, factures, etc.) mais ne peut rien créer, modifier ou supprimer.")}
${faqItem("Le propriétaire de la société a-t-il toujours tous les droits ?", "Oui, le créateur de la société (owner) a automatiquement un accès complet à toutes les fonctionnalités, quels que soient les paramètres configurés.")}
${faqItem("Comment savoir qui a fait quoi dans l'application ?", "Rendez-vous dans <strong>Administration &gt; Audit</strong>. Le journal d'activité affiche chaque action avec la date, l'utilisateur, le type d'action et l'entité modifiée.")}
${faqItem("Puis-je désactiver temporairement un utilisateur sans le supprimer ?", "Pour le moment, il n'existe pas de fonction de désactivation. Vous pouvez cependant changer son rôle en Lecture seule pour limiter ses actions en attendant.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 3 : Gestion du patrimoine
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Gestion du patrimoine",
    description:
      "Immeubles, lots, diagnostics, maintenances et états des lieux.",
    articles: [
      {
        title: "Patrimoine immobilier : immeubles, lots et diagnostics",
        body: `
<h2>Vue d'ensemble du patrimoine</h2>
<p>La page <strong>Patrimoine</strong> affiche la liste de tous vos immeubles avec des indicateurs clés : nombre de lots, taux d'occupation, revenus annuels et valeur estimée du patrimoine.</p>
<p>Chaque immeuble est présenté sous forme de carte avec :</p>
<ul>
<li>Un <strong>badge de type</strong> (habitation, bureau, commerce, mixte)</li>
<li>Le nombre de lots occupés sur le total</li>
<li>Le revenu locatif annuel</li>
<li>Le <strong>rendement brut</strong> : vert si &ge; 5%, orange si 3-5%, rouge si &lt; 3%</li>
</ul>
${infoBox("tip", "Un indicateur d'alerte s'affiche si un bail expire dans les 90 prochains jours sur l'un de vos immeubles.")}

<h2>Fiche immeuble detaillée</h2>
<p>En cliquant sur un immeuble, vous accédez à sa fiche complète :</p>
<ul>
<li><strong>Informations générales</strong> : nom, adresse complète, type de bien, année de construction, surface totale, nombre de lots</li>
<li><strong>Valorisation</strong> : valeur de marché, valeur nette comptable, bouton Évaluation IA</li>
<li><strong>Liste des lots</strong> : tableau de tous les lots avec numéro, type, étage, surface, statut et loyer actuel</li>
<li><strong>Diagnostics</strong> : liste des diagnostics obligatoires avec code couleur (valide/expirant/expiré)</li>
<li><strong>Interventions techniques</strong> : historique des maintenances avec titre, date, coût et statut</li>
<li><strong>Documents</strong> : tous les documents rattachés, classés par catégorie</li>
</ul>

<h2>Gestion des lots</h2>
<p>Un lot représente une unité locative au sein d'un immeuble : appartement, local commercial, parking, cave, etc.</p>

<h3>10 types de lots disponibles</h3>
<p>Habitation, meublé, commercial, bureau, parking, cave, entrepôt, terrain, mixte et autre. Le type influence les options de bail disponibles.</p>

<h3>4 statuts d'un lot</h3>
<ul>
<li><strong>Vacant</strong> : disponible à la location</li>
<li><strong>Occupé</strong> : bail actif en cours</li>
<li><strong>En travaux</strong> : indisponible temporairement</li>
<li><strong>Réservé</strong> : bail en préparation</li>
</ul>
${infoBox("info", "Un lot ne peut avoir qu'un seul bail actif à la fois. Pour changer de locataire, il faut d'abord résilier le bail en cours, puis en créer un nouveau.")}

<h2>Diagnostics obligatoires</h2>
<p>MyGestia vous aide à suivre les diagnostics obligatoires de vos immeubles et à anticiper les renouvellements.</p>
<p><strong>Types de diagnostics gérés :</strong> DPE (Diagnostic de Performance Énergétique), amiante, plomb, gaz, électricité, termites, ERP (État des Risques et Pollutions), loi Carrez, assainissement et autres.</p>
<p>Pour chaque diagnostic, vous renseignez la date de réalisation, la date d'expiration et le résultat. L'application calcule automatiquement le statut :</p>
<ul>
<li><strong style="color:#16A34A;">Valide (vert)</strong> : le diagnostic est en cours de validité</li>
<li><strong style="color:#D97706;">Expire bientôt (orange)</strong> : expiration dans les 90 prochains jours</li>
<li><strong style="color:#DC2626;">Expiré (rouge)</strong> : le diagnostic doit être renouvelé</li>
</ul>
${infoBox("warning", "Des diagnostics expirés peuvent entraîner des sanctions légales. L'application vous alerte automatiquement avant l'expiration.")}

<h2>Maintenances et interventions</h2>
<p>Suivez toutes les interventions techniques : plomberie, électricité, toiture, ravalement, etc.</p>
${stepBlock(1, "Planifier une intervention", "Depuis la fiche immeuble, section <strong>Interventions</strong>, cliquez sur <strong>Nouvelle intervention</strong>.")}
${stepBlock(2, "Suivre l'avancement", "Mettez à jour le statut : planifiée &rarr; en cours &rarr; terminée &rarr; annulée. Ajoutez le coût réel une fois terminée.")}

<h2>États des lieux</h2>
<p>Les états des lieux d'entrée et de sortie sont accessibles depuis la fiche bail. Ils documentent l'état de chaque pièce et équipement du lot. Vous pouvez joindre des photos et le document PDF signé.</p>

<h2>Questions fréquentes</h2>
${faqItem("Comment modifier les informations d'un immeuble ?", "Rendez-vous sur la fiche de l'immeuble, puis cliquez sur <strong>Modifier</strong> en haut de page.")}
${faqItem("Puis-je supprimer un immeuble ?", "Uniquement si aucun lot de cet immeuble n'a de bail actif. Sinon, résiliez d'abord tous les baux en cours.")}
${faqItem("Comment changer le statut d'un lot ?", "Le statut est mis à jour automatiquement en fonction des baux (Occupé/Vacant). Vous pouvez forcer manuellement le statut depuis la fiche lot (ex: En travaux).")}
${faqItem("Un lot peut-il avoir plusieurs baux en même temps ?", "Non, un seul bail actif est autorisé par lot.")}
${faqItem("Qu'est-ce que l'évaluation IA d'un immeuble ?", "Une estimation automatique de la valeur basée sur l'adresse, la surface, le type, le taux d'occupation et les données de marché (transactions DVF). Accessible via le bouton <strong>Évaluation IA</strong>.")}
${faqItem("Quand suis-je alerté pour un diagnostic expirant ?", "90 jours avant l'expiration (badge orange). Un badge rouge s'affiche une fois expiré.")}
${faqItem("Comment planifier une maintenance ?", "Fiche immeuble &gt; Interventions &gt; Nouvelle intervention. Renseignez le titre, la description, la date et le coût estimé.")}
${faqItem("Comment importer plusieurs lots en même temps ?", "Administration &gt; Import, uploadez un fichier CSV ou Excel avec les colonnes : numéro, type, étage, surface et loyer.")}
${faqItem("Comment voir tous les lots vacants ?", "Le taux d'occupation est affiché pour chaque immeuble. Ouvrez la fiche d'un immeuble et filtrez les lots par statut Vacant.")}
${faqItem("Comment ajouter des photos à un état des lieux ?", "Depuis la fiche bail, section États des lieux. Lors de la création, vous pouvez joindre des photos pour chaque pièce inspectée.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 4 : Gestion locative
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Gestion locative",
    description:
      "Baux, locataires, révisions de loyer, charges et contacts.",
    articles: [
      {
        title: "Baux, locataires et révisions de loyer",
        body: `
<h2>Gestion des baux</h2>
<p>La page <strong>Baux</strong> affiche deux sections : les baux actifs (en cours) et les baux terminés (résiliés, expirés). Le tableau récapitulatif présente pour chaque bail : le nom du locataire, le loyer mensuel HT, la fréquence de paiement, le type et le statut.</p>

<h3>7 types de baux disponibles</h3>
<ul>
<li><strong>Habitation</strong> : bail d'habitation classique (loi du 6 juillet 1989)</li>
<li><strong>Meublé</strong> : bail de location meublée</li>
<li><strong>Commercial 3/6/9</strong> : bail commercial avec renouvellement triennal</li>
<li><strong>Commercial dérogatoire</strong> : bail de courte durée (max. 3 ans)</li>
<li><strong>Professionnel</strong> : bail pour professions libérales</li>
<li><strong>Mixte</strong> : bail combinant habitation et activité professionnelle</li>
<li><strong>Saisonnier</strong> : bail de courte durée pour location saisonnière</li>
</ul>

<h3>5 statuts d'un bail</h3>
<ul>
<li><strong style="color:#16A34A;">En cours</strong> : bail actif, loyer dû</li>
<li><strong style="color:#DC2626;">Résilié</strong> : bail terminé</li>
<li><strong style="color:#2563EB;">Renouvelé</strong> : bail reconduit</li>
<li><strong style="color:#D97706;">En négociation</strong> : conditions en cours de discussion</li>
<li><strong style="color:#991B1B;">Contentieux</strong> : litige en cours</li>
</ul>

<h2>Fiche bail détaillée</h2>
<p>En cliquant sur un bail, vous accédez à sa fiche complète :</p>
<ul>
<li><strong>Informations générales</strong> : type, fréquence de paiement, dates, durée, franchise, pas-de-porte</li>
<li><strong>Loyer et finances</strong> : loyer de base HT, loyer actuel, TVA, dépôt de garantie, indice de référence</li>
<li><strong>Provisions sur charges</strong> : charges provisionnelles mensuelles par catégorie</li>
<li><strong>Révisions de loyer</strong> : historique avec validation/rejet</li>
<li><strong>Avenants</strong> : modifications apportées au bail après signature</li>
<li><strong>États des lieux</strong> : entrée et sortie avec détail par pièce</li>
<li><strong>Factures récentes</strong> : dernières factures émises pour ce bail</li>
</ul>

<h2>Gestion des locataires</h2>
<p>La page <strong>Locataires</strong> affiche un tableau paginé avec recherche et filtres avancés (indicateur de risque, statut d'assurance, type d'entité).</p>

<h3>3 indicateurs de risque</h3>
<ul>
<li><strong style="color:#16A34A;">Fiable (vert)</strong> : paiements à jour, assurance valide</li>
<li><strong style="color:#D97706;">Vigilance (orange)</strong> : retards ponctuels ou assurance expirant</li>
<li><strong style="color:#DC2626;">Risque (rouge)</strong> : impayés récurrents, assurance expirée</li>
</ul>

<h3>Ajouter un locataire</h3>
${stepBlock(1, "Créez le locataire", "Cliquez sur <strong>Nouveau locataire</strong>. Renseignez l'identité (personne physique : nom, prénom, date de naissance ; personne morale : raison sociale, SIRET), les coordonnées et l'adresse.")}
${stepBlock(2, "Documents du locataire", "Joignez les pièces justificatives : pièce d'identité, justificatif de domicile, attestation d'assurance. L'assurance est suivie avec alerte d'expiration automatique.")}

<h2>Révisions de loyer</h2>
<p>Les révisions sont calculées automatiquement à partir des indices INSEE : <strong>IRL</strong> pour l'habitation, <strong>ILC</strong> pour le commerce, <strong>ILAT</strong> pour les bureaux.</p>
<p>Formule légale : <code>nouveau loyer = ancien loyer × (nouvel indice / ancien indice)</code></p>
${stepBlock(1, "Consultez les révisions en attente", "Page Révisions : liste des révisions dues avec loyer actuel, nouveau loyer calculé et pourcentage d'augmentation.")}
${stepBlock(2, "Validez ou rejetez", "Pour chaque révision : <strong>Valider</strong> (loyer mis à jour automatiquement) ou <strong>Rejeter</strong> (loyer inchangé). Historique complet conservé.")}
${infoBox("tip", "Les indices sont mis à jour automatiquement le 1er de chaque mois. Vous pouvez les consulter dans le module Indices.")}

<h2>Charges et provisions</h2>
<p>Le module <strong>Charges</strong> permet de suivre toutes les dépenses liées à vos immeubles. Chaque charge est classée par catégorie et par nature : <strong>exploitant</strong> (à la charge du propriétaire) ou <strong>récupérable</strong> (refacturable au locataire).</p>
<ul>
<li><strong>Bibliothèque de charges</strong> : modèles de charges récurrentes</li>
<li><strong>Comptes rendus</strong> : rapports récapitulatifs par immeuble ou catégorie</li>
</ul>

<h2>Carnet de contacts</h2>
<p>Le module <strong>Contacts</strong> centralise tous vos interlocuteurs : prestataires, notaires, experts, syndics, agences. Le bouton <strong>Synchroniser les locataires</strong> importe automatiquement tous les locataires actifs.</p>

<h2>Questions fréquentes</h2>
${faqItem("Comment résilier un bail ?", "Fiche du bail &gt; bouton <strong>Résilier</strong>. Renseignez la date et le motif. Le lot redeviendra automatiquement vacant.")}
${faqItem("Puis-je renouveler un bail expiré ?", "Non, un bail résilié ou expiré ne peut pas être réactivé. Créez un nouveau bail pour le même lot et locataire.")}
${faqItem("Comment modifier le loyer d'un bail ?", "Deux façons : via une révision automatique basée sur les indices INSEE, ou via un avenant au bail.")}
${faqItem("Comment fonctionne la révision automatique ?", "Formule : nouveau loyer = ancien loyer × (nouvel indice / ancien indice). Proposée automatiquement à la date anniversaire du bail.")}
${faqItem("Comment faire un rattrapage de révisions en retard ?", "Page <strong>Indices</strong> &gt; bouton <strong>Rattraper</strong>. L'application calcule année par année les révisions manquées.")}
${faqItem("Comment ajouter un avenant au bail ?", "Fiche bail &gt; section <strong>Avenants</strong> &gt; <strong>Nouvel avenant</strong>. Renseignez l'objet, la date d'effet et les nouvelles conditions.")}
${faqItem("Comment gérer le dépôt de garantie ?", "Le montant est renseigné lors de la création du bail. Il est affiché sur la fiche bail et pris en compte dans les rapports financiers.")}
${faqItem("Comment archiver un locataire qui est parti ?", "Le locataire est automatiquement archivé lorsque son dernier bail est résilié. Données conservées 5 ans après fin de bail (RGPD).")}
${faqItem("Comment gérer les charges récupérables ?", "Dans <strong>Charges</strong>, créez des charges avec la nature Récupérable. Elles seront prises en compte lors de la régularisation annuelle.")}
${faqItem("Comment créer une provision sur charges ?", "Fiche bail &gt; section Charges &gt; <strong>Ajouter une provision</strong>. Définissez la catégorie et le montant mensuel.")}
${faqItem("Comment faire la régularisation annuelle des charges ?", "Comparez provisions versées vs charges réelles. Créez une facture de régularisation : positive (complément) ou négative (remboursement).")}
${faqItem("Comment synchroniser les locataires dans le carnet de contacts ?", "Page <strong>Contacts</strong> &gt; bouton <strong>Synchroniser les locataires</strong>.")}
${faqItem("Comment ajouter un garant ou une caution ?", "Lors de la création du bail, renseignez les informations du garant : nom, prénom, adresse et profession.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 5 : Facturation et paiements
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Facturation et paiements",
    description:
      "Factures, paiements, relances automatiques, SEPA et quittances.",
    articles: [
      {
        title: "Factures, paiements et relances",
        body: `
<h2>Vue d'ensemble de la facturation</h2>
<p>La page <strong>Facturation</strong> présente 4 indicateurs clés :</p>
<ul>
<li><strong>Total TTC facturé</strong> : montant cumulé</li>
<li><strong>Impayés</strong> : montant des factures non réglées (avec nombre de factures)</li>
<li><strong>En retard</strong> : nombre de factures dont l'échéance est dépassée</li>
<li><strong>Relances</strong> : nombre de relances envoyées</li>
</ul>
<p>Les factures sont organisées en onglets : <strong>Toutes</strong>, <strong>Brouillons</strong>, <strong>En retard</strong> et <strong>Relances</strong>.</p>

<h2>Génération automatique des factures</h2>
<p>Chaque jour à <strong>7h du matin</strong>, MyGestia génère automatiquement des brouillons de factures pour tous les baux actifs.</p>
${stepBlock(1, "Vérifiez les brouillons", "Les factures générées ont le statut <strong>Brouillon</strong>. Consultez-les dans l'onglet Brouillons pour vérifier les montants.")}
${stepBlock(2, "Validez les factures", "Cliquez sur <strong>Valider</strong> pour chaque facture. Un numéro séquentiel lui est attribué.")}
${stepBlock(3, "Envoyez par email", "Le PDF est généré automatiquement avec votre logo et vos coordonnées bancaires.")}
${infoBox("tip", "Vous pouvez aussi générer des appels de loyer manuellement depuis le bouton <strong>Générer des appels</strong>.")}

<h2>Les 9 statuts d'une facture</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Statut</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Description</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#F3F4F6;color:#374151;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Brouillon</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Facture générée automatiquement, en attente de validation</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#DBEAFE;color:#1D4ED8;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Validée</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Facture vérifiée, prête à être envoyée</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#E0E7FF;color:#4338CA;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Envoyée</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Facture transmise au locataire par email</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#FEF3C7;color:#B45309;padding:2px 8px;border-radius:9999px;font-size:0.85em;">En attente</span></td><td style="padding:10px;border:1px solid #E5E7EB;">En attente de paiement avant la date d'échéance</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#D1FAE5;color:#065F46;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Payée</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Paiement reçu en totalité</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#FFEDD5;color:#C2410C;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Partiellement payée</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Paiement partiel reçu, solde restant dû</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#FEE2E2;color:#991B1B;padding:2px 8px;border-radius:9999px;font-size:0.85em;">En retard</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Date d'échéance dépassée, paiement non reçu</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#F3E8FF;color:#7C3AED;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Relancée</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Une ou plusieurs relances envoyées</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#F3F4F6;color:#9CA3AF;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Annulée</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Facture annulée (avoir émis)</td></tr>
</tbody>
</table>

<h2>Enregistrement des paiements</h2>
${stepBlock(1, "Paiement total", "Depuis la fiche facture, cliquez sur <strong>Enregistrer un paiement</strong>. Sélectionnez le mode (virement, chèque, espèces, prélèvement) et la date.")}
${stepBlock(2, "Paiement partiel", "Modifiez le montant pour enregistrer un paiement partiel. La facture passe au statut <strong>Partiellement payée</strong>.")}
${stepBlock(3, "Paiement multi-factures", "Si le locataire paie plusieurs factures en un seul virement, ventillez le montant sur plusieurs factures.")}

<h2>Relances automatiques (3 niveaux)</h2>
<p>Les factures impayées sont relancées automatiquement. Les relances sont envoyées chaque <strong>lundi matin à 8h</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Niveau</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Délai</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Ton</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">1 - Relance courtoise</td><td style="padding:10px;border:1px solid #E5E7EB;">J+7 après échéance</td><td style="padding:10px;border:1px solid #E5E7EB;">Rappel amical du montant dû</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">2 - Relance ferme</td><td style="padding:10px;border:1px solid #E5E7EB;">J+21 après échéance</td><td style="padding:10px;border:1px solid #E5E7EB;">Ton formel, conséquences possibles</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">3 - Mise en demeure</td><td style="padding:10px;border:1px solid #E5E7EB;">J+45 après échéance</td><td style="padding:10px;border:1px solid #E5E7EB;">Dernier rappel avant procédure contentieuse</td></tr>
</tbody>
</table>

<h2>Quittances de loyer</h2>
<p>Une quittance est un reçu officiel attestant que le locataire a payé son loyer. Elle est générée uniquement pour les factures dont le paiement est complet.</p>
${stepBlock(1, "Générer une quittance", "Depuis la fiche d'une facture payée, cliquez sur <strong>Générer la quittance</strong>.")}
${stepBlock(2, "Envoyer par email", "La quittance peut être envoyée directement par email au locataire ou téléchargée en PDF.")}

<h2>Prélèvement SEPA</h2>
${stepBlock(1, "Créez un mandat SEPA", "Pour chaque locataire qui paie par prélèvement, créez un mandat SEPA avec ses coordonnées bancaires (IBAN/BIC).")}
${stepBlock(2, "Générez le fichier de prélèvement", "En fin de mois, générez un fichier SEPA regroupant tous les prélèvements. Ce fichier au format XML est transmis à votre banque.")}

<h2>Avoirs (notes de crédit)</h2>
<p>Pour annuler ou corriger une facture déjà validée, émettez un <strong>avoir</strong>. Depuis la fiche facture, cliquez sur <strong>Créer un avoir</strong>. Renseignez le motif et le montant (total ou partiel). La facture originale est automatiquement mise à jour.</p>

<h2>Questions fréquentes</h2>
${faqItem("Comment créer une facture manuellement ?", "<strong>Facturation &gt; Nouvelle facture</strong>. Sélectionnez le bail, la période et les lignes de facturation. La facture est créée en brouillon.")}
${faqItem("Comment annuler une facture déjà validée ?", "Depuis la fiche facture, cliquez sur <strong>Créer un avoir</strong>. Vous ne pouvez pas supprimer une facture validée directement.")}
${faqItem("Comment gérer un paiement partiel ?", "Enregistrez le montant effectivement reçu. La facture passe en statut Partiellement payée et le solde restant dû est affiché.")}
${faqItem("Comment envoyer une facture par email ?", "Depuis la fiche facture, cliquez sur <strong>Envoyer par email</strong>. Le PDF est généré automatiquement.")}
${faqItem("Les factures sont-elles générées automatiquement ?", "Oui, chaque jour à 7h. Les brouillons doivent être vérifiés et validés manuellement avant envoi.")}
${faqItem("Comment valider plusieurs factures en une fois ?", "Onglet Brouillons &gt; cochez les factures &gt; action groupée <strong>Valider</strong>.")}
${faqItem("Comment voir les factures impayées ?", "Onglet <strong>En retard</strong> sur la page Facturation. Le KPI Impayés affiche le montant total.")}
${faqItem("Comment personnaliser le contenu d'une facture ?", "Chaque facture peut comporter des lignes personnalisées tant qu'elle est au statut brouillon.")}
${faqItem("Qu'est-ce qu'une quittance de loyer ?", "Un reçu officiel attestant le paiement du loyer. Générée uniquement pour les factures entièrement payées.")}
${faqItem("Comment fonctionnent les relances automatiques ?", "3 niveaux : courtoise (J+7), ferme (J+21), mise en demeure (J+45). Envoyées chaque lundi à 8h.")}
${faqItem("Comment désactiver les relances pour un locataire ?", "Les relances s'appliquent à toutes les factures impayées. Pour gérer au cas par cas, envoyez les relances manuellement depuis la page Relances.")}
${faqItem("Qu'est-ce que le prélèvement SEPA ?", "Système de prélèvement automatique européen. Créez un mandat SEPA avec l'IBAN du locataire, puis générez un fichier XML pour votre banque.")}
${faqItem("Comment régulariser les charges en fin d'année ?", "Comparez provisions versées vs charges réelles. Créez une facture de régularisation ou émettez un avoir pour le montant excédentaire.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 6 : Banque et comptabilité
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Banque et comptabilité",
    description:
      "Comptes bancaires, rapprochement, écritures comptables et export FEC.",
    articles: [
      {
        title: "Comptes bancaires, rapprochement et comptabilité",
        body: `
<h2>Gestion des comptes bancaires</h2>
<p>La page <strong>Banque</strong> affiche tous vos comptes bancaires sous forme de cartes, avec le solde actuel (vert si positif, rouge si négatif).</p>
${stepBlock(1, "Ajouter un compte manuellement", "Cliquez sur <strong>Nouveau compte</strong>. Renseignez le nom, la banque et l'IBAN. Les données bancaires sont <strong>chiffrées en AES-256-GCM</strong>.")}
${stepBlock(2, "Connexion Open Banking (optionnel)", "Connectez votre compte via <strong>Connexion bancaire</strong>. L'application utilise Powens pour synchroniser vos mouvements quotidiennement à 6h.")}
${infoBox("info", "La synchronisation automatique s'exécute chaque jour à 6h du matin. Vous pouvez aussi déclencher une synchronisation manuelle à tout moment.")}

<h2>Transactions bancaires</h2>
<p>En cliquant sur un compte, vous accédez à l'historique complet. Chaque transaction affiche la date, le libellé, le montant (débit en rouge, crédit en vert) et le statut de rapprochement. Filtres disponibles : période, montant, statut.</p>

<h2>Rapprochement bancaire</h2>
<p>Le rapprochement associe chaque transaction bancaire à la facture ou écriture correspondante pour garantir la cohérence comptable.</p>
${stepBlock(1, "Accédez au rapprochement", "Depuis la fiche d'un compte, cliquez sur <strong>Rapprochement</strong>. L'écran se divise en deux colonnes : transactions à gauche, factures/écritures à droite.")}
${stepBlock(2, "Associez les éléments", "Sélectionnez une transaction et la facture correspondante, puis cliquez sur <strong>Rapprocher</strong>. L'application suggère automatiquement les correspondances.")}
${stepBlock(3, "Vérifiez les écarts", "Si un écart existe, un avertissement s'affiche. Vous pouvez créer une écriture d'ajustement.")}

<h2>Module comptabilité</h2>
<p>La page <strong>Comptabilité</strong> centralise toute votre tenue de comptes avec 4 KPI en haut de page : écritures totales, brouillons, validées et comptes actifs.</p>
<p>Accès rapides disponibles :</p>
<ul>
<li><strong>Saisir une écriture</strong> : nouvelle écriture comptable (débit/crédit)</li>
<li><strong>Grand Livre</strong> : écritures classées par compte</li>
<li><strong>Balance</strong> : vue synthétique des soldes</li>
<li><strong>Plan comptable</strong> : liste des comptes (code, libellé, type)</li>
<li><strong>Export FEC</strong> : Fichier des Écritures Comptables réglementaire</li>
<li><strong>Exercices</strong> : gestion des exercices (ouverture, clôture)</li>
</ul>

<h2>Écritures comptables</h2>
<p>Les écritures suivent le principe de la <strong>partie double</strong> : chaque opération est enregistrée avec un débit et un crédit de même montant.</p>
<p>Statuts : <strong>Brouillon</strong> (modifiable), <strong>Validée</strong> (figée), <strong>Clôturée</strong> (exercice fermé).</p>
${infoBox("warning", "Les écritures en brouillon doivent être validées avant la clôture de l'exercice.")}

<h2>Export FEC</h2>
<p>Le FEC (Fichier des Écritures Comptables) est un format réglementaire exigé par l'administration fiscale française en cas de contrôle.</p>
${stepBlock(1, "Accédez aux exports", "<strong>Comptabilité &gt; Export FEC</strong>")}
${stepBlock(2, "Sélectionnez la période", "Choisissez l'exercice comptable ou la plage de dates.")}
${stepBlock(3, "Téléchargez le fichier", "Format réglementaire TXT tabulé, téléchargé automatiquement.")}

<h2>Exercices comptables</h2>
<p>Un exercice correspond généralement à une année civile (1er janvier au 31 décembre). La <strong>clôture est irréversible</strong> : vérifiez que tous les brouillons sont validés avant de clôturer.</p>

<h2>Questions fréquentes</h2>
${faqItem("Comment ajouter un compte bancaire ?", "<strong>Banque &gt; Nouveau compte</strong>. Renseignez le nom, la banque et l'IBAN. Données chiffrées en AES-256.")}
${faqItem("Comment connecter ma banque pour la synchronisation automatique ?", "<strong>Banque &gt; Connexion bancaire</strong>. Via Open Banking (Powens), vos transactions sont synchronisées chaque jour à 6h.")}
${faqItem("Ma banque n'apparaît pas dans la liste, que faire ?", "Toutes les banques ne sont pas encore supportées. Vous pouvez ajouter manuellement vos transactions ou importer via CSV.")}
${faqItem("Comment rapprocher une transaction bancaire ?", "<strong>Rapprochement</strong> : sélectionnez une transaction à gauche, l'élément correspondant à droite, puis cliquez sur <strong>Rapprocher</strong>.")}
${faqItem("Qu'est-ce que le rapprochement automatique ?", "Le bouton <strong>Rapprochement automatique</strong> associe les éléments qui correspondent exactement en montant et en date.")}
${faqItem("Comment ajouter une transaction manuellement ?", "Fiche du compte &gt; <strong>Nouvelle transaction</strong>. Renseignez date, libellé, montant et référence.")}
${faqItem("Qu'est-ce que le FEC ?", "Le Fichier des Écritures Comptables, format réglementaire pour les contrôles fiscaux. Export depuis <strong>Comptabilité &gt; Export FEC</strong>.")}
${faqItem("Comment créer une écriture comptable ?", "<strong>Comptabilité &gt; Saisir une écriture</strong>. Principe de partie double : total débit = total crédit.")}
${faqItem("Comment consulter le grand livre ?", "<strong>Comptabilité &gt; Grand Livre</strong>. Toutes les écritures classées par compte avec le solde de chacun.")}
${faqItem("Qu'est-ce que la balance comptable ?", "Vue synthétique montrant le solde débiteur et créditeur de chaque compte. Accessible depuis <strong>Comptabilité &gt; Balance</strong>.")}
${faqItem("Comment clôturer un exercice comptable ?", "<strong>Comptabilité &gt; Exercices &gt; Clôturer</strong>. Vérifiez que tous les brouillons sont validés. Opération irréversible.")}
${faqItem("Comment gérer le plan comptable ?", "<strong>Comptabilité &gt; Plan comptable</strong>. Ajouter, modifier ou désactiver des comptes. Plan pré-configuré pour la gestion immobilière.")}
${faqItem("Comment voir le prévisionnel de trésorerie ?", "Module <strong>Prévisionnel</strong> : flux entrants (loyers attendus) et sortants (charges, emprunts) sur les mois à venir.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 7 : Vue Propriétaire
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Vue Propriétaire",
    description:
      "Tableau de bord consolidé multi-sociétés et gestion des propriétaires.",
    articles: [
      {
        title: "Gérer vos propriétaires et consolider votre patrimoine",
        body: `
<h2>Qu'est-ce qu'un propriétaire ?</h2>
<p>Dans MyGestia, un <strong>propriétaire</strong> est l'entité qui détient une ou plusieurs sociétés. C'est le niveau le plus élevé de l'arborescence :</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;font-family:monospace;font-size:0.9em;margin:16px 0;">
Propriétaire (personne physique ou morale)<br/>
&nbsp;&nbsp;&rarr; Société 1 (SCI Soleil)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&rarr; Immeuble A<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&rarr; Lot 1, Lot 2, Lot 3<br/>
&nbsp;&nbsp;&rarr; Société 2 (SARL Horizon)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&rarr; Immeuble B<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&rarr; Lot 4, Lot 5
</div>
<p>Un propriétaire peut être une <strong>personne physique</strong> (particulier, couple) ou une <strong>personne morale</strong> (SCI, SARL, SAS, etc.).</p>
${infoBox("info", "Le propriétaire est créé automatiquement la première fois que vous créez une société. Vous pouvez le personnaliser ensuite depuis l'onglet Profil Propriétaire.")}

<h2>Tableau de bord consolidé</h2>
<p>L'onglet <strong>Tableau de bord</strong> affiche des KPI agrégés sur toutes les sociétés du propriétaire :</p>
<ul>
<li><strong>Revenus mensuels</strong> : total des loyers perçus sur toutes les sociétés</li>
<li><strong>Taux d'occupation</strong> : pourcentage de lots occupés vs lots totaux</li>
<li><strong>Impayés</strong> : montant total des factures en retard</li>
<li><strong>Trésorerie</strong> : solde disponible sur tous les comptes</li>
</ul>
<p>Un <strong>tableau de performance par société</strong> compare : revenus mensuels, trésorerie, taux d'occupation.</p>
<p><strong>6 graphiques interactifs</strong> : revenus mensuels 12 mois, occupation par immeuble, impayés par ancienneté, évolution du patrimoine, concentration des risques, timeline des baux.</p>

<h2>Onglet Sociétés</h2>
<p>Affiche les sociétés rattachées au propriétaire sous forme de cartes (nom, forme juridique, SIRET, statut, rôle). Vous pouvez créer une nouvelle société directement depuis cet onglet.</p>

<h2>Profil propriétaire</h2>
<h3>Personne physique</h3>
<p>Prénom, nom, email (pour envoi de rapports), téléphone, date et lieu de naissance, profession, nationalité, adresse complète.</p>
<h3>Personne morale</h3>
<p>Dénomination sociale, forme juridique, SIRET, SIREN, capital social, numéro de TVA intracommunautaire, ville du RCS, représentant légal, téléphone, siège social.</p>

<h2>Co-propriétaires (associés)</h2>
<p>Pour un propriétaire personne physique, vous pouvez déclarer des <strong>co-propriétaires</strong> (indivisions, couples, détention partagée).</p>
${stepBlock(1, "Passez en mode édition", "Onglet Profil Propriétaire &gt; <strong>Modifier</strong>.")}
${stepBlock(2, "Ajoutez un co-propriétaire", "Section Co-propriétaires &gt; <strong>Ajouter</strong>.")}
${stepBlock(3, "Renseignez les informations", "Prénom, nom, email, téléphone, part de détention (ex: 50%), qualité (co-propriétaire, usufruitier, nu-propriétaire, indivisaire), date et lieu de naissance, nationalité.")}
${infoBox("info", "Les co-propriétaires ne sont disponibles que pour les propriétaires de type personne physique.")}

<h2>Sélecteur de propriétaire et revendication</h2>
<p>Si vous gérez plusieurs propriétaires, un <strong>sélecteur</strong> en haut de page permet de basculer entre eux. Si une société n'est pas rattachée à un propriétaire, un bouton <strong>Revendiquer des sociétés</strong> apparaît.</p>

<h2>Questions fréquentes</h2>
${faqItem("Quelle est la différence entre propriétaire et société ?", "Le propriétaire est la personne qui détient une ou plusieurs sociétés. La société est l'entité juridique qui gère les immeubles et les baux.")}
${faqItem("Comment créer un nouveau propriétaire ?", "Un propriétaire est créé automatiquement lors de la création d'une société. Vous pouvez aussi en créer un manuellement depuis <strong>Propriétaire &gt; Nouveau propriétaire</strong>.")}
${faqItem("Comment rattacher une société existante ?", "Vue Propriétaire &gt; bouton <strong>Revendiquer des sociétés</strong>. Sélectionnez les sociétés non rattachées.")}
${faqItem("Comment ajouter un co-propriétaire ?", "Vue Propriétaire &gt; Profil &gt; Modifier &gt; Co-propriétaires &gt; Ajouter. Renseignez nom, part de détention et qualité.")}
${faqItem("Le tableau de bord consolide-t-il toutes les sociétés ?", "Oui, les KPI sont agrégés sur toutes les sociétés rattachées au propriétaire sélectionné.")}
${faqItem("Comment envoyer un rapport consolidé ?", "<strong>Rapports &gt; Planification</strong>, créez un rapport consolidé. Il regroupera les données de toutes les sociétés et sera envoyé par email.")}
${faqItem("Puis-je avoir plusieurs propriétaires ?", "Oui, chaque propriétaire dispose de son propre tableau de bord consolidé et profil.")}
${faqItem("Comment modifier le type de propriétaire ?", "Le type est défini à la création et ne peut pas être changé. Créez un nouveau propriétaire et rattachez-y les sociétés.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 8 : Évaluations IA et emprunts
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Évaluations IA et emprunts",
    description:
      "Estimation du patrimoine par IA, emprunts et tableaux d'amortissement.",
    articles: [
      {
        title: "Évaluations immobilières et gestion des emprunts",
        body: `
<h2>Évaluation IA du patrimoine</h2>
<p>MyGestia intègre un système d'évaluation automatique basé sur l'intelligence artificielle et les données du marché immobilier.</p>
${stepBlock(1, "Lancez une évaluation", "Depuis la fiche d'un immeuble, section <strong>Valorisation</strong>, cliquez sur <strong>Évaluation IA</strong>.")}
${stepBlock(2, "L'IA analyse votre bien", "L'algorithme prend en compte : adresse, surface, type de bien, année de construction, taux d'occupation, loyers perçus et données de marché locales (transactions DVF).")}
${stepBlock(3, "Consultez le rapport", "Rapport détaillé avec : valeur estimée, méthode de calcul, comparables utilisés et indice de confiance.")}
${infoBox("info", "L'évaluation IA est une estimation indicative. Elle ne remplace pas une expertise immobilière professionnelle mais constitue un excellent outil de pilotage.")}

<h2>Vue d'ensemble des emprunts</h2>
<p>La page <strong>Emprunts</strong> affiche 4 indicateurs clés :</p>
<ul>
<li><strong>Capital emprunté</strong> : montant total initial de tous vos prêts</li>
<li><strong>Capital restant dû</strong> : montant qu'il reste à rembourser (affiché en rouge)</li>
<li><strong>Capital remboursé</strong> : montant déjà remboursé (affiché en vert)</li>
<li><strong>Mensualité totale</strong> : somme de toutes vos mensualités en cours (affiché en bleu)</li>
</ul>
<p>Les emprunts sont regroupés par <strong>prêteur</strong> (banque ou organisme) avec barre de progression du remboursement.</p>

<h2>Les 3 types d'emprunts</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Type</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Description</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Amortissable</td><td style="padding:10px;border:1px solid #E5E7EB;">Le plus courant. Chaque mensualité rembourse capital + intérêts. Le capital remboursé augmente progressivement.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">In fine</td><td style="padding:10px;border:1px solid #E5E7EB;">Seuls les intérêts sont payés chaque mois. Le capital est remboursé en totalité à l'échéance. Utilisé pour optimiser la fiscalité.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Bullet (ballon)</td><td style="padding:10px;border:1px solid #E5E7EB;">Aucun paiement intermédiaire. Capital + intérêts remboursés en un seul versement à l'échéance. Pour financements relais.</td></tr>
</tbody>
</table>

<h2>Créer un emprunt</h2>
${stepBlock(1, "Cliquez sur Nouvel emprunt", "Depuis la page Emprunts.")}
${stepBlock(2, "Renseignez les caractéristiques", "Libellé, type, montant emprunté, taux d'intérêt annuel, durée en mois, date de début, nom du prêteur.")}
${stepBlock(3, "Associez à un immeuble (optionnel)", "Pour calculer automatiquement le ratio LTV et suivre l'endettement par bien.")}
${stepBlock(4, "Consultez le tableau d'amortissement", "Généré automatiquement : pour chaque échéance, capital remboursé, intérêts, mensualité et capital restant dû.")}

<h2>Tableau d'amortissement</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:0.9em;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:8px;border:1px solid #E5E7EB;">Échéance</th>
<th style="text-align:right;padding:8px;border:1px solid #E5E7EB;">Capital</th>
<th style="text-align:right;padding:8px;border:1px solid #E5E7EB;">Intérêts</th>
<th style="text-align:right;padding:8px;border:1px solid #E5E7EB;">Mensualité</th>
<th style="text-align:right;padding:8px;border:1px solid #E5E7EB;">Restant dû</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">01/2025</td><td style="text-align:right;padding:8px;border:1px solid #E5E7EB;">678,45 &euro;</td><td style="text-align:right;padding:8px;border:1px solid #E5E7EB;">333,33 &euro;</td><td style="text-align:right;padding:8px;border:1px solid #E5E7EB;font-weight:500;">1 011,78 &euro;</td><td style="text-align:right;padding:8px;border:1px solid #E5E7EB;">199 321,55 &euro;</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;">02/2025</td><td style="text-align:right;padding:8px;border:1px solid #E5E7EB;">679,58 &euro;</td><td style="text-align:right;padding:8px;border:1px solid #E5E7EB;">332,20 &euro;</td><td style="text-align:right;padding:8px;border:1px solid #E5E7EB;font-weight:500;">1 011,78 &euro;</td><td style="text-align:right;padding:8px;border:1px solid #E5E7EB;">198 641,97 &euro;</td></tr>
<tr><td style="padding:8px;border:1px solid #E5E7EB;color:#9CA3AF;" colspan="5">...</td></tr>
</tbody>
</table>

<h2>Ratio LTV (Loan-to-Value)</h2>
<p>Le ratio LTV mesure l'endettement par rapport à la valeur du patrimoine :</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:12px;text-align:center;font-family:monospace;margin:16px 0;">
LTV = Capital restant dû / Valeur du patrimoine &times; 100
</div>
<ul>
<li><strong style="color:#16A34A;">LTV &lt; 50%</strong> : endettement sain</li>
<li><strong style="color:#D97706;">LTV 50-80%</strong> : endettement modéré, à surveiller</li>
<li><strong style="color:#DC2626;">LTV &gt; 80%</strong> : endettement élevé, attention</li>
</ul>

<h2>Questions fréquentes</h2>
${faqItem("Quelle est la différence entre amortissable et in fine ?", "<strong>Amortissable</strong> : remboursement progressif capital + intérêts. <strong>In fine</strong> : intérêts mensuels uniquement, capital remboursé à l'échéance.")}
${faqItem("Comment modifier un emprunt existant ?", "Fiche de l'emprunt &gt; bouton Modifier. Vous pouvez ajuster le taux, la durée ou l'assurance.")}
${faqItem("Comment suivre le remboursement ?", "Le tableau d'amortissement montre chaque échéance. Les échéances payées sont cochées lors du rapprochement bancaire.")}
${faqItem("Qu'est-ce que le ratio LTV ?", "Loan-to-Value = Capital dû / Valeur du bien × 100. Indicateur d'endettement visible sur le dashboard.")}
${faqItem("L'évaluation IA est-elle fiable ?", "C'est une estimation indicative basée sur les données de marché (comparables, DVF, loyers). Elle ne remplace pas une expertise professionnelle.")}
${faqItem("Comment associer un emprunt à un immeuble ?", "Lors de la création ou modification, sélectionnez l'immeuble dans le champ dédié. Le LTV est alors calculé automatiquement.")}
${faqItem("Puis-je ajouter une assurance emprunteur ?", "Oui, renseignez le montant mensuel d'assurance lors de la création de l'emprunt.")}
${faqItem("Comment exporter le tableau d'amortissement ?", "Fiche de l'emprunt &gt; bouton d'export pour télécharger au format CSV ou PDF.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 9 : Documents, Dataroom et signatures
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Documents, Dataroom et signatures",
    description:
      "Stockage sécurisé, partage de documents et signatures électroniques.",
    articles: [
      {
        title: "Gestion documentaire, partage sécurisé et signatures",
        body: `
<h2>Stockage sécurisé des documents</h2>
<p>MyGestia offre un espace de stockage sécurisé hébergé sur Supabase Storage (infrastructure européenne, Frankfurt). Les fichiers sont accessibles via des URLs signées à durée limitée (5 minutes).</p>
<p>Les documents peuvent être rattachés à : immeuble, lot, bail, locataire ou société.</p>

<h3>9 catégories de documents</h3>
<ul>
<li><strong>Baux et avenants</strong> : contrats de location signés</li>
<li><strong>Diagnostics</strong> : DPE, amiante, plomb, gaz, électricité, etc.</li>
<li><strong>Factures et quittances</strong> : factures émises et quittances de loyer</li>
<li><strong>Pièces d'identité</strong> : copies des pièces des locataires</li>
<li><strong>Assurances</strong> : attestations d'assurance (propriétaire et locataire)</li>
<li><strong>États des lieux</strong> : rapports d'entrée et de sortie</li>
<li><strong>Courriers</strong> : correspondances officielles</li>
<li><strong>Comptabilité</strong> : relevés bancaires, FEC, bilans</li>
<li><strong>Autres</strong> : tout document ne rentrant pas dans les catégories précédentes</li>
</ul>

<h2>Ajouter un document</h2>
<p>L'upload de documents est optimisé pour les fichiers volumineux grâce à un système d'envoi par morceaux (TUS). Vous pouvez envoyer un seul fichier ou un dossier entier en une seule opération.</p>

<h3>Upload d'un fichier unique</h3>
${stepBlock(1, "Accédez à la GED", "Menu latéral &gt; <strong>Documents</strong> &gt; bouton <strong>Ajouter un document</strong>. Vous pouvez aussi y accéder depuis la fiche d'un immeuble, bail ou locataire, section Documents.")}
${stepBlock(2, "Sélectionnez le fichier", "Glissez-déposez le fichier dans la zone d'upload ou cliquez pour parcourir vos fichiers. <strong>Formats acceptés :</strong> PDF, JPG, PNG, WebP, Word (DOC/DOCX). <strong>Taille maximale :</strong> 20 Mo.")}
${stepBlock(3, "Rattachez à une entité", "Associez le document à un <strong>immeuble</strong>, un <strong>lot</strong>, un <strong>bail</strong> ou un <strong>locataire</strong>. Ce rattachement permet de retrouver facilement le document depuis la fiche correspondante.")}
${stepBlock(4, "Renseignez les métadonnées", "Choisissez la <strong>catégorie</strong> (bail, diagnostic, assurance, etc.), ajoutez une <strong>description</strong> et une <strong>date d'expiration</strong> si applicable. Les documents avec date d'expiration déclenchent des alertes automatiques (badge orange 90 jours avant, rouge après expiration).")}
${stepBlock(5, "Analyse IA automatique", "Si votre plan le permet, l'IA analyse le document en arrière-plan et propose automatiquement un résumé, des mots-clés et une catégorie.")}

<h3>Upload d'un dossier complet</h3>
<p>Vous pouvez uploader un <strong>dossier entier</strong> en une seule opération (utile pour importer tous les documents d'un locataire ou d'un immeuble). Basculez en mode <strong>Dossier</strong> dans la zone d'upload, puis sélectionnez le dossier. Chaque fichier est uploadé individuellement avec sa propre barre de progression.</p>

${infoBox("tip", "L'upload utilise un système de découpage (TUS) qui permet de reprendre l'envoi en cas de coupure réseau. Les fichiers volumineux sont envoyés par morceaux de 3,67 Mo.")}

<h2>Dataroom : espace de partage sécurisé</h2>
<p>La <strong>Dataroom</strong> est un espace de partage sécurisé destiné à vos partenaires externes : banques, notaires, acquéreurs potentiels, experts-comptables, avocats. Elle permet de mettre à disposition des documents sans donner accès à l'application MyGestia.</p>

<h3>3 statuts d'une Dataroom</h3>
<ul>
<li><strong>Brouillon</strong> : en préparation. Ajoutez et organisez vos documents avant de partager. Le lien de partage n'est pas encore actif.</li>
<li><strong style="color:#16A34A;">Active</strong> : le lien de partage est généré et fonctionnel. Les destinataires peuvent consulter les documents. Chaque accès est tracé.</li>
<li><strong style="color:#6B7280;">Archivée</strong> : le lien de partage est désactivé. Les documents restent dans la Dataroom mais ne sont plus accessibles de l'extérieur.</li>
</ul>

<h3>Créer et configurer une Dataroom — étape par étape</h3>
${stepBlock(1, "Accédez au module Dataroom", "Depuis le menu latéral, cliquez sur <strong>Dataroom</strong>. La page affiche toutes vos Datarooms existantes sous forme de cartes avec le nombre de documents, le nombre d'accès et le statut.")}
${stepBlock(2, "Créez une nouvelle Dataroom", "Cliquez sur <strong>Nouvelle Dataroom</strong>. Renseignez : le <strong>nom</strong> (ex: &laquo; Due diligence SCI Soleil &raquo;), une <strong>description</strong> (optionnelle), le <strong>destinataire</strong> (nom et email), et l'<strong>objet</strong> du partage (vente, audit, financement...).")}
${stepBlock(3, "Configurez la sécurité", "Deux options de protection :<br/><strong>Date d'expiration</strong> : le lien sera automatiquement désactivé après cette date (7 jours, 30 jours, date personnalisée).<br/><strong>Mot de passe</strong> (optionnel) : le destinataire devra saisir un mot de passe pour accéder aux documents. Le mot de passe est chiffré (bcrypt).")}
${stepBlock(4, "Ajoutez des documents", "Depuis la fiche Dataroom, cliquez sur <strong>Ajouter un document</strong>. Sélectionnez les fichiers depuis votre GED (documents déjà uploadés). Vous pouvez réorganiser l'ordre d'affichage par glisser-déposer.")}
${stepBlock(5, "Activez le partage", "Quand votre Dataroom est prête, cliquez sur <strong>Activer</strong>. Un <strong>lien unique sécurisé</strong> est généré. Copiez-le et envoyez-le par email à votre destinataire.")}
${stepBlock(6, "Suivez les consultations", "La fiche Dataroom affiche un <strong>journal d'accès</strong> : nom du visiteur, email, adresse IP et date/heure de chaque consultation. Vous savez exactement qui a vu quoi et quand.")}
${stepBlock(7, "Archivez quand c'est terminé", "Cliquez sur <strong>Archiver</strong> pour désactiver le lien. Les documents restent consultables en interne mais le lien externe ne fonctionne plus.")}
${infoBox("warning", "Le destinataire de la Dataroom n'a accès <strong>qu'aux documents explicitement ajoutés</strong> dans cet espace. Il ne peut pas naviguer dans l'application, voir d'autres sociétés ou accéder à des données non partagées.")}
${infoBox("tip", "Vous pouvez aussi ajouter un document à une Dataroom existante directement depuis la GED : ouvrez le document, puis cliquez sur <strong>Ajouter à une Dataroom</strong>.")}

<h2>Signatures électroniques</h2>
<p>MyGestia intègre un module de <strong>signature électronique</strong> basé sur <strong>DocuSign</strong>, permettant de faire signer numériquement tous vos documents immobiliers directement depuis l'application.</p>
${infoBox("info", "La signature électronique est disponible uniquement sur le <strong>plan Enterprise</strong>. Elle est conforme au règlement européen <strong>eIDAS</strong> et a la même valeur juridique qu'une signature manuscrite.")}

<h3>4 types de documents signables</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Type</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Description</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Exemple d'usage</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Bail</td><td style="padding:10px;border:1px solid #E5E7EB;">Contrat de location complet</td><td style="padding:10px;border:1px solid #E5E7EB;">Nouveau bail habitation ou commercial</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">État des lieux</td><td style="padding:10px;border:1px solid #E5E7EB;">Constat d'entrée ou de sortie</td><td style="padding:10px;border:1px solid #E5E7EB;">État des lieux d'entrée avec photos</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Mandat</td><td style="padding:10px;border:1px solid #E5E7EB;">Mandat de gestion ou SEPA</td><td style="padding:10px;border:1px solid #E5E7EB;">Autorisation de prélèvement SEPA</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Autre</td><td style="padding:10px;border:1px solid #E5E7EB;">Tout document nécessitant signature</td><td style="padding:10px;border:1px solid #E5E7EB;">Avenant, attestation, courrier officiel</td></tr>
</tbody>
</table>

<h3>Envoyer un document à la signature — étape par étape</h3>
${stepBlock(1, "Accédez au module signature", "Depuis la <strong>fiche d'un bail</strong>, repérez la section <strong>Signature électronique</strong> dans le panneau latéral. Vous y trouverez un bouton <strong>Envoyer à la signature</strong> et l'historique des demandes passées.")}
${stepBlock(2, "Sélectionnez ou uploadez le document", "Le système propose automatiquement le contrat de bail associé. Vous pouvez aussi envoyer un autre document PDF (avenant, mandat, état des lieux) en le sélectionnant depuis la GED ou en l'uploadant directement.")}
${stepBlock(3, "Renseignez les informations du signataire", "Indiquez le <strong>nom complet</strong> et l'<strong>adresse email</strong> du signataire. Un objet et un message personnalisé peuvent être ajoutés pour contextualiser la demande.")}
${stepBlock(4, "Choisissez le mode de signature", "Deux modes disponibles :<br/><strong>Par email</strong> : le signataire reçoit un lien sécurisé DocuSign dans sa boîte mail. Idéal pour la signature à distance.<br/><strong>Signature intégrée</strong> : le signataire signe directement dans l'application MyGestia, sur votre écran. Idéal pour les rendez-vous en présentiel (état des lieux, signature de bail en agence).")}
${stepBlock(5, "Envoyez la demande de signature", "Cliquez sur <strong>Envoyer</strong>. La demande est transmise instantanément à DocuSign. Le signataire reçoit un email contenant un lien sécurisé vers la page de signature.")}
${stepBlock(6, "Le signataire signe depuis son navigateur", "Le signataire ouvre le lien, consulte le document complet et appose sa signature électronique. <strong>Aucun compte DocuSign n'est nécessaire</strong> : la signature se fait directement dans le navigateur web, sur ordinateur, tablette ou téléphone.")}
${stepBlock(7, "Document signé archivé automatiquement", "Une fois la signature apposée, le document final (avec certificat de signature intégré) est automatiquement archivé dans la GED de MyGestia et rattaché au bail concerné. Un log d'audit est créé.")}

<h3>Suivi en temps réel de l'avancement</h3>
<p>Le statut de chaque demande de signature est mis à jour <strong>automatiquement en temps réel</strong> grâce aux webhooks DocuSign. Vous n'avez rien à faire : le statut se met à jour tout seul.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Statut</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Signification</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Action possible</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#DBEAFE;color:#1D4ED8;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Envoyé</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Le document a été envoyé au signataire par email</td><td style="padding:10px;border:1px solid #E5E7EB;">Attendre ou annuler</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#FEF3C7;color:#B45309;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Remis</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Le signataire a ouvert le document mais n'a pas encore signé</td><td style="padding:10px;border:1px solid #E5E7EB;">Attendre ou relancer</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#D1FAE5;color:#065F46;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Signé</span></td><td style="padding:10px;border:1px solid #E5E7EB;">La signature a été apposée avec succès. Le document final est archivé.</td><td style="padding:10px;border:1px solid #E5E7EB;">Télécharger le PDF signé</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#FEE2E2;color:#991B1B;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Refusé</span></td><td style="padding:10px;border:1px solid #E5E7EB;">Le signataire a décliné la signature du document</td><td style="padding:10px;border:1px solid #E5E7EB;">Contacter le signataire, renvoyer</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;"><span style="background:#F3F4F6;color:#6B7280;padding:2px 8px;border-radius:9999px;font-size:0.85em;">Annulé</span></td><td style="padding:10px;border:1px solid #E5E7EB;">La demande a été annulée par l'expéditeur avant signature</td><td style="padding:10px;border:1px solid #E5E7EB;">Créer une nouvelle demande</td></tr>
</tbody>
</table>

<h3>Annuler une demande de signature</h3>
<p>Tant que le document n'a pas été signé, vous pouvez annuler la demande à tout moment :</p>
${stepBlock(1, "Accédez à la fiche bail", "Section <strong>Signature électronique</strong>, repérez la demande en cours (statut Envoyé ou Remis).")}
${stepBlock(2, "Cliquez sur la demande", "Les détails s'affichent : signataire, date d'envoi, statut actuel.")}
${stepBlock(3, "Annulez la demande", "Cliquez sur <strong>Annuler</strong>, puis renseignez le motif d'annulation. Le signataire est notifié automatiquement par email et le lien de signature est désactivé immédiatement.")}
${infoBox("warning", "Une demande déjà signée (statut Signé) ne peut pas être annulée. Le document signé a valeur juridique.")}

<h3>Où retrouver vos signatures dans MyGestia ?</h3>
<ul>
<li><strong>Fiche bail → Signature électronique</strong> : historique complet de toutes les demandes de signature pour ce bail, avec statut en temps réel, nom du signataire, date d'envoi et date de signature</li>
<li><strong>GED (Documents)</strong> : les documents signés sont automatiquement archivés et classés dans la catégorie correspondante (bail, état des lieux, mandat)</li>
<li><strong>Journal d'audit</strong> : chaque envoi, ouverture, signature, refus et annulation est tracé dans <strong>Administration &gt; Audit</strong></li>
</ul>
${infoBox("tip", "Depuis la fiche d'un bail, vous pouvez envoyer directement le contrat à la signature électronique <strong>en un seul clic</strong>, sans quitter la page. Le nom et l'email du locataire sont pré-remplis automatiquement.")}

<h2>Analyse IA des documents</h2>
<p>MyGestia utilise l'intelligence artificielle (Claude d'Anthropic) pour analyser automatiquement vos documents et vous faire gagner du temps dans le classement et la recherche.</p>
${stepBlock(1, "Uploadez un document", "Lors de l'ajout d'un fichier dans la GED, l'analyse IA se déclenche <strong>automatiquement en arrière-plan</strong>. Vous pouvez continuer à travailler pendant l'analyse.")}
${stepBlock(2, "L'IA lit et comprend le document", "Le contenu du document est analysé par l'IA qui en extrait : un <strong>résumé court</strong> (2-3 phrases), des <strong>mots-clés</strong> pertinents et la <strong>catégorie</strong> la plus adaptée parmi les 9 catégories disponibles.")}
${stepBlock(3, "Résultat visible dans la GED", "Un <strong>badge IA</strong> apparaît sur le document. Cliquez dessus pour voir le résumé, les tags et la catégorie proposée. Vous pouvez corriger la catégorie si nécessaire.")}
<p><strong>9 catégories détectées automatiquement :</strong> bail, avenant, quittance, facture, diagnostic, assurance, titre de propriété, contrat, état des lieux.</p>
${infoBox("info", "L'analyse IA est disponible sur le <strong>plan Enterprise</strong>. Elle nécessite une clé API Anthropic configurée par l'administrateur.")}

<h3>Poser des questions sur un document (Chat IA)</h3>
<p>Vous pouvez <strong>poser des questions en langage naturel</strong> directement sur le contenu d'un document analysé. Depuis la GED, ouvrez un document et utilisez la fonction <strong>Chat</strong>.</p>
<p><strong>Exemples de questions :</strong></p>
<ul>
<li>&laquo; Quelle est la durée de ce bail ? &raquo;</li>
<li>&laquo; Quel est le montant du loyer mensuel ? &raquo;</li>
<li>&laquo; Quelles sont les conditions de résiliation ? &raquo;</li>
<li>&laquo; Ce diagnostic est-il encore valide ? &raquo;</li>
</ul>

<h2>Navigation et recherche dans la GED</h2>
<p>La GED (Gestion Électronique des Documents) offre plusieurs modes de navigation pour retrouver rapidement vos fichiers :</p>

<h3>Arborescence latérale</h3>
<p>Un panneau latéral affiche l'arborescence de votre patrimoine : immeubles &gt; lots. Cliquez sur un élément pour filtrer les documents rattachés à cet immeuble ou ce lot spécifique. Les documents généraux (non rattachés) sont accessibles via la racine.</p>

<h3>Modes d'affichage</h3>
<ul>
<li><strong>Vue liste</strong> : affichage détaillé avec nom, catégorie, date, taille, statut IA et actions. Idéal pour parcourir de nombreux documents.</li>
<li><strong>Vue grille</strong> : affichage en cartes avec aperçu visuel. Idéal pour les documents visuels (photos, plans).</li>
</ul>

<h3>Recherche et filtres</h3>
<ul>
<li><strong>Recherche par nom</strong> : barre de recherche en haut de la GED</li>
<li><strong>Recherche globale</strong> : <strong>Ctrl+K</strong> depuis n'importe quelle page de l'application</li>
<li><strong>Tri</strong> : par nom, date d'ajout, catégorie ou taille de fichier</li>
<li><strong>Filtrage par expiration</strong> : badges <span style="color:#D97706;">orange</span> (expire dans 90 jours) ou <span style="color:#DC2626;">rouge</span> (expiré)</li>
<li><strong>Filtrage par entité</strong> : depuis la fiche d'un immeuble, bail ou locataire, section Documents</li>
</ul>

<h3>Aperçu et prévisualisation</h3>
<p>Cliquez sur un document pour ouvrir le <strong>panneau de prévisualisation</strong> sans quitter la GED. Les fichiers PDF et les images s'affichent directement. Vous pouvez aussi modifier les métadonnées (catégorie, description, date d'expiration) depuis ce panneau.</p>

<h2>Sécurité des documents</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Mesure de sécurité</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Détails</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Stockage chiffré</td><td style="padding:10px;border:1px solid #E5E7EB;">Infrastructure européenne Supabase (Frankfurt, Allemagne). Données au repos chiffrées.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">URLs signées temporaires</td><td style="padding:10px;border:1px solid #E5E7EB;">Chaque lien de téléchargement expire après <strong>5 minutes</strong>. Impossible de partager un lien permanent.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Contrôle d'accès strict</td><td style="padding:10px;border:1px solid #E5E7EB;">Seuls les utilisateurs membres de la société peuvent voir les documents. Isolation complète entre sociétés.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Journal d'audit</td><td style="padding:10px;border:1px solid #E5E7EB;">Chaque upload, consultation, modification et suppression est tracé avec l'utilisateur, la date et l'action.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Dataroom isolée</td><td style="padding:10px;border:1px solid #E5E7EB;">Les partenaires externes ne voient <strong>que</strong> les documents explicitement ajoutés à leur Dataroom.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Upload sécurisé</td><td style="padding:10px;border:1px solid #E5E7EB;">Protocole TUS avec upload signé (signed URL). Le fichier transite directement vers le stockage sans passer par le serveur applicatif.</td></tr>
</tbody>
</table>

<h2>Questions fréquentes</h2>
${faqItem("Quels formats de fichiers sont acceptés ?", "PDF, JPG, PNG, WebP et Word (DOC/DOCX). Taille maximale : <strong>20 Mo</strong> par fichier. L'upload par morceaux (TUS) garantit la fiabilité même pour les gros fichiers.")}
${faqItem("Comment uploader un dossier entier ?", "Documents &gt; Ajouter &gt; basculez en mode <strong>Dossier</strong>. Sélectionnez un dossier complet, chaque fichier sera uploadé individuellement avec sa propre barre de progression.")}
${faqItem("Comment partager des documents avec un notaire ou une banque ?", "Créez une <strong>Dataroom</strong> : ajoutez les documents à partager, configurez un mot de passe et une date d'expiration, puis activez le lien. Le destinataire consulte les documents depuis son navigateur sans se connecter à MyGestia.")}
${faqItem("Comment configurer un mot de passe sur une Dataroom ?", "Lors de la création ou modification de la Dataroom, renseignez le champ Mot de passe. Le destinataire devra le saisir pour accéder aux documents. Le mot de passe est chiffré en bcrypt.")}
${faqItem("Comment savoir qui a consulté ma Dataroom ?", "Fiche Dataroom &gt; section <strong>Journal d'accès</strong>. Chaque consultation est enregistrée avec : nom du visiteur, email, adresse IP et date/heure.")}
${faqItem("Comment fonctionne la signature électronique ?", "Depuis la fiche bail &gt; Signature électronique &gt; Envoyer. Renseignez nom et email du signataire. Il reçoit un lien DocuSign sécurisé et signe depuis son navigateur <strong>sans créer de compte</strong>. Le document signé est archivé automatiquement.")}
${faqItem("La signature électronique a-t-elle une valeur légale ?", "Oui, conforme au <strong>règlement européen eIDAS</strong> et reconnue par la loi française. La signature électronique DocuSign a la même valeur juridique qu'une signature manuscrite.")}
${faqItem("Comment annuler une demande de signature ?", "Fiche bail &gt; Signature électronique &gt; cliquez sur la demande &gt; <strong>Annuler</strong>. Renseignez le motif. Le signataire est notifié et le lien est désactivé. Possible uniquement tant que le document n'est pas signé.")}
${faqItem("Comment retrouver un document précis ?", "4 façons : <strong>Ctrl+K</strong> (recherche globale), barre de recherche dans la GED, arborescence latérale (par immeuble/lot), ou filtrage par catégorie. Les documents arrivant à expiration sont signalés par des badges colorés.")}
${faqItem("Les documents sont-ils sauvegardés automatiquement ?", "Oui, stockés sur infrastructure européenne sécurisée (Supabase Frankfurt) avec redondance. Aucune sauvegarde manuelle nécessaire.")}
${faqItem("Comment révoquer l'accès à une Dataroom ?", "Deux options : <strong>Archiver</strong> la Dataroom (le lien est désactivé, les documents restent consultables en interne) ou <strong>Supprimer</strong> la Dataroom (uniquement si elle est en brouillon ou archivée).")}
${faqItem("Puis-je classer automatiquement mes documents ?", "Oui, l'<strong>analyse IA</strong> (plan Enterprise) catégorise automatiquement vos documents en 9 catégories : bail, avenant, quittance, facture, diagnostic, assurance, titre de propriété, contrat, état des lieux. L'IA génère aussi un résumé et des mots-clés.")}
${faqItem("Puis-je poser des questions sur le contenu d'un document ?", "Oui, la fonction <strong>Chat IA</strong> (plan Enterprise) permet d'interroger le contenu d'un document en langage naturel. Exemple : &laquo; Quelle est la durée du bail ? &raquo;, &laquo; Quel est le montant du loyer ? &raquo;.")}
${faqItem("Comment supprimer un document ?", "Depuis la GED, ouvrez le document et cliquez sur <strong>Supprimer</strong>. Le fichier est supprimé du stockage et de la base de données. Cette action est irréversible.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 10 : Tableau de bord et rapports
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Tableau de bord et rapports",
    description:
      "KPI en temps réel, graphiques interactifs et rapports exportables.",
    articles: [
      {
        title: "Dashboard, indicateurs clés et rapports",
        body: `
<h2>Indicateurs clés (KPI)</h2>
<p>Le tableau de bord affiche 4 indicateurs principaux, mis à jour en temps réel :</p>
<ul>
<li><strong>Revenus du mois</strong> : montant des loyers perçus, avec variation vs mois précédent (flèche verte/rouge)</li>
<li><strong>Taux d'occupation</strong> : pourcentage de lots occupés, avec barre de progression</li>
<li><strong>Impayés</strong> : montant total des factures en retard (affiché en rouge si &gt; 0)</li>
<li><strong>Trésorerie / Rendement</strong> : solde disponible ou rendement brut annualisé</li>
</ul>

<h2>Synthèse de l'endettement</h2>
<p>Si vous avez des emprunts en cours : capital restant dû, mensualité totale, ratio LTV et tableau récapitulatif par prêteur avec barre de progression du remboursement.</p>

<h2>6 graphiques interactifs</h2>
<ul>
<li><strong>Revenus mensuels</strong> : courbe d'évolution sur 12 mois</li>
<li><strong>Occupation par immeuble</strong> : barres lots occupés vs vacants</li>
<li><strong>Impayés par ancienneté</strong> : répartition 0-30j, 30-60j, 60j+</li>
<li><strong>Évolution du patrimoine</strong> : courbe de la valeur totale</li>
<li><strong>Concentration des risques</strong> : poids de chaque locataire dans les revenus (alerte si &gt; 30%)</li>
<li><strong>Timeline des baux</strong> : échéances à venir (rouge &lt; 3 mois, orange &lt; 6 mois)</li>
</ul>

<h2>Panneau de monitoring détaillé</h2>
<p>6 catégories d'indicateurs détaillés :</p>
<ul>
<li><strong>Patrimoine</strong> : immeubles, lots, taux d'occupation, valeur estimée, rendement brut</li>
<li><strong>Locataires et baux</strong> : locataires actifs, baux en cours, baux expirant bientôt</li>
<li><strong>Facturation</strong> : loyer mensuel HT, factures impayées, montant des impayés</li>
<li><strong>Trésorerie</strong> : solde disponible (vert si positif, rouge si négatif)</li>
<li><strong>Technique</strong> : diagnostics expirant, maintenances ouvertes</li>
<li><strong>Endettement</strong> : capital restant dû, mensualité totale, nombre de prêts, ratio LTV</li>
</ul>

<h2>Tâches du jour</h2>
<p>La section <strong>Tâches du jour</strong> affiche les actions urgentes : factures à valider, relances à envoyer, diagnostics expirant, baux à renouveler. Chaque tâche est cliquable et redirige vers l'écran correspondant.</p>

<h2>Rapports et exports</h2>
<p>MyGestia propose <strong>9 types de rapports</strong> couvrant tous les aspects de la gestion immobilière. Chaque rapport est générable à la demande ou planifiable pour un envoi automatique par email.</p>

<h3>Les 9 rapports disponibles</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Rapport</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Contenu</th>
<th style="text-align:center;padding:10px;border:1px solid #E5E7EB;">Format</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Catégorie</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Situation locative</td><td style="padding:10px;border:1px solid #E5E7EB;">Occupation de chaque lot par immeuble : locataire, loyer, dates du bail, statut</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">PDF</td><td style="padding:10px;border:1px solid #E5E7EB;">Patrimoine</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Vacance locative</td><td style="padding:10px;border:1px solid #E5E7EB;">Taux de vacance par immeuble, durée moyenne de vacance, impact financier</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">PDF</td><td style="padding:10px;border:1px solid #E5E7EB;">Patrimoine</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Compte-rendu de gestion</td><td style="padding:10px;border:1px solid #E5E7EB;">Synthèse annuelle : revenus, charges, résultat net, occupation, événements</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">PDF</td><td style="padding:10px;border:1px solid #E5E7EB;">Comptabilité</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Balance âgée</td><td style="padding:10px;border:1px solid #E5E7EB;">Impayés par tranche d'ancienneté (0-30j, 30-60j, 60-90j, 90j+) par locataire</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">PDF</td><td style="padding:10px;border:1px solid #E5E7EB;">Comptabilité</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">État des impayés</td><td style="padding:10px;border:1px solid #E5E7EB;">Liste détaillée des factures impayées : locataire, montant, jours de retard, relances envoyées</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">PDF / Excel</td><td style="padding:10px;border:1px solid #E5E7EB;">Comptabilité</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Suivi mensuel</td><td style="padding:10px;border:1px solid #E5E7EB;">Tableau de bord mensuel par immeuble : encaissements, charges, solde, occupation</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">PDF</td><td style="padding:10px;border:1px solid #E5E7EB;">Comptabilité</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Rentabilité par lot</td><td style="padding:10px;border:1px solid #E5E7EB;">Revenus annuels par lot, rendement brut, comparaison entre lots</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">Excel</td><td style="padding:10px;border:1px solid #E5E7EB;">Comptabilité</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Récap charges locataire</td><td style="padding:10px;border:1px solid #E5E7EB;">Détail des charges par locataire : provisions versées, charges réelles, solde</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">PDF</td><td style="padding:10px;border:1px solid #E5E7EB;">Par locataire</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Suivi travaux</td><td style="padding:10px;border:1px solid #E5E7EB;">Liste des interventions annuelles : nature, prestataire, coût, statut</td><td style="text-align:center;padding:10px;border:1px solid #E5E7EB;">Excel</td><td style="padding:10px;border:1px solid #E5E7EB;">Travaux</td></tr>
</tbody>
</table>

<h3>Générer un rapport</h3>
${stepBlock(1, "Accédez aux rapports", "Menu latéral &gt; <strong>Rapports</strong>. Les rapports sont organisés par catégorie : Patrimoine, Comptabilité, Par locataire, Travaux.")}
${stepBlock(2, "Sélectionnez le type de rapport", "Choisissez le rapport souhaité et renseignez les paramètres : <strong>année</strong>, <strong>format</strong> (PDF ou Excel) et, si applicable, le <strong>locataire</strong> ou l'<strong>immeuble</strong> concerné.")}
${stepBlock(3, "Générez et téléchargez", "Cliquez sur <strong>Générer</strong>. Le rapport est créé en temps réel et téléchargé automatiquement.")}

<h3>Planifier l'envoi automatique de rapports</h3>
${stepBlock(1, "Accédez à la planification", "<strong>Rapports &gt; Planification</strong>.")}
${stepBlock(2, "Créez une planification", "Définissez : le type de rapport, la fréquence (hebdomadaire, mensuelle, trimestrielle), les destinataires (emails) et le format.")}
${stepBlock(3, "Envoi automatique", "Les rapports sont générés et envoyés par email selon la fréquence définie, sans aucune action manuelle.")}
${infoBox("tip", "Depuis la <strong>Vue Propriétaire</strong>, vous pouvez aussi générer des rapports consolidés qui regroupent les données de toutes vos sociétés.")}

<h2>Questions fréquentes</h2>
${faqItem("Comment personnaliser mon tableau de bord ?", "Le dashboard affiche les données de la société active. Changez de société via le sélecteur en haut de page.")}
${faqItem("Les données sont-elles en temps réel ?", "Oui, KPI et graphiques sont recalculés à chaque chargement de la page.")}
${faqItem("Comment voir les données de toutes mes sociétés ?", "Utilisez la <strong>Vue Propriétaire</strong> qui consolide les données de toutes vos sociétés.")}
${faqItem("Comment exporter un rapport en PDF ?", "<strong>Rapports</strong> &gt; sélectionnez le type et la période &gt; Générer. Le PDF est téléchargé automatiquement.")}
${faqItem("Quels types de rapports sont disponibles ?", "9 types : balance âgée, compte-rendu de gestion, état des impayés, rentabilité par lot, récap charges locataire, situation locative, suivi mensuel, suivi travaux et vacance locative.")}
${faqItem("Comment planifier l'envoi automatique de rapports ?", "<strong>Rapports &gt; Planification</strong>. Définissez le type, la fréquence et les destinataires.")}
${faqItem("Que signifie le taux d'occupation ?", "Pourcentage de lots occupés par un bail actif. 100% = tous les lots loués. Alerte orange en dessous de 80%.")}
${faqItem("Comment interpréter la concentration des risques ?", "Si un locataire représente plus de 30% de vos revenus, c'est un risque. Diversifiez votre base locative.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 11 : Sécurité et confidentialité
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Sécurité et confidentialité",
    description:
      "Protection des données, RGPD, 2FA et portail locataire.",
    articles: [
      {
        title: "Sécurité des données et conformité RGPD",
        body: `
<h2>Chiffrement des données sensibles</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Données</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Protection</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Détails</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">IBAN / BIC</td><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">AES-256-GCM</td><td style="padding:10px;border:1px solid #E5E7EB;">Standard de chiffrement le plus sûr. Déchiffrées uniquement à l'affichage ou génération PDF.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">Mots de passe</td><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">bcrypt (12 rounds)</td><td style="padding:10px;border:1px solid #E5E7EB;">Hachage irréversible. Impossibles à retrouver même en cas de fuite.</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">Sessions</td><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">JWT signé, 24h</td><td style="padding:10px;border:1px solid #E5E7EB;">Expiration automatique, nouvelle connexion requise.</td></tr>
</tbody>
</table>

<h2>Authentification à deux facteurs (2FA)</h2>
<p>La 2FA ajoute une couche de sécurité supplémentaire. Même avec votre mot de passe, impossible de se connecter sans le code 2FA.</p>
${stepBlock(1, "Activez la 2FA", "<strong>Paramètres &gt; Sécurité &gt; Activer la 2FA</strong>")}
${stepBlock(2, "Scannez le QR code", "Avec une application d'authentification : Google Authenticator, Authy, Microsoft Authenticator, etc.")}
${stepBlock(3, "Confirmez avec un code", "Entrez le code à 6 chiffres pour confirmer. Conservez vos codes de récupération (format XXXXX-XXXXX).")}
${infoBox("warning", "Si vous perdez l'accès à votre application d'authentification, les <strong>codes de récupération</strong> sont le seul moyen de vous reconnecter. Notez-les dans un endroit sûr.")}

<h2>Sécurité de l'application web</h2>
<ul>
<li><strong>HTTPS obligatoire</strong> : communications chiffrées en transit</li>
<li><strong>HSTS</strong> : force l'utilisation de HTTPS</li>
<li><strong>CSP (Content Security Policy)</strong> : empêche l'injection de scripts malveillants</li>
<li><strong>X-Frame-Options</strong> : protection contre le clickjacking</li>
<li><strong>Rate limiting</strong> : 3 tentatives de connexion par 10 secondes, 10 requêtes API par 10 secondes</li>
<li><strong>Nonce CSP</strong> : jeton unique par page pour les scripts inline</li>
</ul>

<h2>Conformité RGPD</h2>
<p>MyGestia est 100% conforme au Règlement Général sur la Protection des Données. Module dédié accessible depuis le menu <strong>RGPD</strong>.</p>

<h3>Droits des personnes</h3>
<ul>
<li><strong>Droit d'accès</strong> : connaître les données le concernant</li>
<li><strong>Droit de rectification</strong> : correction des données inexactes</li>
<li><strong>Droit de suppression</strong> : effacement (dans les limites légales)</li>
<li><strong>Droit de portabilité</strong> : export dans un format lisible</li>
<li><strong>Droit d'opposition</strong> : opposition au traitement</li>
</ul>

<h3>Durées de conservation</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Type de données</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Durée</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">Locataire actif</td><td style="padding:10px;border:1px solid #E5E7EB;">Durée du bail</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">Locataire archivé</td><td style="padding:10px;border:1px solid #E5E7EB;">5 ans après fin de bail</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">Pièces d'identité</td><td style="padding:10px;border:1px solid #E5E7EB;">3 ans après fin de relation</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">Données bancaires</td><td style="padding:10px;border:1px solid #E5E7EB;">10 ans (obligation légale comptable)</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">Logs d'activité</td><td style="padding:10px;border:1px solid #E5E7EB;">1 an</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;">Consentements</td><td style="padding:10px;border:1px solid #E5E7EB;">3 ans après révocation</td></tr>
</tbody>
</table>

<h2>Portail locataire</h2>
<p>Chaque locataire dispose d'un <strong>portail personnel sécurisé</strong>, totalement indépendant de l'application principale. Le locataire n'a pas besoin de compte MyGestia : il se connecte via un lien individuel envoyé par email.</p>

<h3>Activer le portail pour un locataire</h3>
${stepBlock(1, "Accédez à la fiche locataire", "Menu <strong>Locataires</strong> &gt; cliquez sur le locataire concerné.")}
${stepBlock(2, "Activez le portail", "Cliquez sur <strong>Activer le portail</strong>. Un email d'invitation est envoyé automatiquement à l'adresse email du locataire.")}
${stepBlock(3, "Première connexion du locataire", "Le locataire reçoit un email avec un lien d'activation. Il crée son accès (aucun mot de passe nécessaire) et accède directement à son espace personnel.")}

<h3>Connexion sécurisée en 2 étapes</h3>
<p>Le portail utilise une authentification par <strong>code à usage unique</strong>, sans mot de passe :</p>
${stepBlock(1, "Le locataire saisit son email", "Sur la page de connexion du portail, il entre l'adresse email associée à son bail.")}
${stepBlock(2, "Il reçoit un code à 6 chiffres", "Un code de vérification est envoyé instantanément par email. Ce code est valable quelques minutes.")}
${stepBlock(3, "Il saisit le code et accède au portail", "La session est ouverte pour <strong>24 heures</strong> (token JWT sécurisé, cookie httpOnly).")}
${infoBox("info", "Pas de mot de passe à retenir ni à réinitialiser. Le locataire se connecte toujours via un code envoyé par email, ce qui est plus sécurisé qu'un mot de passe classique.")}

<h3>Ce que le locataire voit sur son portail</h3>
<p>Le portail offre 5 sections principales :</p>

<p><strong>1. Tableau de bord</strong></p>
<ul>
<li>Résumé de ses baux actifs (adresse, loyer, dates)</li>
<li>Montant des factures impayées avec alerte visuelle</li>
<li>Statut de son attestation d'assurance (valide, expirant, expirée)</li>
<li>Coordonnées du gestionnaire pour le contacter</li>
</ul>

<p><strong>2. Mes documents</strong></p>
<ul>
<li>Accès à toutes ses factures et quittances de loyer</li>
<li>Téléchargement des PDF en un clic</li>
<li>Historique complet de la facturation</li>
</ul>

<p><strong>3. Mes charges</strong></p>
<ul>
<li>Détail des charges par bail</li>
<li>Ventilation par catégorie de charges</li>
<li>Historique des provisions versées</li>
</ul>

<p><strong>4. Mon assurance</strong></p>
<ul>
<li>Statut actuel de l'attestation d'assurance</li>
<li>Formulaire d'upload pour envoyer une nouvelle attestation</li>
<li>Alertes automatiques si l'assurance est expirée ou proche de l'expiration</li>
</ul>

<p><strong>5. Mes tickets de support</strong></p>
<ul>
<li>Créer une demande de support (signaler un problème, poser une question)</li>
<li>Suivre l'avancement de ses tickets</li>
<li>Échanger des messages avec le gestionnaire</li>
<li>Consulter l'historique des demandes passées</li>
</ul>

${infoBox("warning", "Le portail est <strong>totalement isolé</strong>. Un locataire ne peut voir que ses propres données : ses baux, ses factures, ses documents. Il n'a aucun accès aux données d'autres locataires ni aux données de gestion.")}

<h3>Gestion multi-société</h3>
<p>Si un locataire a des baux dans plusieurs sociétés gérées par le même propriétaire, il accède à toutes ses locations depuis un seul portail, avec un sélecteur de société.</p>

<h2>Logs d'activité et audit</h2>
<p>Toutes les actions sont enregistrées : création, modification, suppression, consultation de données sensibles, envoi d'emails, connexions. Accessibles depuis <strong>Mon compte &gt; Activité</strong> ou <strong>Administration &gt; Audit</strong>. Rétention : 1 an.</p>

<h2>Hébergement en Europe</h2>
<ul>
<li><strong>Base de données</strong> : Supabase PostgreSQL (Frankfurt, Allemagne)</li>
<li><strong>Fichiers</strong> : Supabase Storage (Frankfurt, Allemagne)</li>
<li><strong>Application</strong> : Vercel (Edge Network Europe)</li>
<li><strong>Cache</strong> : Upstash Redis (Frankfurt, Allemagne)</li>
<li><strong>Monitoring</strong> : Sentry (serveurs européens)</li>
</ul>
${infoBox("info", "Toutes les données restent en Europe. Aucun transfert de données hors UE n'est effectué.")}

<h2>Questions fréquentes</h2>
${faqItem("Comment activer la double authentification ?", "<strong>Paramètres &gt; Sécurité &gt; Activer la 2FA</strong>. Scannez le QR code avec Google Authenticator ou Authy, puis confirmez avec le code à 6 chiffres.")}
${faqItem("J'ai perdu mon téléphone, comment me reconnecter ?", "Utilisez vos <strong>codes de récupération</strong> fournis lors de l'activation. Si perdus, contactez le support pour une vérification d'identité.")}
${faqItem("Mon compte est verrouillé, que faire ?", "Après 5 tentatives échouées, le compte est verrouillé 15 minutes. Attendez ou réinitialisez votre mot de passe.")}
${faqItem("Mes données sont-elles stockées en France ?", "Les données sont stockées en Europe (Frankfurt, Allemagne) sur infrastructure conforme RGPD. Aucun transfert hors UE.")}
${faqItem("Un locataire peut-il voir les données d'un autre locataire ?", "Non, le portail locataire est totalement isolé. Chaque locataire ne voit que ses propres données.")}
${faqItem("Comment exercer mes droits RGPD ?", "Menu <strong>RGPD &gt; Nouvelle demande</strong>. Choisissez : accès, rectification, suppression ou portabilité.")}
${faqItem("Combien de temps mes données sont-elles conservées ?", "Locataire actif : durée du bail. Archivé : 5 ans. Données bancaires : 10 ans. Logs : 1 an. Consentements : 3 ans après révocation.")}
${faqItem("L'application est-elle conforme RGPD ?", "Oui, 100% conforme : consentement explicite, droits des personnes, registre des traitements, durées de conservation et hébergement européen.")}
${faqItem("Comment fonctionne le timeout d'inactivité ?", "Après <strong>10 minutes</strong> sans activité, un avertissement apparaît. Si aucune action dans la minute suivante, déconnexion automatique.")}
${faqItem("Qui peut voir les logs d'activité ?", "Les administrateurs (Admin Société et Super Admin) voient tous les logs. Les autres utilisateurs ne voient que leur propre activité.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 12 : Courriers et modèles
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Courriers et modèles",
    description:
      "Bibliothèque de modèles de courriers, variables dynamiques et envoi personnalisé.",
    articles: [
      {
        title: "Courriers personnalisés et bibliothèque de modèles",
        body: `
<h2>Bibliothèque de modèles de courriers</h2>
<p>MyGestia inclut une bibliothèque de <strong>plus de 30 modèles de courriers</strong> prêts à l'emploi, classés par catégorie. Chaque modèle utilise des variables dynamiques qui sont automatiquement remplacées par les données réelles de votre société, locataire et bail.</p>

<h3>6 catégories de modèles</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Catégorie</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Exemples de courriers</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Loyer et paiements</td><td style="padding:10px;border:1px solid #E5E7EB;">Appel de loyer, rappel de paiement, mise en demeure, accusé de réception de paiement</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Bail et occupation</td><td style="padding:10px;border:1px solid #E5E7EB;">Congé donné par le bailleur, avis de renouvellement, notification de révision de loyer, attestation de domicile</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Charges</td><td style="padding:10px;border:1px solid #E5E7EB;">Régularisation annuelle de charges, appel de provisions, détail des charges récupérables</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Travaux</td><td style="padding:10px;border:1px solid #E5E7EB;">Avis de travaux, demande d'accès au logement, notification de fin de travaux</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Assurance</td><td style="padding:10px;border:1px solid #E5E7EB;">Demande d'attestation d'assurance, relance assurance expirée, déclaration de sinistre</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Administratif</td><td style="padding:10px;border:1px solid #E5E7EB;">Attestation de loyer, certificat de non-dette, confirmation de résiliation</td></tr>
</tbody>
</table>

<h2>Envoyer un courrier personnalisé</h2>
${stepBlock(1, "Accédez aux courriers", "Menu latéral &gt; <strong>Courriers</strong>. La page affiche la bibliothèque de modèles avec un moteur de recherche et des filtres par catégorie.")}
${stepBlock(2, "Choisissez un modèle", "Parcourez les catégories ou recherchez un modèle par mot-clé. Chaque modèle affiche une description et le nombre de variables dynamiques.")}
${stepBlock(3, "Sélectionnez le destinataire", "Choisissez le locataire ou le bail concerné. Les variables du modèle sont <strong>automatiquement remplies</strong> avec les données réelles.")}
${stepBlock(4, "Personnalisez si nécessaire", "Le texte est entièrement modifiable. Ajustez le contenu, ajoutez des paragraphes ou modifiez les montants avant envoi.")}
${stepBlock(5, "Envoyez ou téléchargez", "Deux options : <strong>Envoyer par email</strong> directement au locataire, ou <strong>Télécharger en PDF</strong> pour impression et envoi postal.")}

<h3>Variables dynamiques disponibles</h3>
<p>Les variables suivantes sont automatiquement remplacées par les données réelles :</p>
<ul>
<li><strong>Société</strong> : nom, adresse complète, SIRET, forme juridique</li>
<li><strong>Locataire</strong> : nom, prénom, adresse, email, téléphone</li>
<li><strong>Bail</strong> : dates de début et fin, loyer HT, charges, dépôt de garantie</li>
<li><strong>Dates</strong> : date du jour, date d'échéance, date de révision</li>
<li><strong>Montants</strong> : loyer, charges, total TTC, solde impayé</li>
</ul>
${infoBox("tip", "Vous pouvez aussi <strong>créer vos propres modèles</strong> personnalisés depuis Courriers &gt; Modèles &gt; Créer. Les modèles personnalisés sont propres à votre société.")}

<h3>Envoi groupé par immeuble</h3>
<p>Besoin d'envoyer le même courrier à tous les locataires d'un immeuble ? Sélectionnez le mode <strong>Envoi par immeuble</strong>. Chaque locataire recevra un courrier personnalisé avec ses propres données (nom, adresse, loyer, etc.).</p>

<h2>Questions fréquentes</h2>
${faqItem("Puis-je créer mes propres modèles de courrier ?", "Oui, <strong>Courriers &gt; Modèles &gt; Créer</strong>. Rédigez votre texte et insérez les variables dynamiques disponibles. Les modèles personnalisés sont propres à votre société.")}
${faqItem("Comment envoyer un courrier à tous les locataires d'un immeuble ?", "Sélectionnez un modèle, puis choisissez le mode <strong>Envoi par immeuble</strong>. Sélectionnez l'immeuble et chaque locataire recevra un courrier personnalisé avec ses propres données.")}
${faqItem("Puis-je envoyer un courrier par email ET le télécharger en PDF ?", "Oui, les deux options sont disponibles pour chaque courrier. Vous pouvez envoyer par email et conserver une copie PDF.")}
${faqItem("Les courriers sont-ils enregistrés dans l'historique ?", "Oui, chaque envoi est tracé dans le journal d'audit avec la date, le destinataire et le type de courrier.")}
${faqItem("Comment modifier un modèle existant ?", "Courriers &gt; Modèles &gt; cliquez sur le modèle &gt; Modifier. Les modèles système ne sont pas modifiables, mais vous pouvez les dupliquer et personnaliser la copie.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 13 : Import et export de données
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Import et export de données",
    description:
      "Importation CSV/Excel, analyse IA de baux PDF et exports de données.",
    articles: [
      {
        title: "Importer et exporter vos données",
        body: `
<h2>Import de données en masse (CSV / Excel)</h2>
<p>Si vous migrez depuis un autre logiciel ou si vous devez créer de nombreux éléments en une fois, le module d'import vous permet de charger vos données depuis un <strong>fichier CSV ou Excel</strong>.</p>

<h3>3 types d'entités importables</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead>
<tr style="background:#F3F4F6;">
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Type</th>
<th style="text-align:left;padding:10px;border:1px solid #E5E7EB;">Colonnes attendues</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Locataires</td><td style="padding:10px;border:1px solid #E5E7EB;">Nom, prénom, email, téléphone → créés en tant que personne physique</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Immeubles</td><td style="padding:10px;border:1px solid #E5E7EB;">Nom, adresse, ville, code postal, type (habitation, bureau, commerce, etc.)</td></tr>
<tr><td style="padding:10px;border:1px solid #E5E7EB;font-weight:500;">Lots</td><td style="padding:10px;border:1px solid #E5E7EB;">Référence/numéro, type, surface, étage, identifiant de l'immeuble</td></tr>
</tbody>
</table>

<h3>Procédure d'import étape par étape</h3>
${stepBlock(1, "Accédez au module d'import", "Menu <strong>Administration &gt; Import</strong>. La page affiche les types d'entités importables et les colonnes attendues.")}
${stepBlock(2, "Sélectionnez le type d'entité", "Choisissez ce que vous importez : locataires, immeubles ou lots.")}
${stepBlock(3, "Uploadez votre fichier", "Glissez-déposez ou parcourez pour sélectionner votre fichier. <strong>Formats acceptés :</strong> CSV (séparateur point-virgule), XLS et XLSX. <strong>Taille maximale :</strong> 10 Mo.")}
${stepBlock(4, "Prévisualisez les données", "Un tableau affiche les premières lignes de votre fichier. Vérifiez que les colonnes correspondent aux champs attendus.")}
${stepBlock(5, "Lancez l'import", "Cliquez sur <strong>Importer</strong>. Chaque ligne est validée individuellement : les lignes valides sont créées, les lignes en erreur sont signalées avec le numéro de ligne et le message d'erreur.")}
${stepBlock(6, "Consultez le résultat", "Un résumé affiche le nombre de lignes importées avec succès et le détail des erreurs éventuelles.")}
${infoBox("warning", "L'import est soumis aux <strong>limites de votre plan</strong>. Si vous atteignez la limite de lots (20 pour Starter, 50 pour Pro), l'import s'arrête et vous en êtes informé.")}

<h2>Import intelligent de bail par IA</h2>
<p>MyGestia peut analyser un <strong>contrat de bail au format PDF</strong> et en extraire automatiquement toutes les informations grâce à l'intelligence artificielle.</p>
${stepBlock(1, "Uploadez le PDF du bail", "Administration &gt; Import &gt; section <strong>Import de bail par IA</strong>. Uploadez le fichier PDF de votre contrat de bail.")}
${stepBlock(2, "L'IA analyse le document", "L'IA (Claude d'Anthropic) lit le contrat et en extrait automatiquement : les informations de l'immeuble et du lot, l'identité du locataire, le type de bail (habitation, commercial, professionnel...), le montant du loyer, la durée, les dates, l'indice de révision, etc.")}
${stepBlock(3, "Vérifiez et validez", "Les données extraites s'affichent dans un formulaire pré-rempli. Vérifiez les informations, corrigez si nécessaire, puis validez. L'immeuble, le lot, le locataire et le bail sont créés en une seule opération.")}
${infoBox("info", "L'import IA de bail est disponible sur le <strong>plan Enterprise</strong>. Il nécessite une clé API Anthropic configurée. L'IA détecte automatiquement le type de bail, la destination, le taux de TVA et le mode de révision.")}

<h2>Exports de données</h2>
<p>Chaque page principale de l'application dispose d'un <strong>bouton d'export</strong> permettant de télécharger les données au format CSV (séparateur point-virgule, format français).</p>

<h3>Données exportables</h3>
<ul>
<li><strong>Locataires</strong> : liste complète avec coordonnées et indicateurs de risque</li>
<li><strong>Baux</strong> : liste des baux avec locataire, lot, loyer, dates et statut</li>
<li><strong>Factures</strong> : historique de facturation avec montants, statuts et dates</li>
<li><strong>Transactions bancaires</strong> : relevé avec dates, montants et statuts de rapprochement</li>
<li><strong>Charges</strong> : détail des charges par catégorie et par immeuble</li>
<li><strong>Contacts</strong> : carnet de contacts complet</li>
</ul>

<h3>Export FEC (Fichier des Écritures Comptables)</h3>
<p>Le FEC est un format réglementaire exigé par l'administration fiscale française. L'export est accessible depuis <strong>Comptabilité &gt; Exports</strong>.</p>
${stepBlock(1, "Sélectionnez l'exercice", "Choisissez l'exercice comptable ou la période souhaitée.")}
${stepBlock(2, "Validez les données", "L'application vérifie automatiquement la cohérence des écritures et signale les anomalies éventuelles.")}
${stepBlock(3, "Téléchargez le fichier", "Format TXT tabulé réglementaire, directement transmissible à votre comptable ou à l'administration fiscale.")}

<h3>Export RGPD complet</h3>
<p>Pour exercer le droit de portabilité, vous pouvez exporter l'intégralité des données d'un locataire depuis <strong>RGPD &gt; Nouvelle demande &gt; Portabilité</strong>. L'export génère une archive structurée contenant toutes les données personnelles.</p>

<h2>Questions fréquentes</h2>
${faqItem("Quels formats de fichiers sont acceptés pour l'import ?", "CSV (séparateur point-virgule), XLS et XLSX. Taille maximale : 10 Mo. Encodage UTF-8 recommandé pour le CSV.")}
${faqItem("Que se passe-t-il si une ligne du fichier contient une erreur ?", "Les lignes valides sont importées normalement. Les lignes en erreur sont signalées avec le numéro de ligne et le message d'erreur. L'import n'est pas bloqué par les erreurs individuelles.")}
${faqItem("Puis-je importer des baux en masse ?", "L'import CSV ne couvre pas les baux (trop de champs complexes). Utilisez l'<strong>import IA de bail par PDF</strong> (plan Enterprise) pour créer un bail complet à partir d'un contrat PDF.")}
${faqItem("Comment exporter mes données en CSV ?", "Chaque page (locataires, baux, factures, etc.) dispose d'un bouton d'export en haut à droite. Le fichier CSV utilise le format français (séparateur point-virgule, virgule décimale).")}
${faqItem("Comment transmettre le FEC à mon comptable ?", "<strong>Comptabilité &gt; Exports &gt; FEC</strong>. Sélectionnez l'exercice et téléchargez. Le fichier est au format réglementaire, directement utilisable.")}
${faqItem("Comment exporter toutes les données d'un locataire (RGPD) ?", "<strong>RGPD &gt; Nouvelle demande &gt; Portabilité</strong>. Sélectionnez le locataire. L'export génère une archive complète de toutes ses données personnelles.")}
`,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 14 : FAQ générale
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "FAQ générale",
    description:
      "Réponses aux questions les plus fréquentes, classées par thème.",
    articles: [
      {
        title: "Questions fréquentes",
        body: `
<h2>Compte et connexion</h2>
${faqItem("Comment ajouter un nouvel utilisateur à ma société ?", "Allez dans Mon compte &gt; Utilisateurs &gt; Créer un utilisateur. Renseignez son nom, prénom et email, puis sélectionnez la ou les sociétés auxquelles il aura accès avec un rôle pour chacune. L'utilisateur recevra un email avec un mot de passe temporaire.")}
${faqItem("Comment réinitialiser mon mot de passe ?", "Sur la page de connexion, cliquez sur &laquo; Mot de passe oublié &raquo; et saisissez votre adresse email. Vous recevrez un lien de réinitialisation valable 24 heures.")}
${faqItem("Comment changer mon adresse email ?", "Allez dans Mon compte &gt; Profil, modifiez le champ Email. Un email de confirmation sera envoyé à la nouvelle adresse.")}
${faqItem("Que se passe-t-il si mon compte est verrouillé ?", "Après 5 tentatives de connexion échouées, votre compte est verrouillé pendant 15 minutes. Attendez ou utilisez &laquo; Mot de passe oublié &raquo;.")}
${faqItem("Comment activer la double authentification (2FA) ?", "Mon compte &gt; Sécurité &gt; Authentification à deux facteurs &gt; Activer. Scannez le QR code avec une application (Google Authenticator, Authy) et saisissez le code à 6 chiffres. Conservez vos codes de récupération.")}

<h2>Abonnement et facturation MyGestia</h2>
${faqItem("L'essai gratuit est-il sans engagement ?", "Oui, 14 jours entièrement gratuits, sans carte bancaire. À la fin, votre compte passe en lecture seule.")}
${faqItem("Quelles sont les différences entre les plans Starter, Pro et Enterprise ?", "<strong>Starter</strong> : 20 lots, 1 société, 2 utilisateurs. <strong>Pro</strong> : 50 lots, 3 sociétés, 5 utilisateurs. <strong>Enterprise</strong> : sans limite + signature électronique, import IA et accès API.")}
${faqItem("Comment changer de plan ?", "Mon compte &gt; Abonnement &gt; Changer de plan. Le changement est immédiat, tarif calculé au prorata.")}
${faqItem("Comment annuler mon abonnement ?", "Mon compte &gt; Abonnement &gt; Annuler. Accès actif jusqu'à la fin de la période de facturation. Données conservées en lecture seule.")}
${faqItem("Que se passe-t-il à la fin de l'essai gratuit ?", "Votre compte passe en lecture seule. Souscrivez à tout moment pour retrouver l'accès complet.")}
${faqItem("Mes données sont-elles supprimées si j'annule ?", "Non, vos données ne sont jamais supprimées lors d'une annulation. Compte en lecture seule. Export CSV disponible.")}

<h2>Gestion du patrimoine</h2>
${faqItem("Comment modifier les informations d'un immeuble ?", "Patrimoine &gt; Immeubles &gt; cliquez sur l'immeuble &gt; bouton Modifier. Les modifications sont tracées dans l'historique d'audit.")}
${faqItem("Comment gérer les diagnostics obligatoires ?", "Fiche immeuble ou lot &gt; onglet Diagnostics. Ajoutez le type (DPE, amiante, plomb...), la date et l'expiration. Alertes automatiques avant échéance.")}
${faqItem("Comment suivre les maintenances et travaux ?", "Fiche immeuble &gt; onglet Maintenances. Créez un suivi avec nature, prestataire, coût et dates.")}
${faqItem("Un lot peut-il avoir plusieurs baux en même temps ?", "Non, un seul bail actif par lot. L'historique des baux passés reste consultable.")}
${faqItem("Puis-je gérer plusieurs sociétés et propriétaires ?", "Oui, selon votre plan. Starter : 1 société, Pro : 3, Enterprise : illimité.")}

<h2>Baux et locataires</h2>
${faqItem("Comment résilier un bail ?", "Baux &gt; ouvrez le bail &gt; Résilier. Indiquez la date et le motif. Un bail résilié ne peut pas être réactivé.")}
${faqItem("Comment renouveler un bail ?", "Résiliez d'abord le bail en cours, puis créez un nouveau bail sur le même lot avec le même locataire.")}
${faqItem("Comment ajouter un avenant au bail ?", "Fiche bail &gt; Ajouter un avenant. Permet de modifier des clauses sans résilier le bail.")}
${faqItem("Comment archiver un locataire ?", "Locataires &gt; cliquez &gt; Archiver. Données conservées 5 ans (obligation RGPD). Consultez les archivés via le filtre.")}
${faqItem("Comment gérer un bail commercial 3/6/9 ?", "Sélectionnez le type Commercial à la création. Renseignez la durée totale (9 ans). Révisions auto avec ILC ou ILAT.")}
${faqItem("Comment sont calculées les révisions de loyer ?", "Indices INSEE (IRL, ILC, ILAT, ICC) synchronisés chaque trimestre. Formule : nouveau loyer = ancien loyer × (nouvel indice / ancien indice).")}

<h2>Facturation et paiements</h2>
${faqItem("Comment générer une quittance de loyer ?", "Facturation &gt; facture payée &gt; Générer la quittance. Le PDF est envoyable par email.")}
${faqItem("Comment créer une facture manuellement ?", "Facturation &gt; Créer une facture. Sélectionnez le bail, la période et le montant. Créée en brouillon.")}
${faqItem("Comment annuler une facture déjà validée ?", "Créez un avoir depuis la fiche facture. Une facture validée ne peut pas être supprimée directement.")}
${faqItem("Comment gérer un paiement partiel ?", "Saisissez le montant effectivement reçu. Statut passe à Partiellement payée, solde restant visible.")}
${faqItem("Comment envoyer une facture par email ?", "Fiche facture &gt; Envoyer par email. PDF généré automatiquement avec logo et coordonnées bancaires.")}
${faqItem("Comment régulariser les charges annuelles ?", "Charges &gt; Régularisation. Comparez provisions versées vs charges réelles. Calcul automatique du complément ou trop-perçu.")}

<h2>Banque et comptabilité</h2>
${faqItem("Comment connecter mon compte bancaire ?", "Banque &gt; Connexion bancaire. Open Banking (Powens ou GoCardless) synchronise automatiquement. Ajout manuel aussi possible.")}
${faqItem("Comment rapprocher mes transactions bancaires ?", "Banque &gt; Rapprochement. Suggestions automatiques. Validez ou ajustez les correspondances.")}
${faqItem("Comment exporter le FEC pour mon comptable ?", "Comptabilité &gt; Export FEC. Sélectionnez l'exercice, cliquez sur Générer. Format réglementaire TXT.")}
${faqItem("Comment créer un exercice comptable ?", "Comptabilité &gt; Exercices &gt; Nouvel exercice. L'exercice précédent doit être clôturé d'abord.")}
${faqItem("Ma banque n'apparaît pas dans la connexion bancaire ?", "Open Banking couvre la majorité des banques françaises et européennes. Import manuel ou CSV en attendant. Contactez contact@mygestia.immo.")}

<h2>Documents et signatures</h2>
${faqItem("Quels formats de fichiers sont acceptés ?", "PDF, JPG, PNG et WEBP. Taille maximale 20 Mo. Stockage chiffré en Europe.")}
${faqItem("Comment partager des documents via la Dataroom ?", "Documents &gt; Dataroom. Créez un espace de partage avec lien sécurisé, date d'expiration configurable.")}
${faqItem("Comment fonctionne la signature électronique ?", "Plan Enterprise. Document &gt; Envoyer en signature. Chaque signataire reçoit un lien sécurisé sans créer de compte.")}

<h2>Portail locataire</h2>
${faqItem("Comment activer le portail pour un locataire ?", "Locataires &gt; fiche locataire &gt; Activer le portail. Email d'invitation envoyé automatiquement.")}
${faqItem("Que peut faire le locataire sur son portail ?", "Consulter factures et quittances, télécharger documents, suivre ses charges, mettre à jour son assurance et créer des tickets.")}
${faqItem("Le locataire a-t-il besoin d'un mot de passe ?", "Non, authentification par lien sécurisé (token JWT). Email &gt; lien de connexion valable 24h &gt; accès direct.")}

<h2>Courriers et modèles</h2>
${faqItem("Comment envoyer un courrier à tous les locataires d'un immeuble ?", "Courriers &gt; sélectionnez un modèle &gt; mode Envoi par immeuble. Chaque locataire reçoit un courrier personnalisé.")}
${faqItem("Comment envoyer un courrier personnalisé ?", "Courriers &gt; Nouveau courrier. Variables dynamiques (nom, adresse, loyer) remplacées automatiquement. Envoi email ou PDF.")}
${faqItem("Puis-je créer mes propres modèles de courrier ?", "Oui, Courriers &gt; Modèles &gt; Créer. Utilisez les variables disponibles. Modèles propres à votre société.")}

<h2>Import et export</h2>
${faqItem("Puis-je importer mes données depuis un autre logiciel ?", "Oui, Administration &gt; Import. Formats CSV ou Excel. Assistant de mappage des colonnes.")}
${faqItem("Comment exporter mes données en CSV ?", "Chaque page dispose d'un bouton d'export en haut à droite. Format français, séparateur point-virgule.")}

<h2>Rapports</h2>
${faqItem("Quels rapports puis-je générer ?", "9 types : balance âgée, compte-rendu de gestion, état des impayés, rentabilité par lot, récap charges locataire, situation locative, suivi mensuel, suivi travaux et vacance locative. Envois automatiques planifiables.")}

<h2>Sécurité et RGPD</h2>
${faqItem("Mes données sont-elles sécurisées ?", "Oui. Données bancaires chiffrées AES-256-GCM, mots de passe bcrypt, HTTPS avec en-têtes de sécurité stricts. Hébergement en Europe.")}
${faqItem("Que couvre la conformité RGPD ?", "Module RGPD pour consulter, exporter et supprimer les données personnelles. Durées de conservation légales respectées. Registre des traitements accessible.")}

<h2>Technique et dépannage</h2>
${faqItem("L'application est lente, que faire ?", "Vérifiez votre connexion. Videz le cache navigateur (Ctrl+Shift+Suppr). Essayez un autre navigateur. Si persistant, contactez le support.")}
${faqItem("Je ne reçois pas les emails de l'application", "Vérifiez le dossier spam. Ajoutez contact@mygestia.immo et noreply@mygestia.immo à vos contacts.")}
${faqItem("Comment exporter toutes mes données ?", "Chaque module a un export CSV. Pour un export complet : RGPD &gt; Export des données (archive complète structurée).")}
${faqItem("Comment contacter le support ?", "Envoyez un email à <strong>contact@mygestia.immo</strong>. Les clients Enterprise bénéficient d'un support prioritaire.")}
`,
      },
    ],
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   MyGestia — Synchronisation Zendesk Help Center       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\nSubdomain : ${SUBDOMAIN}`);
  console.log(`Email     : ${EMAIL}`);
  console.log(`Locale    : ${LOCALE}\n`);

  // 1. Créer la catégorie
  console.log("━━━ Étape 1 : Catégorie ━━━");
  const category = await ensureCategory(CATEGORY_NAME, CATEGORY_DESC);

  // 2. Créer les sections et articles
  console.log("\n━━━ Étape 2 : Sections et articles ━━━");
  let sectionCount = 0;
  let articleCount = 0;

  for (let i = 0; i < SECTIONS.length; i++) {
    const sec = SECTIONS[i];
    console.log(`\n[${i + 1}/${SECTIONS.length}] Section : ${sec.name}`);

    const section = await ensureSection(
      category.id,
      sec.name,
      sec.description,
      i
    );
    sectionCount++;

    for (let j = 0; j < sec.articles.length; j++) {
      const art = sec.articles[j];
      await ensureArticle(section.id, art.title, art.body, j);
      articleCount++;
    }
  }

  // 3. Résumé
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   Synchronisation terminée                             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Catégorie : 1`);
  console.log(`  Sections  : ${sectionCount}`);
  console.log(`  Articles  : ${articleCount}`);
  console.log(
    `\n  URL : https://${SUBDOMAIN}.zendesk.com/hc/fr/categories/${category.id}\n`
  );
}

main().catch((err) => {
  console.error("\n❌ Erreur fatale :", err.message);
  process.exit(1);
});
