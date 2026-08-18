import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, MoreVertical, ChevronRight, Send, Paperclip, Trash2,
  Mail, MessageSquare, Printer, Clock, X, Maximize2, PenLine, Eye, MapPin,
  Share2, Download
} from 'lucide-react'
import {
  buildEmailBody, buildSmsBody, calcTotals, docStatus, fmtDate, lineTotal, money,
  newLine, suggestItems, uid, today, emptyClient, withEvent, UNITS
} from './store.js'
import { canSharePdf, downloadPdf, sharePdf } from './pdf.js'
import { AppBar } from './lists.jsx'
import { InvoicePaper } from './paper.jsx'

const EDITOR_TABS = [
  { id: 'edit', label: 'Modifier' },
  { id: 'preview', label: 'Aperçu' },
  { id: 'history', label: 'Historique' }
]

// Champ description avec rappel de tout ce qui a déjà été facturé :
// on tape les premières lettres, on choisit, prix et unité suivent.
function DescriptionInput({ line, catalog, onType, onPick }) {
  const [open, setOpen] = useState(false)
  const matches = open ? suggestItems(catalog, line.description) : []
  return <div className="autocomplete">
    <input
      className="ghost"
      placeholder="Description"
      value={line.description}
      onChange={e => { onType(e.target.value); setOpen(true) }}
      onFocus={() => setOpen(true)}
      onBlur={() => setTimeout(() => setOpen(false), 160)}
    />
    {matches.length > 0 && <div className="suggestions">
      {matches.map(it => <button
        key={it.id}
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={() => { onPick(it); setOpen(false) }}
      >
        <span>{it.description}</span>
        <b>{money(it.rate)} / {it.unit}</b>
      </button>)}
    </div>}
  </div>
}

function Row({ children, onClick, chevron, bold, className = '' }) {
  const Tag = onClick ? 'button' : 'div'
  return <Tag className={`edit-row ${bold ? 'bold' : ''} ${className}`} onClick={onClick}>
    {children}
    {chevron && <ChevronRight size={20} className="row-chev"/>}
  </Tag>
}

