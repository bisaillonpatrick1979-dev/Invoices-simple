// Les deux avis qui expliquent une app « vide » sur un nouvel appareil.
//
// Les données du navigateur sont rangées **par adresse**. Deux adresses
// différentes du même site, ce sont deux réserves séparées : c'est ce qui
// donne l'impression que l'app « n'est pas synchronisée » sur la tablette,
// alors qu'elle regarde simplement ailleurs.
//
// Et le nuage ne se remplit pas tout seul : tant que l'appareil n'est pas
// connecté au compte, il ne sait pas qu'il y a des factures à ramener.

import React from 'react'
import { Cloud, ExternalLink, TriangleAlert, X } from 'lucide-react'

// L'adresse à garder — celle qui ne change jamais, quel que soit le nombre de
// redéploiements.
export const CANONICAL_HOST = 'invoices-simple.vercel.app'
export const CANONICAL_URL = `https://${CANONICAL_HOST}`

// Adresse d'un déploiement précis : « invoices-simple-ixjtuo8us-… ». Vercel en
// fabrique une par mise en ligne, et elle meurt à la suivante. Son empreinte :
// un jeton de neuf caractères mêlant lettres et chiffres — à ne pas confondre
// avec le nom du compte, qui est bien plus long (« bisaillonpatrick1979 »).
const isDeploymentHost = host => {
  const m = /^invoices-simple-([a-z0-9]{8,10})-/i.exec(host)
  return !!m && /\d/.test(m[1]) && /[a-z]/i.test(m[1])
}

export function hostNotice(host = typeof location !== 'undefined' ? location.hostname : '') {
  if (!host || host === CANONICAL_HOST || host === 'localhost' || host === '127.0.0.1') return null
  if (!/vercel\.app$/i.test(host)) return null
  return isDeploymentHost(host)
    ? {
        kind: 'deployment',
        title: 'Adresse temporaire',
        text: "Cette adresse est celle d'une mise à jour précise : elle change au prochain déploiement, et ce que tu entres ici reste derrière. Les factures, clients et articles sont rangés par adresse."
      }
    : {
        kind: 'alias',
        title: 'Autre porte de la même app',
        text: 'Cette adresse marche, mais elle a sa propre réserve de données : ce que tu vois ici n\'est pas ce que tu vois sur l\'adresse principale.'
      }
}

export function HostNotice({ notice, onDismiss }) {
  if (!notice) return null
  return <div className="notice warn no-print">
    <TriangleAlert size={20}/>
    <div>
      <b>{notice.title}</b>
      <span>{notice.text}</span>
      <a className="notice-btn" href={CANONICAL_URL}>
        <ExternalLink size={15}/> Ouvrir {CANONICAL_HOST}
      </a>
    </div>
    <button className="icon" onClick={onDismiss} aria-label="Fermer"><X size={17}/></button>
  </div>
}

// Appareil neuf, app vide, personne de connecté : le plus probable, c'est que
// tout est dans le nuage et attend qu'on ouvre la porte.
export function SignInNotice({ onOpenSettings, onDismiss }) {
  return <div className="notice info no-print">
    <Cloud size={20}/>
    <div>
      <b>Rien sur cet appareil</b>
      <span>Si tes factures sont déjà dans la sauvegarde infonuagique, connecte-toi avec le même courriel : elles redescendent toutes seules.</span>
      <button className="notice-btn" onClick={onOpenSettings}>Se connecter</button>
    </div>
    <button className="icon" onClick={onDismiss} aria-label="Fermer"><X size={17}/></button>
  </div>
}
