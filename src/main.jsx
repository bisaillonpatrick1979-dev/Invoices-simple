import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Building2, FileText, Users, Settings, Plus, Trash2, Eye, Send, Mail, MessageSquare, Printer, Save, PenLine } from 'lucide-react'
import './styles.css'

const GST_RATE = 0.05
const uid = () => Math.random().toString(36).slice(2, 10)
const money = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0))
const today = () => new Date().toISOString().slice(0, 10)
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value))

const emptyCompany = {
  name: 'Votre compagnie',
  phone: '',
  email: '',
  address: '',
  city: 'Calgary, AB',
  gst: '',
  website: '',
  logo: ''
}
const emptyClient = { id: '', name: '', phone: '', email: '', address: '', city: '', notes: '' }
const emptyInvoice = {
  id: uid(),
  number: 'INV-' + new Date().getFullYear() + '-001',
  date: today(),
  dueDate: '',
  clientId: '',
  client: { ...emptyClient },
  title: 'Invoice / Facture',
  notes: '',
  lines: [{ id: uid(), description: '', qty: 1, unit: 'ea', price: 0 }],
  chargeGst: true,
  discountType: '$',
  discountValue: 0,
  signature: '',
  status: 'Draft'
}

function App() {
  const [tab, setTab] = useState('invoice')
  const [company, setCompany] = useState(() => load('inv_company', emptyCompany))
  const [clients, setClients] = useState(() => load('inv_clients', []))
  const [invoices, setInvoices] = useState(() => load('inv_invoices', []))
  const [invoice, setInvoice] = useState(() => load('inv_current', emptyInvoice))
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => save('inv_company', company), [company])
  useEffect(() => save('inv_clients', clients), [clients])
  useEffect(() => save('inv_invoices', invoices), [invoices])
  useEffect(() => save('inv_current', invoice), [invoice])

  const totals = useMemo(() => calcTotals(invoice), [invoice])

  const setLine = (id, key, value) => setInvoice(inv => ({
    ...inv,
    lines: inv.lines.map(l => l.id === id ? { ...l, [key]: value } : l)
  }))

  const selectClient = id => {
    const c = clients.find(x => x.id === id)
    setInvoice(inv => ({ ...inv, clientId: id, client: c ? { ...c } : { ...emptyClient, id: '' } }))
  }

  const saveClientFromInvoice = () => {
    const c = { ...invoice.client, id: invoice.clientId || uid() }
    if (!c.name.trim()) return alert('Entre au minimum le nom du client.')
    setClients(list => {
      const exists = list.some(x => x.id === c.id)
      return exists ? list.map(x => x.id === c.id ? c : x) : [...list, c]
    })
    setInvoice(inv => ({ ...inv, clientId: c.id, client: c }))
  }

  const saveInvoice = () => {
    const stored = { ...invoice, updatedAt: new Date().toISOString(), total: totals.total }
    setInvoices(list => list.some(x => x.id === stored.id) ? list.map(x => x.id === stored.id ? stored : x) : [stored, ...list])
    alert('Invoice sauvegardée.')
  }

  const newInvoice = () => {
    const nextNumber = 'INV-' + new Date().getFullYear() + '-' + String(invoices.length + 2).padStart(3, '0')
    setInvoice({ ...emptyInvoice, id: uid(), number: nextNumber, date: today(), lines: [{ id: uid(), description: '', qty: 1, unit: 'ea', price: 0 }] })
    setShowPreview(false)
    setTab('invoice')
  }

  const loadInvoice = inv => {
    setInvoice(inv)
    setTab('invoice')
    setShowPreview(false)
  }

  return (
    <div className="app">
      <header className="topbar no-print">
        <div>
          <p className="eyebrow">Invoices Simple</p>
          <h1>Création & gestion d’invoices</h1>
        </div>
        <button onClick={() => setShowPreview(true)} className="primary"><Eye size={18}/> Preview PDF</button>
      </header>

      <nav className="tabs no-print">
        <button className={tab==='invoice'?'active':''} onClick={()=>setTab('invoice')}><FileText/> Invoice</button>
        <button className={tab==='clients'?'active':''} onClick={()=>setTab('clients')}><Users/> Clients</button>
        <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><Save/> Historique</button>
        <button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><Settings/> Settings</button>
      </nav>

      <main className="content no-print">
        {tab === 'invoice' && <InvoiceEditor invoice={invoice} setInvoice={setInvoice} clients={clients} selectClient={selectClient} setLine={setLine} totals={totals} saveClientFromInvoice={saveClientFromInvoice} saveInvoice={saveInvoice} newInvoice={newInvoice} setShowPreview={setShowPreview}/>} 
        {tab === 'clients' && <Clients clients={clients} setClients={setClients} selectClient={selectClient}/>} 
        {tab === 'history' && <History invoices={invoices} loadInvoice={loadInvoice}/>} 
        {tab === 'settings' && <SettingsPanel company={company} setCompany={setCompany}/>} 
      </main>

      {showPreview && <PreviewModal company={company} invoice={invoice} totals={totals} onClose={()=>setShowPreview(false)} saveInvoice={saveInvoice}/>} 
    </div>
  )
}

