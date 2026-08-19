import React from 'react'
import { Printer, X } from 'lucide-react'
import { calcTotals, defaultWatermark, fmtDate, lineTotal, money, revisionNote } from './store.js'

// Aperçu plein écran d'un document, avec bouton d'impression / PDF
export function PaperPreview({ settings, doc, title = 'Aperçu du PDF', note, onClose }) {
  const print = () => setTimeout(() => window.print(), 60)
  return <div className="paper-modal">
    <div className="paper-modal-head no-print">
      <div>
        <b>{title}</b>
        {note && <small>{note}</small>}
      </div>
      <button className="icon" onClick={onClose} aria-label="Fermer"><X size={22}/></button>
    </div>
    <div className="paper-modal-body">
      <InvoicePaper settings={settings} doc={doc} totals={calcTotals(doc)}/>
      <button className="outline-btn with-icon no-print" onClick={print}>
        <Printer size={18}/> Télécharger / imprimer le PDF
      </button>
    </div>
  </div>
}

// Filigrane : le logo de la compagnie en pâle derrière le document, ou du texte
// (le nom de la compagnie par défaut) si aucun logo n'est chargé.
export function Watermark({ settings, scale = 1 }) {
  const wm = { ...defaultWatermark, ...(settings.watermark || {}) }
  if (wm.mode === 'none') return null

  const style = {
    '--wm-size': Math.max(5, Number(wm.size) || defaultWatermark.size),
    '--wm-scale': scale,
    opacity: Math.min(Math.max(Number(wm.opacity) || 0, 0), 100) / 100,
    transform: `rotate(${Number(wm.rotate) || 0}deg)`
  }

  if (wm.mode === 'logo' && settings.logo)
    return <div className="watermark" style={style} aria-hidden="true"><img src={settings.logo} alt=""/></div>

  const text = (wm.text || settings.business?.name || '').trim()
  if (!text) return null
  // Un nom long doit rétrécir, sinon le mot le plus long est coupé en deux
  const longest = Math.max(...text.split(/\s+/).map(w => w.length), 1)
  style['--wm-scale'] = scale * Math.min(1, 10 / longest)
  return <div className="watermark text" style={style} aria-hidden="true">{text}</div>
}

// Le document PDF (aperçu + impression), style professionnel avec zébrures et filigrane
export function InvoicePaper({ settings, doc, totals }) {
  const b = settings.business
  const title = doc.docType === 'invoice' ? 'FACTURE' : 'DEVIS'
  return <article className="invoice-paper" style={{ '--accent': settings.accent }}>
    <Watermark settings={settings}/>

    <header className="pdf-header">
      <div className="brand">
        {settings.logo && settings.logoOnPdf !== false && <img src={settings.logo}/>}
        <div>
          <h1>{b.name}</h1>
          {b.owner && <p>{b.owner}</p>}
          <p>{b.address}</p>
          <p>{b.city}</p>
        </div>
      </div>
      <div className="invoice-meta">
        <h2>{title}</h2>
        <p><b>No :</b> {doc.number}</p>
        <p><b>Date :</b> {fmtDate(doc.date)}</p>
        {doc.dueDate && <p><b>Échéance :</b> {fmtDate(doc.dueDate)}</p>}
        {/* Une facture corrigée doit le dire elle-même : c'est elle qui annule
            celle que le client a déjà. */}
        {revisionNote(doc) && <p className="pdf-revision">{revisionNote(doc)}</p>}
      </div>
    </header>

    <section className="pdf-parties">
      <div>
        <h3>De</h3>
        <p>{b.phone}</p>
        <p>{b.email}</p>
        <p>{b.website}</p>
        {b.gst && <p>GST : {b.gst}</p>}
      </div>
      <div>
        <h3>Facturé à</h3>
        <p><b>{doc.client.name}</b></p>
        <p>{doc.client.address}</p>
        <p>{doc.client.city}</p>
        <p>{doc.client.phone}</p>
        <p>{doc.client.email}</p>
      </div>
    </section>

    {/* Une facture par chantier : le client doit voir tout de suite pour
        quelle adresse il paie. */}
    {doc.siteAddress && <section className="pdf-site">
      <h3>Adresse des travaux</h3>
      <p>{doc.siteAddress}</p>
    </section>}

    <table className="pdf-lines">
      <thead>
        <tr><th>Description</th><th>Qté</th><th>Unité</th><th>Prix</th><th>Total</th></tr>
      </thead>
      <tbody>
        {doc.lines.map((l, i) => <tr key={l.id}>
          <td>{l.description || `Ligne ${i + 1}`}</td>
          <td>{l.qty}</td>
          <td>{l.unit}</td>
          <td>{money(l.rate)}</td>
          <td>{money(lineTotal(l))}</td>
        </tr>)}
      </tbody>
    </table>

    <div className="pdf-bottom">
      <div className="pdf-notes">
        {(doc.notes || !doc.paymentInfo) && <>
          <h3>Remarques</h3>
          <p>{doc.notes || 'Merci pour votre confiance.'}</p>
        </>}
        {doc.paymentInfo && <>
          <h3>Info sur le paiement</h3>
          <p>{doc.paymentInfo}</p>
        </>}
        <div className="sign-box">
          {doc.signature ? <img src={doc.signature}/> : <span>Signature client</span>}
        </div>
        <small>Signature</small>
      </div>
      <div className="pdf-totals">
        <p><span>Sous-total</span><b>{money(totals.subtotal)}</b></p>
        {totals.discount > 0 && <p><span>Remise</span><b>-{money(totals.discount)}</b></p>}
        {/* Taxe décochée : pas de ligne du tout, plutôt qu'un « Gst 0,00 $ »
            qui laisse croire au client qu'une taxe s'applique. Le PDF fabriqué
            fait pareil. */}
        {doc.chargeTax && <p><span>{settings.taxLabel} ({doc.taxRate}%)</span><b>{money(totals.tax)}</b></p>}
        <p className="total"><span>Total</span><b>{money(totals.total)}</b></p>
        {totals.paid > 0 && <>
          <p><span>Paiements</span><b>-{money(totals.paid)}</b></p>
          <p className="total balance"><span>Solde dû</span><b>{money(totals.balance)}</b></p>
        </>}
      </div>
    </div>

    {doc.photos.length > 0 && <section className="pdf-photos">
      <h3>Photos</h3>
      <div className="pdf-photo-grid">
        {doc.photos.map(p => <img key={p.id} src={p.src}/>)}
      </div>
    </section>}

    <footer className="pdf-footer">
      <span>{b.name}{b.phone ? ` • ${b.phone}` : ''}{b.email ? ` • ${b.email}` : ''}</span>
    </footer>
  </article>
}
