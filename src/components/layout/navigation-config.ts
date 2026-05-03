import {
  Activity,
  BarChart,
  BarChart3,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Building,
  Building2,
  ClipboardCheck,
  Code,
  Contact,
  FileBarChart,
  FileText,
  FolderLock,
  FolderOpen,
  HelpCircle,
  Home,
  Landmark,
  Layers,
  Mail,
  MessageSquare,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  UmbrellaOff,
  Upload,
  UserSearch,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const DASHBOARD_ITEM: NavItem = {
  name: "Dashboard",
  href: "/dashboard",
  icon: BarChart3,
};

export const PRIMARY_NAV_GROUPS: NavGroup[] = [
  {
    title: "Patrimoine",
    items: [
      { name: "Vue d'ensemble", href: "/patrimoine", icon: Home },
      { name: "Propriétaires", href: "/proprietaire", icon: BriefcaseBusiness },
      { name: "Sociétés", href: "/societes", icon: Building },
      { name: "Immeubles", href: "/patrimoine/immeubles", icon: Building2 },
      { name: "Lots", href: "/patrimoine/lots", icon: Layers },
      { name: "Évaluations IA", href: "/patrimoine/evaluations", icon: Bot },
      { name: "Copropriété", href: "/copropriete", icon: Building },
      { name: "Saisonnier", href: "/saisonnier", icon: UmbrellaOff },
    ],
  },
  {
    title: "Location",
    items: [
      { name: "Vue d'ensemble", href: "/location", icon: Home },
      { name: "Mise en location", href: "/location/mise-en-location", icon: ClipboardCheck },
      { name: "Gestion des baux", href: "/baux", icon: FileText },
      { name: "Import bail PDF", href: "/baux/import", icon: Upload },
      { name: "Modèles de bail", href: "/baux/modeles", icon: FileText },
      { name: "Locataires", href: "/locataires", icon: Users },
      { name: "Facturation", href: "/facturation", icon: Receipt },
      { name: "Charges", href: "/charges", icon: ScrollText },
      { name: "Révisions", href: "/baux/revisions", icon: TrendingUp },
      { name: "Relances", href: "/relances", icon: Mail },
      { name: "Candidatures", href: "/candidatures", icon: UserSearch },
      { name: "Tickets", href: "/tickets", icon: MessageSquare },
    ],
  },
  {
    title: "Finances",
    items: [
      { name: "Vue d'ensemble", href: "/finances", icon: BarChart3 },
      { name: "Banque", href: "/banque", icon: Landmark },
      { name: "Factures fournisseurs", href: "/banque/factures-fournisseurs", icon: Package },
      { name: "Décompte de gestion tiers", href: "/releves-gestion", icon: FileText },
      { name: "Emprunts", href: "/emprunts", icon: Wallet },
      { name: "Comptabilité", href: "/comptabilite", icon: BookOpen },
      { name: "Cash-flow", href: "/cashflow", icon: BarChart3 },
      { name: "Prévisionnel", href: "/comptabilite/previsionnel", icon: BarChart3 },
      { name: "Indices INSEE", href: "/indices", icon: BarChart },
    ],
  },
  {
    title: "Documents",
    items: [
      { name: "Documents", href: "/documents", icon: FolderOpen },
      { name: "Dataroom", href: "/dataroom", icon: FolderLock },
      { name: "Courriers", href: "/courriers", icon: Mail },
      { name: "Rapports", href: "/rapports", icon: FileBarChart },
      { name: "Import données", href: "/import", icon: Upload },
    ],
  },
  {
    title: "Automatisation",
    items: [
      { name: "Assistant IA", href: "/assistant", icon: Sparkles },
      { name: "Workflows", href: "/workflows", icon: Workflow },
      { name: "API / Développeurs", href: "/api-docs", icon: Code },
    ],
  },
];

function pickTopNavGroup(title: string, itemNames: string[]): NavGroup {
  const group = PRIMARY_NAV_GROUPS.find((navGroup) => navGroup.title === title);
  if (!group) throw new Error(`Navigation group not found: ${title}`);

  const itemsByName = new Map(group.items.map((item) => [item.name, item]));
  return {
    title,
    items: itemNames.map((name) => {
      const item = itemsByName.get(name);
      if (!item) throw new Error(`Navigation item not found: ${title} / ${name}`);
      return item;
    }),
  };
}

export const TOP_NAV_GROUPS: NavGroup[] = [
  pickTopNavGroup("Patrimoine", [
    "Vue d'ensemble",
    "Immeubles",
    "Lots",
    "Sociétés",
    "Propriétaires",
    "Évaluations IA",
  ]),
  pickTopNavGroup("Location", [
    "Vue d'ensemble",
    "Mise en location",
    "Gestion des baux",
    "Locataires",
    "Facturation",
    "Charges",
    "Tickets",
  ]),
  pickTopNavGroup("Finances", [
    "Vue d'ensemble",
    "Banque",
    "Factures fournisseurs",
    "Décompte de gestion tiers",
    "Emprunts",
    "Comptabilité",
    "Cash-flow",
  ]),
  pickTopNavGroup("Documents", [
    "Documents",
    "Dataroom",
    "Courriers",
    "Rapports",
    "Import données",
  ]),
  pickTopNavGroup("Automatisation", [
    "Assistant IA",
    "Workflows",
    "API / Développeurs",
  ]),
];

export const SECONDARY_NAV_GROUPS: NavGroup[] = [
  {
    title: "Compte et administration",
    items: [
      { name: "Paramètres", href: "/parametres", icon: Settings },
      { name: "Supervision", href: "/administration/supervision", icon: Activity },
      { name: "RGPD", href: "/rgpd", icon: Shield },
      { name: "Contacts", href: "/contacts", icon: Contact },
      { name: "Centre d'aide", href: "/aide", icon: HelpCircle },
    ],
  },
];

export const MOBILE_NAV_GROUPS: NavGroup[] = [
  { title: "Général", items: [DASHBOARD_ITEM] },
  ...PRIMARY_NAV_GROUPS,
  ...SECONDARY_NAV_GROUPS,
];