function calcTotals(inv) {
  const subtotal = inv.lines.reduce((s,l)=>s + Number(l.qty || 0) * Number(l.price || 0), 0)
  const rawDiscount = inv.discountType === '%' ? subtotal * (Number(inv.discountValue || 0) / 100) : Number(inv.discountValue || 0)
  const discount = Math.min(Math.max(rawDiscount, 0), subtotal)
  const taxable = subtotal - discount
  const gst = inv.chargeGst ? taxable * GST_RATE : 0
  return { subtotal, discount, taxable, gst, total: taxable + gst }
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function InvoiceEditor({ invoice, setInvoice, clients, selectClient, setLine, totals, saveClientFromInvoice, saveInvoice, newInvoice, setShowPreview }) {
  return <section className="grid two">
    <div className="card">
      <h2>Invoice</h2>
      <div className="grid two smallgap">
        <Field label="Numéro"><input value={invoice.number} onChange={e=>setInvoice({...invoice, number:e.target.value})}/></Field>
        <Field label="Date"><input type="date" value={invoice.date} onChange={e=>setInvoice({...invoice, date:e.target.value})}/></Field>
        <Field label="Due date"><input type="date" value={invoice.dueDate} onChange={e=>setInvoice({...invoice, dueDate:e.target.value})}/></Field>
        <Field label="Titre"><input value={invoice.title} onChange={e=>setInvoice({...invoice, title:e.target.value})}/></Field>
      </div>

      <h3>Client</h3>
      <Field label="Client en mémoire">
        <select value={invoice.clientId} onChange={e=>selectClient(e.target.value)}>
          <option value="">Nouveau client / entrer manuellement</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.city ? `— ${c.city}` : ''}</option>)}
        </select>
      </Field>
      <div className="grid two smallgap">
        <Field label="Nom client"><input value={invoice.client.name} onChange={e=>setInvoice({...invoice, client:{...invoice.client, name:e.target.value}})}/></Field>
        <Field label="Téléphone"><input value={invoice.client.phone} onChange={e=>setInvoice({...invoice, client:{...invoice.client, phone:e.target.value}})}/></Field>
        <Field label="Email"><input value={invoice.client.email} onChange={e=>setInvoice({...invoice, client:{...invoice.client, email:e.target.value}})}/></Field>
        <Field label="Ville"><input value={invoice.client.city} onChange={e=>setInvoice({...invoice, client:{...invoice.client, city:e.target.value}})}/></Field>
      </div>
      <Field label="Adresse client"><textarea value={invoice.client.address} onChange={e=>setInvoice({...invoice, client:{...invoice.client, address:e.target.value}})}/></Field>
      <button className="soft" onClick={saveClientFromInvoice}><Save size={18}/> Sauvegarder client en mémoire</button>
    </div>

    <div className="card">
      <h2>Description & prix</h2>
      <div className="line-editor">
        {invoice.lines.map((l, idx) => <div className="line-row" key={l.id}>
          <b>#{idx+1}</b>
          <input className="desc" placeholder="Description du travail / matériel" value={l.description} onChange={e=>setLine(l.id, 'description', e.target.value)}/>
          <input type="number" placeholder="Qty" value={l.qty} onChange={e=>setLine(l.id, 'qty', e.target.value)}/>
          <input placeholder="Unité" value={l.unit} onChange={e=>setLine(l.id, 'unit', e.target.value)}/>
          <input type="number" placeholder="Prix" value={l.price} onChange={e=>setLine(l.id, 'price', e.target.value)}/>
          <button className="icon" onClick={()=>setInvoice({...invoice, lines: invoice.lines.filter(x=>x.id!==l.id)})}><Trash2 size={16}/></button>
        </div>)}
      </div>
      <button className="soft" onClick={()=>setInvoice({...invoice, lines:[...invoice.lines, {id:uid(), description:'', qty:1, unit:'ea', price:0}]})}><Plus size={18}/> Ajouter une ligne</button>

      <div className="moneybox">
        <label className="check"><input type="checkbox" checked={invoice.chargeGst} onChange={e=>setInvoice({...invoice, chargeGst:e.target.checked})}/> Charger GST 5% Alberta</label>
        <div className="grid two smallgap">
          <Field label="Remise">
            <input type="number" value={invoice.discountValue} onChange={e=>setInvoice({...invoice, discountValue:e.target.value})}/>
          </Field>
          <Field label="Type remise">
            <select value={invoice.discountType} onChange={e=>setInvoice({...invoice, discountType:e.target.value})}>
              <option value="$">$ prix fixe</option>
              <option value="%">% pourcentage</option>
            </select>
          </Field>
        </div>
      </div>

      <Field label="Notes / conditions"><textarea value={invoice.notes} onChange={e=>setInvoice({...invoice, notes:e.target.value})} placeholder="Paiement dû, garantie, détails du chantier..."/></Field>
      <SignaturePad value={invoice.signature} onChange={sig=>setInvoice({...invoice, signature:sig})}/>

      <div className="totals">
        <span>Subtotal</span><b>{money(totals.subtotal)}</b>
        <span>Remise</span><b>-{money(totals.discount)}</b>
        <span>GST</span><b>{money(totals.gst)}</b>
        <span className="grand">Total</span><b className="grand">{money(totals.total)}</b>
      </div>

      <div className="actions">
        <button onClick={saveInvoice}><Save size={18}/> Sauver</button>
        <button onClick={()=>setShowPreview(true)} className="primary"><Eye size={18}/> Preview PDF</button>
        <button onClick={newInvoice}><Plus size={18}/> Nouvelle</button>
      </div>
    </div>
  </section>
}

