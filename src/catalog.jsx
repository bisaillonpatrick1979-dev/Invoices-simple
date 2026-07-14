import React, { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Pencil, Search, X } from 'lucide-react'
import { emptyClient, emptyItem, emptyExpense, EXPENSE_CATEGORIES, fmtDate, money, today, uid } from './store.js'
import { AppBar } from './lists.jsx'

function FormSheet({ title, onClose, onSubmit, submitLabel, children }) {
  return <div className="sheet-backdrop no-print" onClick={onClose}>
    <div className="sheet form-sheet" onClick={e => e.stopPropagation()}>
      <div className="sheet-head">
        <b>{title}</b>
        <button className="icon" onClick={onClose}><X size={20}/></button>
      </div>
      <div className="sheet-form">{children}</div>
      <button className="primary wide" onClick={onSubmit}>{submitLabel}</button>
    </div>
  </div>
}

export function ClientsScreen({ clients, setClients, onBack }) {
  const [draft, setDraft] = useState(null)
  const [query, setQuery] = useState('')

  const submit = () => {
    if (!draft.name.trim()) return alert('Entre au minimum le nom du client.')
    const c = { ...draft, id: draft.id || uid() }
    setClients(list => list.some(x => x.id === c.id) ? list.map(x => x.id === c.id ? c : x) : [...list, c])
    setDraft(null)
  }

  const q = query.trim().toLowerCase()
  const list = clients.filter(c => !q || [c.name, c.email, c.phone, c.city].some(v => String(v || '').toLowerCase().includes(q)))

  return <section className="screen">
    <AppBar title="Clients" left={<button className="icon light" onClick={onBack}><ArrowLeft size={22}/></button>}/>
    <div className="searchbar">
      <Search size={17}/>
      <input placeholder="Chercher un client..." value={query} onChange={e => setQuery(e.target.value)}/>
    </div>
    <div className="doclist">
      {list.length === 0 && <div className="empty"><p>Ajoutez vos clients pour les réutiliser dans vos factures et devis.</p></div>}
      {list.map(c => <div className="docrow static" key={c.id}>
        <div className="docinfo">
          <b>{c.name}</b>
          <small>{c.phone}{c.email ? ` • ${c.email}` : ''}</small>
          {(c.address || c.city) && <small>{c.address} {c.city}</small>}
        </div>
        <div className="row-actions">
          <button className="icon" onClick={() => setDraft(c)}><Pencil size={17}/></button>
          <button className="icon danger" onClick={() => { if (confirm(`Supprimer ${c.name} ?`)) setClients(clients.filter(x => x.id !== c.id)) }}><Trash2 size={17}/></button>
        </div>
      </div>)}
    </div>
    <button className="fab no-print" onClick={() => setDraft({ ...emptyClient })}><Plus size={28}/></button>
    {draft && <FormSheet title={draft.id ? 'Modifier client' : 'Nouveau client'} onClose={() => setDraft(null)} onSubmit={submit} submitLabel="Enregistrer">
      <input placeholder="Nom" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/>
      <div className="pair">
        <input placeholder="Téléphone" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })}/>
        <input placeholder="Email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/>
      </div>
      <input placeholder="Adresse" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })}/>
      <input placeholder="Ville" value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })}/>
    </FormSheet>}
  </section>
}

export function ItemsScreen({ items, setItems, onBack }) {
  const [draft, setDraft] = useState(null)

  const submit = () => {
    if (!draft.description.trim()) return alert('Entre une description.')
    const it = { ...draft, id: draft.id || uid(), rate: Number(draft.rate || 0) }
    setItems(list => list.some(x => x.id === it.id) ? list.map(x => x.id === it.id ? it : x) : [...list, it])
    setDraft(null)
  }

  return <section className="screen">
    <AppBar title="Articles" left={<button className="icon light" onClick={onBack}><ArrowLeft size={22}/></button>}/>
    <div className="doclist">
      {items.length === 0 && <div className="empty"><p>Enregistrez vos produits et services pour les ajouter rapidement à vos factures.</p></div>}
      {items.map(it => <div className="docrow static" key={it.id}>
        <div className="docinfo">
          <b>{it.description}</b>
          <small>{money(it.rate)} / {it.unit}{it.taxable !== false ? ' • taxable' : ''}</small>
        </div>
        <div className="row-actions">
          <button className="icon" onClick={() => setDraft(it)}><Pencil size={17}/></button>
          <button className="icon danger" onClick={() => setItems(items.filter(x => x.id !== it.id))}><Trash2 size={17}/></button>
        </div>
      </div>)}
    </div>
    <button className="fab no-print" onClick={() => setDraft({ ...emptyItem })}><Plus size={28}/></button>
    {draft && <FormSheet title={draft.id ? 'Modifier article' : 'Nouvel article'} onClose={() => setDraft(null)} onSubmit={submit} submitLabel="Enregistrer">
      <input placeholder="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/>
      <div className="pair">
        <input type="number" placeholder="Prix" value={draft.rate} onChange={e => setDraft({ ...draft, rate: e.target.value })}/>
        <input placeholder="Unité" value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}/>
      </div>
      <label className="check"><input type="checkbox" checked={draft.taxable !== false} onChange={e => setDraft({ ...draft, taxable: e.target.checked })}/> Taxable</label>
    </FormSheet>}
  </section>
}

export function ExpensesScreen({ expenses, setExpenses, onBack }) {
  const [draft, setDraft] = useState(null)

  const submit = () => {
    if (!draft.description.trim() || !Number(draft.amount)) return alert('Entre une description et un montant.')
    const ex = { ...draft, id: draft.id || uid(), amount: Number(draft.amount), date: draft.date || today() }
    setExpenses(list => list.some(x => x.id === ex.id) ? list.map(x => x.id === ex.id ? ex : x) : [ex, ...list])
    setDraft(null)
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)

  return <section className="screen">
    <AppBar title="Dépenses" left={<button className="icon light" onClick={onBack}><ArrowLeft size={22}/></button>}/>
    <div className="doclist">
      {expenses.length > 0 && <div className="year-head"><span>Total</span><span>{money(total)}</span></div>}
      {expenses.length === 0 && <div className="empty"><p>Suivez vos dépenses d'entreprise : matériel, essence, outils...</p></div>}
      {expenses.map(ex => <div className="docrow static" key={ex.id}>
        <div className="docinfo">
          <b>{ex.description}</b>
          <small>{ex.category} • {fmtDate(ex.date)}</small>
        </div>
        <div className="docamount"><b>{money(ex.amount)}</b></div>
        <div className="row-actions">
          <button className="icon" onClick={() => setDraft(ex)}><Pencil size={17}/></button>
          <button className="icon danger" onClick={() => setExpenses(expenses.filter(x => x.id !== ex.id))}><Trash2 size={17}/></button>
        </div>
      </div>)}
    </div>
    <button className="fab no-print" onClick={() => setDraft({ ...emptyExpense, date: today() })}><Plus size={28}/></button>
    {draft && <FormSheet title={draft.id ? 'Modifier dépense' : 'Nouvelle dépense'} onClose={() => setDraft(null)} onSubmit={submit} submitLabel="Enregistrer">
      <input placeholder="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/>
      <div className="pair">
        <input type="number" placeholder="Montant" value={draft.amount || ''} onChange={e => setDraft({ ...draft, amount: e.target.value })}/>
        <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })}/>
      </div>
      <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </FormSheet>}
  </section>
}
