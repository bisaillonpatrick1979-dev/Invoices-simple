import React, { useState } from 'react'
import { Plus, Trash2, Pencil, Search } from 'lucide-react'
import { emptyClient, emptyItem, money, uid } from './store.js'

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function ClientsScreen({ clients, setClients }) {
  const [draft, setDraft] = useState(emptyClient)
  const [query, setQuery] = useState('')
  const editing = Boolean(draft.id)

  const submit = () => {
    if (!draft.name.trim()) return alert('Entre au minimum le nom du client.')
    const c = { ...draft, id: draft.id || uid() }
    setClients(list => list.some(x => x.id === c.id) ? list.map(x => x.id === c.id ? c : x) : [...list, c])
    setDraft(emptyClient)
  }

  const q = query.trim().toLowerCase()
  const list = clients.filter(c => !q || [c.name, c.email, c.phone, c.city].some(v => String(v || '').toLowerCase().includes(q)))

  return <section className="screen">
    <header className="screen-head">
      <div><h1>Clients</h1><p className="muted">{clients.length} client{clients.length > 1 ? 's' : ''} en mémoire</p></div>
    </header>

    <div className="grid two">
      <div className="card">
        <h2 className="section-title">{editing ? 'Modifier client' : 'Ajouter client'}</h2>
        <Field label="Nom"><input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></Field>
        <div className="grid two smallgap">
          <Field label="Téléphone"><input value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })}/></Field>
          <Field label="Email"><input value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></Field>
        </div>
        <Field label="Adresse"><textarea rows={2} value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })}/></Field>
        <Field label="Ville"><input value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })}/></Field>
        <div className="actions">
          <button className="primary" onClick={submit}><Plus size={17}/> {editing ? 'Sauvegarder' : 'Ajouter à la mémoire'}</button>
          {editing && <button onClick={() => setDraft(emptyClient)}>Annuler</button>}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Clients sauvegardés</h2>
        <div className="searchbar inset">
          <Search size={16}/>
          <input placeholder="Chercher un client..." value={query} onChange={e => setQuery(e.target.value)}/>
        </div>
        <div className="list">
          {list.length === 0 && <p className="muted">Aucun client.</p>}
          {list.map(c => <div className="item" key={c.id}>
            <div className="avatar">{c.name.charAt(0).toUpperCase()}</div>
            <div>
              <b>{c.name}</b>
              <p>{c.phone}{c.email ? ` • ${c.email}` : ''}</p>
              <small>{c.address} {c.city}</small>
            </div>
            <div className="row-actions">
              <button className="icon" onClick={() => setDraft(c)}><Pencil size={15}/></button>
              <button className="icon danger" onClick={() => { if (confirm(`Supprimer ${c.name} ?`)) setClients(clients.filter(x => x.id !== c.id)) }}><Trash2 size={15}/></button>
            </div>
          </div>)}
        </div>
      </div>
    </div>
  </section>
}

export function ItemsScreen({ items, setItems }) {
  const [draft, setDraft] = useState(emptyItem)
  const editing = Boolean(draft.id)

  const submit = () => {
    if (!draft.description.trim()) return alert('Entre une description.')
    const it = { ...draft, id: draft.id || uid(), rate: Number(draft.rate || 0) }
    setItems(list => list.some(x => x.id === it.id) ? list.map(x => x.id === it.id ? it : x) : [...list, it])
    setDraft(emptyItem)
  }

  return <section className="screen">
    <header className="screen-head">
      <div><h1>Items</h1><p className="muted">Produits et services réutilisables dans tes invoices</p></div>
    </header>

    <div className="grid two">
      <div className="card">
        <h2 className="section-title">{editing ? 'Modifier item' : 'Ajouter item'}</h2>
        <Field label="Description"><input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Main d'œuvre, matériel..."/></Field>
        <div className="grid two smallgap">
          <Field label="Prix"><input type="number" value={draft.rate} onChange={e => setDraft({ ...draft, rate: e.target.value })}/></Field>
          <Field label="Unité"><input value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}/></Field>
        </div>
        <label className="check"><input type="checkbox" checked={draft.taxable !== false} onChange={e => setDraft({ ...draft, taxable: e.target.checked })}/> Taxable</label>
        <div className="actions">
          <button className="primary" onClick={submit}><Plus size={17}/> {editing ? 'Sauvegarder' : 'Ajouter au catalogue'}</button>
          {editing && <button onClick={() => setDraft(emptyItem)}>Annuler</button>}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Items sauvegardés</h2>
        <div className="list">
          {items.length === 0 && <p className="muted">Aucun item. Tu peux aussi sauvegarder une ligne directement depuis l'éditeur d'invoice.</p>}
          {items.map(it => <div className="item" key={it.id}>
            <div>
              <b>{it.description}</b>
              <p>{money(it.rate)} / {it.unit}{it.taxable !== false ? ' • taxable' : ''}</p>
            </div>
            <div className="row-actions">
              <button className="icon" onClick={() => setDraft(it)}><Pencil size={15}/></button>
              <button className="icon danger" onClick={() => setItems(items.filter(x => x.id !== it.id))}><Trash2 size={15}/></button>
            </div>
          </div>)}
        </div>
      </div>
    </div>
  </section>
}