function SignaturePad({ value, onChange }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const getPos = e => {
    const rect = ref.current.getBoundingClientRect()
    const p = e.touches ? e.touches[0] : e
    return { x: p.clientX - rect.left, y: p.clientY - rect.top }
  }
  const draw = e => {
    if (!drawing.current) return
    e.preventDefault()
    const c = ref.current, ctx = c.getContext('2d'), p = getPos(e)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a'
    ctx.lineTo(p.x, p.y); ctx.stroke()
  }
  const start = e => {
    drawing.current = true
    const c = ref.current, ctx = c.getContext('2d'), p = getPos(e)
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }
  const end = () => { drawing.current = false; onChange(ref.current.toDataURL('image/png')) }
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height)
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img,0,0,c.width,c.height); img.src = value }
  }, [])
  return <div className="signature">
    <div className="sig-head"><span><PenLine size={17}/> Signature tactile</span><button className="soft mini" onClick={()=>{const c=ref.current; c.getContext('2d').clearRect(0,0,c.width,c.height); onChange('')}}>Effacer</button></div>
    <canvas ref={ref} width="850" height="180" onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={draw} onTouchEnd={end}/>
  </div>
}

function SettingsPanel({ company, setCompany }) {
  const logoChange = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCompany({ ...company, logo: reader.result })
    reader.readAsDataURL(file)
  }
  return <section className="card narrow">
    <h2>Informations compagnie</h2>
    <p className="muted">Ces infos sortent automatiquement sur chaque PDF.</p>
    <div className="grid two smallgap">
      <Field label="Nom compagnie"><input value={company.name} onChange={e=>setCompany({...company, name:e.target.value})}/></Field>
      <Field label="Téléphone"><input value={company.phone} onChange={e=>setCompany({...company, phone:e.target.value})}/></Field>
      <Field label="Email"><input value={company.email} onChange={e=>setCompany({...company, email:e.target.value})}/></Field>
      <Field label="GST #"><input value={company.gst} onChange={e=>setCompany({...company, gst:e.target.value})}/></Field>
      <Field label="Ville / province"><input value={company.city} onChange={e=>setCompany({...company, city:e.target.value})}/></Field>
      <Field label="Site web"><input value={company.website} onChange={e=>setCompany({...company, website:e.target.value})}/></Field>
    </div>
    <Field label="Adresse compagnie"><textarea value={company.address} onChange={e=>setCompany({...company, address:e.target.value})}/></Field>
    <Field label="Logo compagnie"><input type="file" accept="image/*" onChange={logoChange}/></Field>
    {company.logo && <div className="logo-preview"><img src={company.logo}/><button className="soft" onClick={()=>setCompany({...company, logo:''})}>Retirer logo</button></div>}
  </section>
}

