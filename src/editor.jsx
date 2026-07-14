import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Plus, Trash2, Save, Eye, Pencil, Mail, MessageSquare, Printer,
  PenLine, Camera, CheckCircle2, FileText
} from 'lucide-react'
import {
  calcTotals, docStatus, dueDateFromTerms, lineTotal, money, newLine,
  STATUS_LABELS, TERMS, uid, today, emptyClient
} from './store.js'
import { StatusBadge } from './lists.jsx'
import { InvoicePaper } from './paper.jsx'

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function buildEmailLink(settings, doc, totals) {
  const b = settings.business
  const kind = doc.docType === 'invoice' ? 'invoice' : 'estimate'
  const subject = encodeURIComponent(`${doc.number} - ${b.name}`)
  const lineText = doc.lines
    .filter(l => l.description || l.qty || l.rate)
    .map(l => `- ${l.description || 'Item'} | Qty: ${l.qty || 0} ${l.unit || ''} | Prix: ${money(l.rate)} | Total: ${money(lineTotal(l))}`)
    .join('\n')
  const body = encodeURIComponent(
`Bonjour ${doc.client.name || ''},

Voici les détails de votre ${kind} ${doc.number}.

${lineText || 'Description à compléter.'}

Subtotal: ${money(totals.subtotal)}
Remise: -${money(totals.discount)}
${settings.taxLabel} ${doc.taxRate}%: ${money(totals.tax)}
Total CAD: ${money(totals.total)}
${totals.paid > 0 ? `Payé: ${money(totals.paid)}\nBalance due: ${money(totals.balance)}\n` : ''}
Note: pour joindre le PDF, cliquez d'abord sur PDF / Save as PDF, puis attachez le fichier dans votre email.

Merci,
${b.name}
${b.phone || ''}
${b.email || ''}`)
  return `mailto:${doc.client.email || ''}?subject=${subject}&body=${body}`
}