export function DocumentEditor({ doc, settings, clients, items, onChange, onSave, onDelete, onConvert, onSaveClient, onSaveItem, onOpenSettings, onClose }) {
  const [view, setView] = useState('edit')
  const [sendOpen, setSendOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [siteOpen, setSiteOpen] = useState(false)
  const [shareError, setShareError] = useState('')
  // Le partage de fichier n'existe pas sur tous les navigateurs : sur un
  // ordinateur, c'est l'enregistrement du PDF qui prend le relais.
  const [shareable] = useState(canSharePdf)
  const [payOpen, setPayOpen] = useState(false)
  const [sigOpen, setSigOpen] = useState(false)
  const totals = calcTotals(doc)
  const status = docStatus(doc)
  const isInvoice = doc.docType === 'invoice'
  const catalog = [...items].sort((a, b) => String(a.description).localeCompare(String(b.description), 'fr'))

  const set = patch => onChange({ ...doc, ...patch })
  const setClient = patch => set({ client: { ...doc.client, ...patch } })
  const setLine = (id, patch) => set({ lines: doc.lines.map(l => l.id === id ? { ...l, ...patch } : l) })

  const persist = (next = doc) => { onChange(next); onSave(next); return next }

  const logAndSave = label => persist(withEvent(doc, label))

  const sendEmail = () => {
    if (!doc.client.email?.trim()) return alert('Ajoute une adresse email au client avant d’envoyer.')
    const saved = persist(withEvent({ ...doc, status: 'sent' }, 'Envoyée par email'))
    const subject = encodeURIComponent(`${saved.number} - ${settings.business.name}`)
    const body = encodeURIComponent(buildEmailBody(settings, saved, totals))
    window.location.href = `mailto:${saved.client.email}?subject=${subject}&body=${body}`
    setSendOpen(false)
  }

  const sendSms = () => {
    if (!doc.client.phone?.trim()) return alert('Ajoute un numéro de téléphone au client avant d’envoyer par texto.')
    const saved = persist(withEvent({ ...doc, status: 'sent' }, 'Envoyée par texto'))
    const body = encodeURIComponent(buildSmsBody(settings, saved, totals))
    window.location.href = `sms:${saved.client.phone}?&body=${body}`
    setSendOpen(false)
  }

  // Envoi du PDF en pièce jointe, par le partage du téléphone : une seule
  // touche pour choisir Messages, Gmail, ou les deux.
  const sharePdfTo = async () => {
    const saved = persist(withEvent({ ...doc, status: 'sent' }, 'PDF partagé'))
    setSendOpen(false)
    try {
      await sharePdf(settings, saved, {
        title: `${saved.number} — ${settings.business.name}`,
        text: buildSmsBody(settings, saved, totals)
      })
    } catch (e) {
      // Annuler le partage n'est pas une panne : on ne dit rien.
      if (e?.name === 'AbortError') return
      setShareError("Ce navigateur n'a pas voulu partager le fichier. Enregistre le PDF, puis joins-le à ton message.")
    }
  }

  const savePdf = async () => {
    const saved = persist(withEvent(doc, 'PDF enregistré'))
    setSendOpen(false)
    try {
      await downloadPdf(settings, saved)
    } catch {
      setShareError("Le PDF n'a pas pu être créé. Utilise « Imprimer » et choisis « Enregistrer en PDF ».")
    }
  }

  // Voir la facture telle qu'elle sortira, avant de l'envoyer
  const previewPdf = () => {
    persist()
    setSendOpen(false)
    setView('preview')
  }

  const printPdf = () => {
    persist(withEvent(doc, 'PDF généré'))
    setSendOpen(false)
    setView('preview')
    setTimeout(() => window.print(), 150)
  }

  const markPaid = () => {
    if (totals.balance <= 0) return
    persist(withEvent({
      ...doc,
      payments: [...(doc.payments || []), { id: uid(), date: today(), amount: Number(totals.balance.toFixed(2)), method: 'Autre' }]
    }, `Marquée comme payée (${money(totals.balance)})`))
  }

  const addPayment = () => {
    const amount = Number(prompt('Montant du paiement :', totals.balance > 0 ? totals.balance.toFixed(2) : ''))
    if (!amount || amount <= 0) return
    persist(withEvent({
      ...doc,
      payments: [...(doc.payments || []), { id: uid(), date: today(), amount, method: 'Paiement' }]
    }, `Paiement ajouté (${money(amount)})`))
  }

  const convert = () => {
    const inv = withEvent({
      ...doc,
      id: uid(),
      docType: 'invoice',
      number: doc.number.replace(settings.estimatePrefix, settings.invoicePrefix),
      payments: [],
      status: 'draft',
      closed: false
    }, 'Convertie depuis un devis')
    persist(withEvent({ ...doc, closed: true }, 'Convertie en facture'))
    setMenuOpen(false)
    onConvert(inv)
  }

  const selectClient = id => {
    const c = clients.find(x => x.id === id)
    set({ clientId: id, client: c ? { ...c } : { ...emptyClient } })
  }

  const saveClientToBook = () => {
    if (!doc.client.name.trim()) return alert('Entre au minimum le nom du client.')
    const c = { ...doc.client, id: doc.clientId || uid() }
    onSaveClient(c)
    set({ clientId: c.id, client: c })
  }

  const applyItem = (lineId, itemId) => {
    const it = items.find(x => x.id === itemId)
    if (it) setLine(lineId, { description: it.description, unit: it.unit, rate: it.rate, taxable: it.taxable !== false })
  }

  const pickItem = (lineId, it) =>
    setLine(lineId, { description: it.description, unit: it.unit, rate: it.rate, taxable: it.taxable !== false })

  const addPhotos = e => {
    const files = Array.from(e.target.files || [])
    Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve({ id: uid(), src: reader.result })
      reader.readAsDataURL(file)
    }))).then(photos => set({ photos: [...doc.photos, ...photos] }))
    e.target.value = ''
  }

  return <section className="screen editor">
    <AppBar
      title={isInvoice ? 'Facture' : 'Devis'}
      left={<button className="icon light" onClick={() => { persist(); onClose() }}><ArrowLeft size={22}/></button>}
      right={<button className="icon light" onClick={() => setMenuOpen(o => !o)}><MoreVertical size={22}/></button>}
      tabs={EDITOR_TABS}
      activeTab={view}
      onTab={id => { persist(); setView(id) }}
    />

    {menuOpen && <div className="menu-backdrop no-print" onClick={() => setMenuOpen(false)}>
      <div className="menu" onClick={e => e.stopPropagation()}>
        <button onClick={() => { logAndSave('Enregistrée manuellement'); setMenuOpen(false) }}>Enregistrer</button>
        {!isInvoice && !doc.closed && <button onClick={convert}>Convertir en facture</button>}
        <button className="danger" onClick={() => { if (confirm(`Supprimer ${doc.number} ?`)) { onDelete(); onClose() } }}>Supprimer</button>
      </div>
    </div>}

    {view === 'edit' && <div className="editor-body no-print">
      {/* Numéro / entreprise / date */}
      <div className="edit-card">
        <Row>
          <input className="ghost bold-input" value={doc.number} onChange={e => set({ number: e.target.value })}/>
        </Row>
        <Row onClick={onOpenSettings} chevron>
          <span className="hint">Informations relatives à l'entreprise</span>
          <input type="date" className="ghost date-input" value={doc.date} onClick={e => e.stopPropagation()} onChange={e => set({ date: e.target.value })}/>
        </Row>
      </div>

      {/* Client */}
      <div className="edit-card">
        <Row onClick={() => setClientOpen(o => !o)} chevron>
          <span><b>À</b> <span className={doc.client.name ? '' : 'hint'}>{doc.client.name || 'Client'}</span></span>
        </Row>
        {clientOpen && <div className="row-detail">
          <select value={doc.clientId} onChange={e => selectClient(e.target.value)}>
            <option value="">Nouveau client / entrer manuellement</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ''}</option>)}
          </select>
          <input placeholder="Nom du client" value={doc.client.name} onChange={e => setClient({ name: e.target.value })}/>
          <div className="pair">
            <input placeholder="Téléphone" value={doc.client.phone} onChange={e => setClient({ phone: e.target.value })}/>
            <input placeholder="Email" value={doc.client.email} onChange={e => setClient({ email: e.target.value })}/>
          </div>
          <input placeholder="Adresse" value={doc.client.address} onChange={e => setClient({ address: e.target.value })}/>
          <input placeholder="Ville" value={doc.client.city} onChange={e => setClient({ city: e.target.value })}/>
          <button className="link-btn" onClick={saveClientToBook}>Sauvegarder ce client en mémoire</button>
        </div>}
      </div>

      {/* Chantier : une facture par adresse de travaux */}
      <div className="edit-card">
        <Row onClick={() => setSiteOpen(o => !o)} chevron>
          <span className="row-ico"><MapPin size={17}/></span>
          <span><b>Chantier</b> <span className={doc.siteAddress ? '' : 'hint'}>{doc.siteAddress || 'Adresse des travaux'}</span></span>
        </Row>
        {siteOpen && <div className="row-detail">
          <textarea
            rows={2}
            placeholder="123, rue Principale, Calgary, AB"
            value={doc.siteAddress || ''}
            onChange={e => set({ siteAddress: e.target.value })}
          />
          {doc.client.address && doc.client.address !== doc.siteAddress && <button
            className="link-btn"
            onClick={() => set({ siteAddress: [doc.client.address, doc.client.city].filter(Boolean).join(', ') })}
          >Reprendre l'adresse du client</button>}
          <p className="hint small-note">Imprimée sur la facture, pour que le client voie tout de suite quel chantier il paie.</p>
        </div>}
      </div>

      {/* Articles */}
      <div className="edit-card lines">
        {doc.lines.map(l => <div className="line-block" key={l.id}>
          <div className="line-main">
            <DescriptionInput
              line={l}
              catalog={catalog}
              onType={v => setLine(l.id, { description: v })}
              onPick={it => pickItem(l.id, it)}
            />
            <div className="line-right">
              <span className="line-calc">
                <input type="number" value={l.qty} onChange={e => setLine(l.id, { qty: e.target.value })}/>
                ×
                <input type="number" value={l.rate} onChange={e => setLine(l.id, { rate: e.target.value })}/>
              </span>
              <b>{money(lineTotal(l))}</b>
            </div>
          </div>
          <div className="line-extra">
            {items.length > 0 && <select value="" onChange={e => applyItem(l.id, e.target.value)}>
              <option value="">Article du catalogue...</option>
              {catalog.map(it => <option key={it.id} value={it.id}>{it.description} — {money(it.rate)} / {it.unit}</option>)}
            </select>}
            <input
              className="unit-input"
              list="unit-options"
              placeholder="unité"
              value={l.unit || ''}
              onChange={e => setLine(l.id, { unit: e.target.value })}
            />
            {/* La case par ligne ne s'affiche que si la facture charge la
                taxe : sinon elle n'a aucun effet sur le calcul et laisse croire
                que la taxe est active. */}
            {doc.chargeTax && <label className="check small"><input type="checkbox" checked={l.taxable !== false} onChange={e => setLine(l.id, { taxable: e.target.checked })}/> {settings.taxLabel}</label>}
            <button className="icon danger" onClick={() => set({ lines: doc.lines.filter(x => x.id !== l.id) })}><Trash2 size={16}/></button>
          </div>
        </div>)}
        <datalist id="unit-options">{UNITS.map(u => <option key={u} value={u}/>)}</datalist>
        <Row onClick={() => set({ lines: [...doc.lines, newLine()] })}>
          <span className="hint">Ajouter un article</span>
          <span className="hint right-num">{doc.lines.length === 0 && <>0 × 0,00 $<br/>0,00 $</>}</span>
        </Row>
      </div>

      {/* Sous-total */}
      <div className="edit-card">
        <Row bold><span>Sous-total</span><b>{money(totals.subtotal)}</b></Row>
      </div>

      {/* Remise / taxe / totaux */}
      <div className="edit-card">
        <Row>
          <span>Remise</span>
          <span className="inline-edit">
            <input type="number" value={doc.discountValue} onChange={e => set({ discountValue: e.target.value })}/>
            <select value={doc.discountType} onChange={e => set({ discountType: e.target.value })}>
              <option value="$">$</option>
              <option value="%">%</option>
            </select>
            <b>{money(totals.discount)}</b>
          </span>
        </Row>
        <Row>
          <span>
            <label className="check inline"><input type="checkbox" checked={doc.chargeTax} onChange={e => set({ chargeTax: e.target.checked })}/> {settings.taxLabel} ({doc.taxRate}%)</label>
          </span>
          <b>{money(totals.tax)}</b>
        </Row>
        <Row><span>Total</span><b>{money(totals.total)}</b></Row>
        <Row><span>Paiements</span><b>{money(totals.paid)}</b></Row>
        <Row bold><span>Solde dû</span><b>{money(totals.balance)}</b></Row>
      </div>

      {/* Planification des paiements */}
      {isInvoice && <div className="edit-card">
        <Row onClick={() => setPayOpen(o => !o)} chevron>
          <div className="row-text">
            <b>Planification des paiements</b>
            <small>Gérez le dépôt, les paiements à venir et enregistrez tous les paiements précédemment effectués</small>
          </div>
        </Row>
        {payOpen && <div className="row-detail">
          {(doc.payments || []).length === 0 && <p className="hint">Aucun paiement enregistré.</p>}
          {(doc.payments || []).map(p => <div className="payment-row" key={p.id}>
            <span>{fmtDate(p.date)} — {p.method}</span>
            <b>{money(p.amount)}</b>
            <button className="icon danger" onClick={() => set({ payments: doc.payments.filter(x => x.id !== p.id) })}><Trash2 size={15}/></button>
          </div>)}
          <button className="link-btn" onClick={addPayment}>Enregistrer un paiement</button>
        </div>}
      </div>}

      {/* Photo */}
      <div className="edit-card">
        <label className="edit-row file-row">
          <span className={doc.photos.length ? '' : 'hint'}>{doc.photos.length ? `${doc.photos.length} photo${doc.photos.length > 1 ? 's' : ''}` : 'Ajouter une photo'}</span>
          <Paperclip size={19} className="hint"/>
          <input type="file" accept="image/*" multiple onChange={addPhotos} hidden/>
        </label>
        {doc.photos.length > 0 && <div className="photo-grid">
          {doc.photos.map(p => <div className="photo" key={p.id}>
            <img src={p.src}/>
            <button className="icon danger" onClick={() => set({ photos: doc.photos.filter(x => x.id !== p.id) })}><X size={14}/></button>
          </div>)}
        </div>}
      </div>

      {/* Info paiement / remarques */}
      <div className="edit-card">
        <input className="edit-row ghost" placeholder="Info sur le paiement" value={doc.paymentInfo || ''} onChange={e => set({ paymentInfo: e.target.value })}/>
        <textarea className="edit-row ghost notes" rows={3} placeholder="Remarques" value={doc.notes} onChange={e => set({ notes: e.target.value })}/>
      </div>

      {/* Signature */}
      <div className="edit-card">
        <Row onClick={() => setSigOpen(o => !o)} chevron>
          <span className={doc.signature ? '' : 'hint'}><PenLine size={16} style={{ verticalAlign: '-3px', marginRight: 8 }}/>{doc.signature ? 'Signature ajoutée' : 'Signature'}</span>
        </Row>
        {sigOpen && <div className="row-detail">
          <SignaturePad value={doc.signature} onChange={sig => set({ signature: sig })}/>
        </div>}
      </div>

      {isInvoice && totals.balance > 0.005 && totals.total > 0 &&
        <button className="outline-btn" onClick={markPaid}>Marquer comme payée</button>}
      {!isInvoice && !doc.closed &&
        <button className="outline-btn" onClick={convert}>Convertir en facture</button>}
    </div>}

    {view === 'preview' && <div className="preview-body">
      <div className="pdf-frame">
        <InvoicePaper settings={settings} doc={doc} totals={totals}/>
        <button className="expand-btn no-print" onClick={printPdf} title="Plein écran / PDF"><Maximize2 size={20}/></button>
      </div>
    </div>}

    {view === 'history' && <div className="editor-body">
      {(doc.history || []).length === 0 && <div className="empty">
        <span className="empty-circle"><Clock size={38}/></span>
        <p><b>L'historique de vos {isInvoice ? 'factures' : 'devis'} s'affichera ici</b></p>
        <p>Enregistrer manuellement ou envoyer une facture pour enregistrer une version</p>
      </div>}
      {(doc.history || []).slice().reverse().map(h => <div className="history-row" key={h.id}>
        <Clock size={17}/>
        <div>
          <b>{h.label}</b>
          <small>{new Date(h.at).toLocaleString('fr-CA')}</small>
        </div>
      </div>)}
    </div>}

    {view !== 'history' && <>
      {sendOpen && <div className="menu-backdrop no-print" onClick={() => setSendOpen(false)}>
        <div className="send-menu" onClick={e => e.stopPropagation()}>
          <button onClick={previewPdf}><Eye size={19}/> Aperçu PDF</button>
          <div className="send-menu-sep"/>
          {/* Le partage natif est le seul chemin qui attache vraiment le PDF :
              il ouvre Messages, Gmail, WhatsApp… au choix, et permet d'envoyer
              aux deux. Un lien sms: ou mailto: ne transporte que du texte. */}
          {shareable && <>
            <button onClick={sharePdfTo}><Share2 size={19}/> <span>Envoyer le PDF<small>texto, courriel, au choix</small></span></button>
            <div className="send-menu-sep"/>
          </>}
          <button onClick={sendEmail}><Mail size={19}/> <span>Courriel<small>texte seulement</small></span></button>
          <button onClick={sendSms}><MessageSquare size={19}/> <span>Texto<small>texte seulement</small></span></button>
          <button onClick={savePdf}><Download size={19}/> Enregistrer le PDF</button>
          <button onClick={printPdf}><Printer size={19}/> Imprimer</button>
        </div>
      </div>}
      {shareError && <div className="menu-backdrop no-print" onClick={() => setShareError('')}>
        <div className="send-menu" onClick={e => e.stopPropagation()}>
          <p className="hint small-note padded">{shareError}</p>
          <button onClick={() => { setShareError(''); savePdf() }}><Download size={19}/> Enregistrer le PDF</button>
        </div>
      </div>}
      {/* sur l'aperçu, les deux actions sont côte à côte : plus de bouton
          flottant par-dessus le bouton d'impression */}
      {view === 'preview'
        ? <div className="action-bar no-print">
            <button className="outline-btn with-icon" onClick={printPdf}><Printer size={18}/> Imprimer / PDF</button>
            <button className="primary" onClick={() => setSendOpen(o => !o)}><Send size={18}/> Envoyer</button>
          </div>
        : <button className="send-fab no-print" onClick={() => setSendOpen(o => !o)}><Send size={19}/> Envoyer</button>}
    </>}
  </section>
}

export function SignaturePad({ value, onChange }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const getPos = e => {
    const rect = ref.current.getBoundingClientRect()
    const p = e.touches ? e.touches[0] : e
    return {
      x: (p.clientX - rect.left) * (ref.current.width / rect.width),
      y: (p.clientY - rect.top) * (ref.current.height / rect.height)
    }
  }
  const draw = e => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = ref.current.getContext('2d'), p = getPos(e)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a'
    ctx.lineTo(p.x, p.y); ctx.stroke()
  }
  const start = e => {
    drawing.current = true
    const ctx = ref.current.getContext('2d'), p = getPos(e)
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange(ref.current.toDataURL('image/png'))
  }
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height); img.src = value }
  }, [])
  return <div className="signature">
    <canvas ref={ref} width="850" height="180"
      onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
      onTouchStart={start} onTouchMove={draw} onTouchEnd={end}/>
    <button className="link-btn" onClick={() => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange('') }}>Effacer la signature</button>
  </div>
}
