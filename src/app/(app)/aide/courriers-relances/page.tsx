import { Send } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Courriers et relances | Centre d'aide | ${APP_NAME}`,
};

export default function CourriersRelancesPage() {
  return (
    <HelpPageLayout
      slug="courriers-relances"
      icon={<Send className="h-6 w-6" />}
      title="Courriers et relances"
      description="Modèles de lettres conformes à la législation, relances automatiques à 3 niveaux et génération de courriers assistée par IA."
    >
      <HelpSection id="modeles" title="Bibliothèque de modèles de courriers">
        <p>
          Le module <strong>Courriers</strong> propose une bibliothèque de modèles de lettres prêts à l'emploi, classés par catégorie et conformes à la législation en vigueur.
        </p>
        <p className="font-semibold text-foreground mt-4 mb-2">Catégories de modèles :</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: "Loyer", desc: "Relance impayé, mise en demeure, avis d'échéance, révision de loyer" },
            { title: "Bail", desc: "Congé bailleur, congé locataire, renouvellement, résiliation" },
            { title: "Charges", desc: "Régularisation annuelle, appel de provisions, décompte détaillé" },
            { title: "Travaux", desc: "Avis de travaux, demande d'accès au logement, fin de travaux" },
            { title: "Assurance", desc: "Demande d'attestation, relance attestation expirée" },
            { title: "Administratif", desc: "Attestation de domicile, quittance, certificat de loyer" },
          ].map((cat) => (
            <div key={cat.title} className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-foreground">{cat.title}</p>
              <p className="text-xs text-muted-foreground">{cat.desc}</p>
            </div>
          ))}
        </div>
      </HelpSection>

      <HelpSection id="envoyer-courrier" title="Envoyer un courrier">
        <HelpStep number={1} title="Choisissez un modèle">
          <p>Allez dans <strong>Courriers</strong>, parcourez les modèles par catégorie ou utilisez la barre de recherche. Cliquez sur le modèle souhaité.</p>
        </HelpStep>
        <HelpStep number={2} title="Sélectionnez les destinataires">
          <p>Choisissez un ou plusieurs destinataires (locataires, copropriétaires). Les variables dynamiques sont remplacées automatiquement.</p>
        </HelpStep>
        <HelpStep number={3} title="Personnalisez si nécessaire">
          <p>Le texte est pré-rempli avec les variables : <code>{"{nom_locataire}"}</code>, <code>{"{adresse_lot}"}</code>, <code>{"{montant_loyer}"}</code>, <code>{"{date_echeance}"}</code>. Vous pouvez modifier le texte avant envoi.</p>
        </HelpStep>
        <HelpStep number={4} title="Envoyez ou générez le PDF">
          <p>Envoyez par email directement ou téléchargez le PDF pour envoi postal. Le courrier est automatiquement archivé dans l'historique du locataire.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous sélectionnez le modèle &laquo; Relance loyer impayé - Niveau 1 &raquo;. Vous choisissez Jean Dupont comme destinataire. Le courrier est pré-rempli : &laquo; Monsieur Jean Dupont, nous constatons que votre loyer de 950 &euro; du 01/04/2026 n'a pas été réglé à ce jour... &raquo;. Vous l'envoyez par email en un clic.
          </p>
        </div>
      </HelpSection>

      <HelpSection id="courrier-ia" title="Génération de courriers par IA">
        <p>
          Avec le plan Enterprise, l'<strong>assistant IA</strong> peut rédiger des courriers sur mesure. Indiquez le sujet, le ton souhaité (courtois, formel, juridique) et l'IA génère un courrier complet avec les références légales appropriées.
        </p>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous demandez à l'IA : &laquo; Rédige une mise en demeure pour loyers impayés de mars et avril 2026, ton juridique &raquo;. L'IA génère un courrier formel avec les articles de loi applicables (loi du 6 juillet 1989), les montants exacts et les délais légaux de régularisation.
          </p>
        </div>
        <InfoBox type="info">
          Les courriers générés par l'IA incluent automatiquement : l'objet, le corps avec références légales, le ton adapté et un résumé. Relisez toujours avant envoi.
        </InfoBox>
      </HelpSection>

      <HelpSection id="relances" title="Relances automatiques des impayés">
        <p>
          Le module <strong>Relances</strong> gère automatiquement le suivi des factures impayées selon un système progressif en 3 niveaux :
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Niveau 1 — Relance courtoise (J+7)</p>
            <p>Envoyée 7 jours après la date d'échéance. Ton amical : &laquo; Nous vous rappelons que votre loyer de 950 &euro; du 01/04/2026 n'a pas encore été réglé. Il s'agit peut-être d'un oubli... &raquo;</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Niveau 2 — Relance ferme (J+21)</p>
            <p>Envoyée 21 jours après l'échéance. Ton plus formel mentionnant les conséquences : &laquo; Malgré notre précédent rappel, votre loyer reste impayé. Nous vous demandons de régulariser cette situation sous 8 jours... &raquo;</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Niveau 3 — Mise en demeure (J+45)</p>
            <p>Envoyée 45 jours après l'échéance. Dernier rappel avant procédure : &laquo; Faute de règlement dans un délai de 8 jours, nous serons contraints d'engager les voies de recouvrement prévues par la loi... &raquo;</p>
          </div>
        </div>
        <InfoBox type="info">
          Les relances automatiques sont envoyées chaque <strong>lundi matin à 8h</strong>. Vous pouvez aussi envoyer des relances manuelles à tout moment depuis la page Relances.
        </InfoBox>
      </HelpSection>

      <HelpSection id="suivi-relances" title="Suivi des relances">
        <p>
          La page <strong>Relances</strong> affiche toutes les factures impayées (statut En retard, Partiellement payée ou Relancée) avec :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Le nom du locataire et son type (personne physique ou morale)</li>
          <li>Le numéro de facture, le montant TTC et la date d'échéance</li>
          <li>Le nombre de relances déjà envoyées et le niveau actuel</li>
          <li>Les paiements partiels déjà reçus</li>
        </ul>
        <p>
          Un historique complet des relances est accessible pour chaque locataire, avec les dates d'envoi et les niveaux.
        </p>
      </HelpSection>

      <HelpSection id="modeles-personnalises" title="Créer vos propres modèles">
        <HelpStep number={1} title="Accédez à la gestion des modèles">
          <p>Allez dans <strong>Courriers &gt; Modèles &gt; Créer un modèle</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Rédigez votre modèle">
          <p>Utilisez les variables dynamiques disponibles dans votre texte. Les variables sont remplacées automatiquement à l'envoi.</p>
        </HelpStep>
        <HelpStep number={3} title="Catégorisez et sauvegardez">
          <p>Attribuez une catégorie à votre modèle (loyer, bail, charges...) pour le retrouver facilement. Le modèle est propre à votre société.</p>
        </HelpStep>
        <InfoBox type="tip">
          Variables disponibles les plus courantes : <code>{"{nom_locataire}"}</code>, <code>{"{prenom_locataire}"}</code>, <code>{"{adresse_lot}"}</code>, <code>{"{montant_loyer}"}</code>, <code>{"{date_echeance}"}</code>, <code>{"{nom_societe}"}</code>, <code>{"{nom_immeuble}"}</code>.
        </InfoBox>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je désactiver les relances automatiques pour un locataire ?</p>
            <p>Les relances automatiques s'appliquent à toutes les factures impayées. Si vous gérez un cas particulier (accord de paiement échelonné), envoyez les relances manuellement depuis la page Relances au cas par cas.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je envoyer un courrier à tous les locataires d'un immeuble ?</p>
            <p>Oui, choisissez le mode &laquo; Envoi par immeuble &raquo; lors de la sélection des destinataires. Chaque locataire reçoit un courrier personnalisé avec ses propres données.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Les courriers envoyés sont-ils archivés ?</p>
            <p>Oui, chaque courrier est automatiquement enregistré dans l'historique du locataire et dans le module Documents. Vous pouvez le retrouver et le renvoyer à tout moment.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
