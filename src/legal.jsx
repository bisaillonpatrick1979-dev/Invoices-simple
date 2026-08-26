// Politique de confidentialité et conditions d'utilisation.
//
// Google Play et l'App Store exigent une adresse publique pour chacune, et
// vérifient qu'elle décrit vraiment ce que l'app fait. Elles vivent donc dans
// l'app elle-même, aux adresses /confidentialite et /conditions, lisibles sans
// compte et sans connexion.
//
// Ce texte doit rester VRAI. Chaque fois qu'une donnée nouvelle sort de
// l'appareil, elle se déclare ici.

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import './styles.css'

// À remplir avant la mise en vente : c'est l'éditeur de l'app, pas
// l'utilisateur. Les magasins comparent ce nom à celui du compte développeur.
export const EDITEUR = {
  nom: 'Hailite Xteriors',
  courriel: 'bisaillonpatrick1979@gmail.com',
  pays: 'Canada'
}

export const MAJ = '26 août 2026'

export const legalRouteFromUrl = () => {
  const p = location.pathname.replace(/\/$/, '')
  if (p === '/confidentialite' || location.hash === '#/confidentialite') return 'privacy'
  if (p === '/conditions' || location.hash === '#/conditions') return 'terms'
  return ''
}

function Page({ titre, children }) {
  return <div className="legal-page">
    <header className="legal-head">
      <button className="icon" onClick={() => { location.href = '/' }} aria-label="Retour"><ArrowLeft size={20}/></button>
      <div>
        <b>{titre}</b>
        <small>Invoices Simple · mise à jour du {MAJ}</small>
      </div>
    </header>
    <article className="legal-body">{children}</article>
  </div>
}

export function PrivacyPage() {
  return <Page titre="Politique de confidentialité">
    <p><b>En une phrase :</b> tes factures t'appartiennent, elles ne servent à rien d'autre qu'à toi, et rien n'est vendu à personne.</p>

    <h2>Ce que l'app garde</h2>
    <ul>
      <li><b>Tes documents</b> — factures, devis, dépenses, paiements, photos de chantier et signatures que tu ajoutes.</li>
      <li><b>Ton carnet</b> — noms, téléphones, courriels et adresses des clients que tu inscris, et ta liste de prix.</li>
      <li><b>Tes réglages</b> — nom de l'entreprise, logo, taxes, numérotation.</li>
      <li><b>Ton compte</b> — l'adresse courriel et le mot de passe que tu choisis. Le mot de passe n'est jamais lisible : il est haché par notre fournisseur d'authentification.</li>
    </ul>

    <h2>Où c'est gardé</h2>
    <p>
      D'abord <b>dans ton appareil</b> : l'app fonctionne sans réseau, sur un chantier comme ailleurs.
      Si tu ouvres un compte, une copie est gardée chez <b>Supabase</b> (hébergement en Amérique du Nord)
      pour retrouver ton travail sur ton autre téléphone ou ta tablette. Les règles de sécurité de la base
      font qu'un compte ne peut lire que ses propres lignes — ce n'est pas une politique interne, c'est le
      serveur qui refuse.
    </p>

    <h2>Ce qui sort de l'appareil, et quand</h2>
    <ul>
      <li><b>La synchronisation</b> : seulement si tu as ouvert un compte.</li>
      <li><b>L'assistant IA</b> : seulement si tu branches ta propre clé. Le texte de ta demande, et les photos ou PDF que tu joins, partent alors chez le fournisseur que TU as choisi (Anthropic, OpenAI, Google…), sous ton propre contrat avec lui. Ta clé reste sur l'appareil : elle n'est jamais envoyée à notre serveur ni écrite dans une copie de sauvegarde.</li>
      <li><b>Les liens de facture</b> (option désactivée par défaut) : la facture concernée devient lisible par qui possède le lien secret. Chaque ouverture est notée — date, heure, et le type d'appareil — pour te dire quand ton client l'a vue. Tu peux couper un lien à tout moment.</li>
      <li><b>Les envois</b> par courriel ou texto passent par l'application de ton téléphone : leur contenu ne transite par aucun serveur à nous.</li>
    </ul>

    <h2>Ce que l'app ne fait pas</h2>
    <ul>
      <li>Aucune publicité, aucun pisteur, aucun profilage.</li>
      <li>Aucune revente ni partage de tes données ou de celles de tes clients.</li>
      <li>Aucune localisation, aucun accès au carnet d'adresses du téléphone.</li>
      <li>La caméra ne sert qu'aux photos que tu prends toi-même pour une facture.</li>
    </ul>

    <h2>Combien de temps</h2>
    <p>
      Aussi longtemps que tu gardes ton compte. <b>Tu peux tout effacer toi-même</b> : Réglages →
      Supprimer mon compte. Les données sont alors retirées du serveur, et le compte avec. C'est
      immédiat et sans retour possible — garde une copie de sauvegarde avant.
    </p>

    <h2>Tes droits</h2>
    <p>
      Consulter, corriger, exporter (Réglages → Enregistrer une copie) et supprimer tes données, en
      tout temps et depuis l'app. Pour toute question : <a href={`mailto:${EDITEUR.courriel}`}>{EDITEUR.courriel}</a>.
    </p>

    <h2>Enfants</h2>
    <p>L'app s'adresse à des entreprises et n'est pas destinée aux moins de 13 ans.</p>

    <h2>Qui publie l'app</h2>
    <p>{EDITEUR.nom} · {EDITEUR.pays} · <a href={`mailto:${EDITEUR.courriel}`}>{EDITEUR.courriel}</a></p>
  </Page>
}