export function DocumentEditor({ doc, settings, clients, items, onChange, onSave, onDelete, onConvert, onSaveClient, onSaveItem, onClose }) {
  const [view, setView] = useState('edit')
  const totals = calcTotals(doc)
  const status = docStatus(doc)
  const isInvoice = doc.docType === 'invoice'

  const set = patch => onChange({ ...doc, ...patch })
  const setClient = patch => set({ client: { ...doc.client, ...patch } })
  const setLine = (id, patch) => set({ lines: doc.lines.map(l => l.id === id ? { ...l, ...patch } : l) })

  const persist = (extra = {}, { silent = true } = {}) => {
    const merged = { ...doc, ...extra }
    onChange(merged)
    onSave(merged)
    if (!silent) alert('Document sauvegardé.')
    return merged
  }

  const sendEmail = () => {
    if (!doc.client.email?.trim()) return alert('Ajoute une adresse email au client avant d’envoyer.')
    const saved = persist({ status: status === 'draft' ? 'sent' : doc.status })
    window.location.href = buildEmailLink(settings, saved, totals)
  }

  const sendSms = () => {
    if (!doc.client.phone?.trim()) return alert('Ajoute un numéro de téléphone au client avant d’envoyer par texto.')
    const saved = persist({ status: status === 'draft' ? 'sent' : doc.status })
    const body = encodeURIComponent(`Bonjour ${saved.client.name || ''}, votre ${isInvoice ? 'invoice' : 'estimate'} ${saved.number} de ${money(totals.total)} est prête. ${settings.business.name}`)
    window.location.href = `sms:${saved.client.phone}?&body=${body}`
  }

  const printPdf = () => {
    persist()
    setView('preview')
    setTimeout(() => window.print(), 120)
  }

  const markPaid = () => {
    if (totals.balance <= 0) return
    persist({
      status: 'sent',
      payments: [...(doc.payments || []), { id: uid(), date: today(), amount: Number(totals.balance.toFixed(2)), method: 'Autre' }]
    })
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

  const saveLineAsItem = line => {
    if (!line.description.trim()) return alert('Entre une description avant de sauvegarder l’item.')
    onSaveItem({ id: uid(), description: line.description, unit: line.unit || 'ea', rate: Number(line.rate || 0), taxable: line.taxable !== false })
    alert('Item sauvegardé dans le catalogue.')
  }

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
    <header className="editor-head no-print">
      <button className="icon" onClick={() => { persist(); onClose() }}><ArrowLeft size={20}/></button>
      <div className="editor-title">
        <h1>{doc.number}</h1>
        <StatusBadge status={status}/>
      </div>
      <div className="view-toggle">
        <button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}><Pencil size={16}/> Edit</button>
        <button className={view === 'preview' ? 'active' : ''} onClick={() => { persist(); setView('preview') }}><Eye size={16}/> Preview</button>
      </div>
    </header>

    {view === 'edit' && <div className="editor-body no-print">
      <div className="card">
        <h2 className="section-title">Détails {isInvoice ? 'de l’invoice' : 'de l’estimate'}</h2>
        <div className="grid two smallgap">
          <Field label="Numéro"><input value={doc.number} onChange={e => set({ number: e.target.value })}/></Field>
          <Field label="Date"><input type="date" value={doc.date} onChange={e => set({ date: e.target.value, dueDate: dueDateFromTerms(e.target.value, doc.terms) || doc.dueDate })}/></Field>
          <Field label="Termes">
            <select value={doc.terms} onChange={e => set({ terms: e.target.value, dueDate: dueDateFromTerms(doc.date, e.target.value) || doc.dueDate })}>
              {TERMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Due date"><input type="date" value={doc.dueDate} onChange={e => set({ dueDate: e.target.value, terms: 'custom' })}/></Field>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Bill To — Client</h2>
        <Field label="Client en mémoire">
          <select value={doc.clientId} onChange={e => selectClient(e.target.value)}>
            <option value="">Nouveau client / entrer manuellement</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ''}</option>)}
          </select>
        </Field>
        <div className="grid two smallgap">
          <Field label="Nom client"><input value={doc.client.name} onChange={e => setClient({ name: e.target.value })}/></Field>
          <Field label="Téléphone"><input value={doc.client.phone} onChange={e => setClient({ phone: e.target.value })}/></Field>
          <Field label="Email"><input value={doc.client.email} onChange={e => setClient({ email: e.target.value })}/></Field>
          <Field label="Ville"><input value={doc.client.city} onChange={e => setClient({ city: e.target.value })}/></Field>
        </div>
        <Field label="Adresse client"><textarea rows={2} value={doc.client.address} onChange={e => setClient({ address: e.target.value })}/></Field>
        <button className="soft" onClick={saveClientToBook}><Save size={17}/> Sauvegarder client en mémoire</button>
      </div>

      <div className="card">
        <h2 className="section-title">Items</h2>
        <div className="line-editor">
          {doc.lines.map((l, idx) => <div className="line-block" key={l.id}>
            <div className="line-top">
              <b>#{idx + 1}</b>
              {items.length > 0 && <select className="item-pick" value="" onChange={e => applyItem(l.id, e.target.value)}>
                <option value="">Item sauvegardé...</option>
                {items.map(it => <option key={it.id} value={it.id}>{it.description} — {money(it.rate)}</option>)}
              </select>}
              <button className="icon" title="Sauvegarder comme item" onClick={() => saveLineAsItem(l)}><Save size={15}/></button>
              <button className="icon danger" onClick={() => set({ lines: doc.lines.filter(x => x.id !== l.id) })}><Trash2 size={15}/></button>
            </div>
            <input className="desc" placeholder="Description du travail / matériel" value={l.description} onChange={e => setLine(l.id, { description: e.target.value })}/>
            <div className="line-nums">
              <Field label="Qty"><input type="number" value={l.qty} onChange={e => setLine(l.id, { qty: e.target.value })}/></Field>
              <Field label="Unité"><input value={l.unit} onChange={e => setLine(l.id, { unit: e.target.value })}/></Field>
              <Field label="Prix"><input type="number" value={l.rate} onChange={e => setLine(l.id, { rate: e.target.value })}/></Field>
              <div className="line-amount"><span>Total</span><b>{money(lineTotal(l))}</b></div>
            </div>
            <label className="check small"><input type="checkbox" checked={l.taxable !== false} onChange={e => setLine(l.id, { taxable: e.target.checked })}/> Taxable ({settings.taxLabel})</label>
          </div>)}
        </div>
        <button className="soft" onClick={() => set({ lines: [...doc.lines, newLine()] })}><Plus size={17}/> Ajouter une ligne</button>
      </div>

      <div className="card">
        <h2 className="section-title">Taxe, remise & total</h2>
        <label className="check"><input type="checkbox" checked={doc.chargeTax} onChange={e => set({ chargeTax: e.target.checked })}/> Charger {settings.taxLabel} {doc.taxRate}%{settings.taxLabel === 'GST' && doc.taxRate === 5 ? ' Alberta' : ''}</label>
        <div className="grid two smallgap">
          <Field label={`Taux ${settings.taxLabel} %`}><input type="number" value={doc.taxRate} onChange={e => set({ taxRate: e.target.value })}/></Field>
          <div/>
          <Field label="Remise"><input type="number" value={doc.discountValue} onChange={e => set({ discountValue: e.target.value })}/></Field>
          <Field label="Type remise">
            <select value={doc.discountType} onChange={e => set({ discountType: e.target.value })}>
              <option value="$">$ prix fixe</option>
              <option value="%">% pourcentage</option>
            </select>
          </Field>
        </div>
        <div className="totals">
          <span>Subtotal</span><b>{money(totals.subtotal)}</b>
          <span>Remise</span><b>-{money(totals.discount)}</b>
          <span>{settings.taxLabel} {doc.taxRate}%</span><b>{money(totals.tax)}</b>
          <span className="grand">Total</span><b className="grand">{money(totals.total)}</b>
          {totals.paid > 0 && <><span>Payé</span><b>-{money(totals.paid)}</b>
          <span className="grand">Balance due</span><b className="grand">{money(totals.balance)}</b></>}
        </div>
        {isInvoice && <div className="payments">
          {(doc.payments || []).map(p => <div className="payment-row" key={p.id}>
            <CheckCircle2 size={16} className="paid-ico"/>
            <span>{p.date} — {p.method}</span>
            <b>{money(p.amount)}</b>
            <button className="icon danger" onClick={() => set({ payments: doc.payments.filter(x => x.id !== p.id) })}><Trash2 size={14}/></button>
          </div>)}
          {totals.balance > 0.005 && <button className="paid-btn" onClick={markPaid}><CheckCircle2 size={17}/> Marquer payée ({money(totals.balance)})</button>}
        </div>}
      </div>

      <div className="card">
        <h2 className="section-title">Photos</h2>
        <div className="photo-grid">
          {doc.photos.map(p => <div className="photo" key={p.id}>
            <img src={p.src}/>
            <button className="icon danger" onClick={() => set({ photos: doc.photos.filter(x => x.id !== p.id) })}><Trash2 size={14}/></button>
          </div>)}
          <label className="photo add">
            <Camera size={22}/><span>Ajouter</span>
            <input type="file" accept="image/*" multiple onChange={addPhotos} hidden/>
          </label>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Notes & signature</h2>
        <Field label="Notes / conditions"><textarea rows={3} value={doc.notes} onChange={e => set({ notes: e.target.value })} placeholder="Paiement dû, garantie, détails du chantier..."/></Field>
        <SignaturePad value={doc.signature} onChange={sig => set({ signature: sig })}/>
      </div>

      <div className="editor-actions">
        <button onClick={() => persist({}, { silent: false })}><Save size={17}/> Sauver</button>
        <button className="primary" onClick={() => { persist(); setView('preview') }}><Eye size={17}/> Preview</button>
        {!isInvoice && <button className="convert" onClick={() => onConvert(doc)}><FileText size={17}/> Convertir en invoice</button>}
        <button className="danger-line" onClick={() => { if (confirm(`Supprimer ${doc.number} ?`)) { onDelete(); onClose() } }}><Trash2 size={17}/> Supprimer</button>
      </div>
    </div>}

    {view === 'preview' && <div className="pdf-wrap">
      <InvoicePaper settings={settings} doc={doc} totals={totals}/>
      <div className="floating-send no-print">
        <button onClick={printPdf}><Printer size={20}/> PDF</button>
        <button className="email-action" onClick={sendEmail}><Mail size={20}/> Email</button>
        <button className="sms-action" onClick={sendSms}><MessageSquare size={20}/> Texto</button>
      </div>
    </div>}
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
    <div className="sig-head">
      <span><PenLine size={16}/> Signature tactile</span>
      <button className="soft mini" onClick={() => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange('') }}>Effacer</button>
    </div>
    <canvas ref={ref} width="850" height="180"
      onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
      onTouchStart={start} onTouchMove={draw} onTouchEnd={end}/>
  </div>
}