function Clients({ clients, setClients, selectClient }) {
  const [draft, setDraft] = useState(emptyClient)
  const add = () => {
    if (!draft.name.trim()) return
    setClients([...clients, { ...draft, id: uid() }])
    setDraft(emptyClient)
  }
  return <section className="grid two">
    <div className="card">
      <h2>Ajouter client</h2>
      <Field label="Nom"><input value={draft.name} onChange={e=>setDraft({...draft, name:e.target.value})}/></Field>
      <Field label="Téléphone"><input value={draft.phone} onChange={e=>setDraft({...draft, phone:e.target.value})}/></Field>
      <Field label="Email"><input value={draft.email} onChange={e=>setDraft({...draft, email:e.target.value})}/></Field>
      <Field label="Adresse"><textarea value={draft.address} onChange={e=>setDraft({...draft, address:e.target.value})}/></Field>
      <Field label="Ville"><input value={draft.city} onChange={e=>setDraft({...draft, city:e.target.value})}/></Field>
      <button className="primary" onClick={add}><Plus size={18}/> Ajouter à la mémoire</button>
    </div>
    <div className="card">
      <h2>Clients sauvegardés</h2>
      <div className="list">
        {clients.map(c => <div className="item" key={c.id}>
          <div><b>{c.name}</b><p>{c.phone} {c.email && `• ${c.email}`}</p><small>{c.address} {c.city}</small></div>
          <div className="row-actions"><button onClick={()=>selectClient(c.id)}>Utiliser</button><button className="danger" onClick={()=>setClients(clients.filter(x=>x.id!==c.id))}><Trash2 size={16}/></button></div>
        </div>)}
      </div>
    </div>
  </section>
}

function History({ invoices, loadInvoice }) {
  return <section className="card narrow">
    <h2>Invoices sauvegardées</h2>
    {invoices.length === 0 && <p className="muted">Aucune invoice sauvegardée.</p>}
    <div className="list">
      {invoices.map(inv => <div className="item" key={inv.id}>
        <div><b>{inv.number}</b><p>{inv.client?.name || 'Client'} • {money(inv.total)}</p><small>{inv.date}</small></div>
        <button onClick={()=>loadInvoice(inv)}>Ouvrir</button>
      </div>)}
    </div>
  </section>
}

