// La page que le client ouvre. Pas de compte, pas d'app à installer : le lien
// donne la facture, et son ouverture est notée pour que l'entrepreneur sache
// qu'elle a été lue.

import React, { useEffect, useState } from 'react'
import { Download, FileWarning, Loader2, Phone, Mail } from 'lucide-react'
import { calcTotals, mergeSettings, money, revisionLine } from './store.js'
import { InvoicePaper } from './paper.jsx'
import { fetchShare, logShareView } from './share.js'
import './styles.css'

// L'adresse peut arriver en chemin (/f/jeton) ou en ancre (#/f/jeton) : la
// deuxième forme sert de secours si l'hébergement ne renvoie pas les chemins
// inconnus vers l'app.
export const shareTokenFromUrl = () => {
  const m = location.pathname.match(/^\/f\/([A-Za-z0-9_-]{8,})\/?$/) ||
            location.hash.match(/^#\/?f\/([A-Za-z0-9_-]{8,})\/?$/)
  return m ? m[1] : ''
}

export function SharedInvoice({ token, log = true }) {
  const [state, setState] = useState({ status: 'loading' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    fetchShare(token, { log })
      .then(r => {
        if (!alive) return
        if (!r?.found) return setState({ status: 'missing' })
        if (r.revoked) return setState({ status: 'revoked' })
        setState({ status: 'ok', doc: r.doc, settings: mergeSettings(r.business), revision: r.revision })
      })
      .catch(e => alive && setState({ status: 'error', message: String(e?.message || e) }))
    return () => { alive = false }
  }, [token, log])

  if (state.status === 'loading') return <div className="share-page center">
    <Loader2 className="spin" size={30}/>
    <p>Ouverture de la facture…</p>
  </div>

  if (state.status !== 'ok') return <div className="share-page center">
    <FileWarning size={44} strokeWidth={1.3}/>
    <h1>{state.status === 'revoked' ? 'Ce lien a été remplacé' : 'Facture introuvable'}</h1>
    <p>{state.status === 'revoked'
      ? "Cette version n'est plus valide. Demandez le lien à jour à l'entrepreneur."
      : state.status === 'error'
        ? "La facture n'a pas pu être chargée. Vérifiez la connexion, puis réessayez."
        : "Ce lien n'existe pas ou plus. Vérifiez l'adresse reçue."}</p>
  </div>

  const { doc, settings } = state
  const totals = calcTotals(doc)
  // Le numéro de révision vient de la base : c'est celui de la version
  // réellement envoyée, pas une déduction faite sur place.
  const revLine = revisionLine(state.revision, doc.replacesAt)
  const b = settings.business || {}

  const download = async () => {
    setBusy(true)
    try {
      const { downloadPdf } = await import('./pdf.js')
      await downloadPdf(settings, doc)
      logShareView(token, 'pdf')
    } catch {
      // le navigateur n'a pas voulu du fichier : l'impression donne le même PDF
      window.print()
    } finally {
      setBusy(false)
    }
  }

  return <div className="share-page">
    <header className="share-head no-print">
      <div>
        <b>{b.name}</b>
        <span>{doc.docType === 'invoice' ? 'Facture' : 'Devis'} {doc.number} — {money(totals.total)}</span>
        {revLine && <em className="share-revision">{revLine}</em>}
      </div>
      <button className="primary" onClick={download} disabled={busy}>
        <Download size={18}/> {busy ? 'Préparation…' : 'Télécharger le PDF'}
      </button>
    </header>

    <div className="share-paper">
      <InvoicePaper settings={settings} doc={doc} totals={totals}/>
    </div>

    <footer className="share-foot no-print">
      {b.phone && <a href={`tel:${b.phone}`}><Phone size={16}/> {b.phone}</a>}
      {b.email && <a href={`mailto:${b.email}`}><Mail size={16}/> {b.email}</a>}
    </footer>
  </div>
}