export function TermsPage() {
  return <Page titre="Conditions d'utilisation">
    <h2>Ce que tu obtiens</h2>
    <p>
      Le droit d'utiliser Invoices Simple pour ton entreprise : monter des devis et des factures,
      les envoyer, suivre les paiements. Sur autant d'appareils que tu veux, avec ton compte.
    </p>

    <h2>Ce dont tu réponds</h2>
    <ul>
      <li>L'exactitude de tes factures : montants, taxes, numéros. L'app calcule ce que tu inscris ; elle ne vérifie pas si le taux est le bon ni si le numéro de TPS est valide.</li>
      <li>Tes obligations fiscales et comptables, qui varient d'une province et d'un pays à l'autre.</li>
      <li>Les coordonnées de tes clients, que tu inscris sous ta responsabilité.</li>
      <li>La garde de ton mot de passe.</li>
    </ul>

    <h2>Les taux de taxe</h2>
    <p>
      Les taux proposés au démarrage sont un point de départ, à jour au mieux de notre connaissance
      à la date ci-dessus. Ils changent avec les budgets des gouvernements : <b>vérifie-les</b>, et
      corrige-les dans les réglages au besoin. Ils restent modifiables en tout temps.
    </p>

    <h2>Interruptions</h2>
    <p>
      L'app fonctionne sans réseau ; la synchronisation, elle, dépend d'un service tiers et peut être
      interrompue. Garde une copie de sauvegarde (Réglages → Enregistrer une copie) : c'est le filet,
      et il ne coûte rien.
    </p>

    <h2>Limites</h2>
    <p>
      L'app est fournie telle quelle. L'éditeur ne peut être tenu responsable d'une perte de revenu,
      d'un retard de paiement ou d'une erreur de facturation. Ce qui est garanti, c'est un effort
      sérieux et des corrections rapides quand un défaut est signalé.
    </p>

    <h2>Fin</h2>
    <p>
      Tu peux arrêter quand tu veux et tout effacer depuis Réglages → Supprimer mon compte.
      Nous pouvons fermer un compte qui sert à nuire à autrui.
    </p>

    <h2>Éditeur</h2>
    <p>{EDITEUR.nom} · {EDITEUR.pays} · <a href={`mailto:${EDITEUR.courriel}`}>{EDITEUR.courriel}</a></p>
  </Page>
}