function PreviewModal({ company, invoice, totals, onClose, saveInvoice }) {
  const subject = encodeURIComponent(`${invoice.number} - ${company.name}`)
  const body = encodeURIComponent(`Bonjour ${invoice.client.name || ''},\n\nVoici votre invoice ${invoice.number} au total de ${money(totals.total)}.\n\nMerci,\n${company.name}`)
  const smsBody = encodeURIComponent(`Bonjour ${invoice.client.name || ''}, votre invoice ${invoice.number} de ${money(totals.total)} est prête. ${company.name}`)
  return <div className="modal">
    <div className="modal-head no-print">
      <h2>Preview PDF</h2>
      <button onClick={onClose}>Fermer</button>
    </div>
    <div className="pdf-wrap">
      <InvoicePdf company={company} invoice={invoice} totals={totals}/>
      <div className="floating-send no-print">
        <button onClick={()=>{saveInvoice(); setTimeout(()=>window.print(), 80)}}><Printer size={20}/> PDF</button>
        <a onClick={saveInvoice} href={`mailto:${invoice.client.email || ''}?subject=${subject}&body=${body}`}><Mail size={20}/> Email</a>
        <a onClick={saveInvoice} href={`sms:${invoice.client.phone || ''}?&body=${smsBody}`}><MessageSquare size={20}/> Texto</a>
      </div>
    </div>
  </div>
}

function InvoicePdf({ company, invoice, totals }) {
  return <article className="invoice-paper">
    <div className="watermark">{company.name}</div>
    <header className="pdf-header">
      <div className="brand">
        {company.logo && <img src={company.logo} />}
        <div><h1>{company.name}</h1><p>{company.address}</p><p>{company.city}</p></div>
      </div>
      <div className="invoice-meta">
        <h2>{invoice.title}</h2>
        <p><b>No:</b> {invoice.number}</p>
        <p><b>Date:</b> {invoice.date}</p>
        {invoice.dueDate && <p><b>Due:</b> {invoice.dueDate}</p>}
      </div>
    </header>

    <section className="pdf-parties">
      <div><h3>Compagnie</h3><p>{company.phone}</p><p>{company.email}</p><p>{company.website}</p>{company.gst && <p>GST: {company.gst}</p>}</div>
      <div><h3>Client</h3><p><b>{invoice.client.name}</b></p><p>{invoice.client.address}</p><p>{invoice.client.city}</p><p>{invoice.client.phone}</p><p>{invoice.client.email}</p></div>
    </section>

    <table className="pdf-lines">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>{invoice.lines.map((l, i)=><tr key={l.id}><td>{l.description || `Ligne ${i+1}`}</td><td>{l.qty}</td><td>{l.unit}</td><td>{money(l.price)}</td><td>{money(Number(l.qty||0)*Number(l.price||0))}</td></tr>)}</tbody>
    </table>

    <div className="pdf-bottom">
      <div className="pdf-notes"><h3>Notes</h3><p>{invoice.notes || 'Merci pour votre confiance.'}</p><div className="sign-box">{invoice.signature ? <img src={invoice.signature}/> : <span>Signature client</span>}</div><small>Signature tactile</small></div>
      <div className="pdf-totals">
        <p><span>Subtotal</span><b>{money(totals.subtotal)}</b></p>
        <p><span>Remise</span><b>-{money(totals.discount)}</b></p>
        <p><span>GST 5%</span><b>{money(totals.gst)}</b></p>
        <p className="total"><span>Total CAD</span><b>{money(totals.total)}</b></p>
      </div>
    </div>
  </article>
}

createRoot(document.getElementById('root')).render(<App />)
