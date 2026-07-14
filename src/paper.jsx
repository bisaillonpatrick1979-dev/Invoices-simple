import React from 'react'
import { lineTotal, money } from './store.js'

// Le document PDF (aperçu + impression), style professionnel avec zébrures et filigrane
export function InvoicePaper({ settings, doc, totals }) {
  const b = settings.business
  const title = doc.docType === 'invoice' ? 'INVOICE' : 'ESTIMATE'
  return <article className="invoice-paper" style={{ '--accent': settings.accent }}>
    <div className="watermark">{b.name}</div>

    <header className="pdf-header">
      <div className="brand">
        {settings.logo && <img src={settings.logo}/>}
        <div>
          <h1>{b.name}</h1>
          {b.owner && <p>{b.owner}</p>}
          <p>{b.address}</p>
          <p>{b.city}</p>
        </div>
      </div>
      <div className="invoice-meta">
        <h2>{title}</h2>
        <p><b>No:</b> {doc.number}</p>
        <p><b>Date:</b> {doc.date}</p>
        {doc.dueDate && <p><b>Due:</b> {doc.dueDate}</p>}
      </div>
    </header>

    <section className="pdf-parties">
      <div>
        <h3>De / From</h3>
        <p>{b.phone}</p>
        <p>{b.email}</p>
        <p>{b.website}</p>
        {b.gst && <p>GST: {b.gst}</p>}
      </div>
      <div>
        <h3>Facturé à / Bill To</h3>
        <p><b>{doc.client.name}</b></p>
        <p>{doc.client.address}</p>
        <p>{doc.client.city}</p>
        <p>{doc.client.phone}</p>
        <p>{doc.client.email}</p>
      </div>
    </section>

    <table className="pdf-lines">
      <thead>
        <tr><th>Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>Total</th></tr>
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
        <h3>Notes</h3>
        <p>{doc.notes || 'Merci pour votre confiance.'}</p>
        {settings.paymentInstructions && <>
          <h3>Paiement</h3>
          <p>{settings.paymentInstructions}</p>
        </>}
        <div className="sign-box">
          {doc.signature ? <img src={doc.signature}/> : <span>Signature client</span>}
        </div>
        <small>Signature tactile</small>
      </div>
      <div className="pdf-totals">
        <p><span>Subtotal</span><b>{money(totals.subtotal)}</b></p>
        {totals.discount > 0 && <p><span>Remise</span><b>-{money(totals.discount)}</b></p>}
        <p><span>{settings.taxLabel} {doc.taxRate}%</span><b>{money(totals.tax)}</b></p>
        <p className="total"><span>Total CAD</span><b>{money(totals.total)}</b></p>
        {totals.paid > 0 && <>
          <p><span>Payé</span><b>-{money(totals.paid)}</b></p>
          <p className="total balance"><span>Balance due</span><b>{money(totals.balance)}</b></p>
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
