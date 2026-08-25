import React, { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Pencil, Search, X } from 'lucide-react'
import { emptyClient, emptyItem, emptyExpense, EXPENSE_CATEGORIES, fmtDate, money, parseNum, today, uid, UNITS } from './store.js'
import { AppBar, Fab, NumField } from './lists.jsx'

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
  const list = clients.filter(c => !q || [c.name, c.email, c.phone, c.phone2, c.city].some(v => String(v || '').toLowerCase().includes(q)))

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
          <small>{[c.phone, c.phone2, c.email].filter(Boolean).join(' • ')}</small>
          {(c.address || c.city) && <small>{c.address} {c.city}</small>}
        </div>
        <div className="row-actions">
          <button className="icon" onClick={() => setDraft(c)}><Pencil size={17}/></button>
          <button className="icon danger" onClick={() => { if (confirm(`Supprimer ${c.name} ?`)) setClients(clients.filter(x => x.id !== c.id)) }}><Trash2 size={17}/></button>
        </div>
      </div>)}
    </div>
    <Fab onClick={() => setDraft({ ...emptyClient })} title="Nouveau client"/>
    {draft && <FormSheet title={draft.id ? 'Modifier client' : 'Nouveau client'} onClose={() => setDraft(null)} onSubmit={submit} submitLabel="Enregistrer">
      <input placeholder="Nom" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/>
      <div className="pair">
        <input placeholder="Téléphone" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })}/>
        <input placeholder="2e téléphone (contremaître, bureau…)" value={draft.phone2 || ''} onChange={e => setDraft({ ...draft, phone2: e.target.value })}/>
        <input placeholder="Email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/>
      </div>
      <input placeholder="Adresse" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })}/>
      <input placeholder="Ville" value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })}/>
    </FormSheet>}
  </section>
}

export function ItemsScreen({ items, setItems, onBack }) {
  const [draft, setDraft] = useState(null)
  const [query, setQuery] = useState('')

  const submit = () => {
    if (!draft.description.trim()) return alert('Entre une description.')
    const it = { ...draft, id: draft.id || uid(), rate: parseNum(draft.rate), unit: draft.unit || 'ea' }
    setItems(list => list.some(x => x.id === it.id) ? list.map(x => x.id === it.id ? it : x) : [...list, it])
    setDraft(null)
  }

  const q = query.trim().toLowerCase()
  const list = items
    .filter(it => !q || String(it.description || '').toLowerCase().includes(q))
    .sort((a, b) => String(a.description).localeCompare(String(b.description), 'fr'))

  return <section className="screen">
    <AppBar title="Articles" left={<button className="icon light" onClick={onBack}><ArrowLeft size={22}/></button>}/>
    <div className="searchbar">
      <Search size={17}/>
      <input placeholder="Chercher un article..." value={query} onChange={e => setQuery(e.target.value)}/>
    </div>
    <div className="doclist">
      {items.length === 0 && <div className="empty">
        <p><b>Ta liste de prix</b></p>
        <p>Enregistre ici les travaux et matériaux qui reviennent souvent, avec leur prix à l'unité — par exemple « Poser des panneaux » à 3,00 $ / pi².</p>
        <p>Tu peux aussi enregistrer un prix directement depuis une facture, avec le bouton signet à côté de la ligne.</p>
      </div>}
      {items.length > 0 && <div className="year-head"><span>{list.length} article{list.length > 1 ? 's' : ''}</span></div>}
      {list.map(it => <div className="docrow static" key={it.id}>
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
    <Fab onClick={() => setDraft({ ...emptyItem })} title="Nouvel article"/>
    {draft && <FormSheet title={draft.id ? 'Modifier article' : 'Nouvel article'} onClose={() => setDraft(null)} onSubmit={submit} submitLabel="Enregistrer">
      <input placeholder="Description (ex. : Poser des panneaux)" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/>
      <div className="pair">
        <NumField placeholder="Prix (ex. : 3)" value={draft.rate} onChange={v => setDraft({ ...draft, rate: v })}/>
        <input list="unit-options" placeholder="Unité (ex. : pi²)" value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}/>
      </div>
      <datalist id="unit-options">{UNITS.map(u => <option key={u} value={u}/>)}</datalist>
      <label className="check"><input type="checkbox" checked={draft.taxable !== false} onChange={e => setDraft({ ...draft, taxable: e.target.checked })}/> Taxable</label>
    </FormSheet>}
  </section>
}

export function ExpensesScreen({ expenses, setExpenses, onBack }) {
  const [draft, setDraft] = useState(null)

  const submit = () => {
    if (!draft.description.trim() || !parseNum(draft.amount)) return alert('Entre une description et un montant.')
    const ex = { ...draft, id: draft.id || uid(), amount: parseNum(draft.amount), date: draft.date || today() }
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
    <Fab onClick={() => setDraft({ ...emptyExpense, date: today() })} title="Nouvelle dépense"/>
    {draft && <FormSheet title={draft.id ? 'Modifier dépense' : 'Nouvelle dépense'} onClose={() => setDraft(null)} onSubmit={submit} submitLabel="Enregistrer">
      <input placeholder="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/>
      <div className="pair">
        <NumField placeholder="Montant" value={draft.amount || ''} onChange={v => setDraft({ ...draft, amount: v })}/>
        <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })}/>
      </div>
      <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </FormSheet>}
  </section>
}
