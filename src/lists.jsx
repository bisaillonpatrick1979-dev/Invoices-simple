import React, { useMemo, useState } from 'react'
import { Plus, Search, Trash2, ChevronRight } from 'lucide-react'
import { calcTotals, docStatus, money, STATUS_LABELS } from './store.js'

const FILTERS = {
  invoice: [
    { id: 'all', label: 'Toutes' },
    { id: 'outstanding', label: 'Impayées' },
    { id: 'paid', label: 'Payées' }
  ],
  estimate: [
    { id: 'all', label: 'Toutes' },
    { id: 'draft', label: 'Brouillons' },
    { id: 'sent', label: 'Envoyées' },
    { id: 'approved', label: 'Approuvées' }
  ]
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>
}

export function DocumentList({ type, docs, onOpen, onNew, onDelete }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return docs
      .filter(d => d.docType === type)
      .map(d => ({ doc: d, status: docStatus(d), totals: calcTotals(d) }))
      .filter(({ doc, status }) => {
        if (filter === 'outstanding' && !(status === 'outstanding' || status === 'overdue')) return false
        if (filter !== 'all' && filter !== 'outstanding' && status !== filter) return false
        if (!q) return true
        return [doc.number, doc.client?.name, doc.client?.email].some(v => String(v || '').toLowerCase().includes(q))
      })
      .sort((a, b) => (b.doc.date || '').localeCompare(a.doc.date || '') || (b.doc.updatedAt || '').localeCompare(a.doc.updatedAt || ''))
  }, [docs, type, query, filter])

  const outstandingTotal = useMemo(() => docs
    .filter(d => d.docType === 'invoice')
    .map(d => ({ s: docStatus(d), t: calcTotals(d) }))
    .filter(x => x.s === 'outstanding' || x.s === 'overdue')
    .reduce((s, x) => s + x.t.balance, 0), [docs])

  const title = type === 'invoice' ? 'Invoices' : 'Estimates'

  return <section className="screen">
    <header className="screen-head">
      <div>
        <h1>{title}</h1>
        {type === 'invoice' && <p className="muted">Solde impayé : <b>{money(outstandingTotal)}</b></p>}
      </div>
      <button className="primary" onClick={onNew}><Plus size={18}/> {type === 'invoice' ? 'New Invoice' : 'New Estimate'}</button>
    </header>

    <div className="searchbar">
      <Search size={17}/>
      <input placeholder={`Chercher par client ou numéro...`} value={query} onChange={e => setQuery(e.target.value)}/>
    </div>

    <div className="chips">
      {FILTERS[type].map(f => (
        <button key={f.id} className={filter === f.id ? 'chip active' : 'chip'} onClick={() => setFilter(f.id)}>{f.label}</button>
      ))}
    </div>

    <div className="doclist">
      {list.length === 0 && <div className="empty">
        <p>Aucun document ici.</p>
        <button className="primary" onClick={onNew}><Plus size={18}/> Créer {type === 'invoice' ? 'une invoice' : 'un estimate'}</button>
      </div>}
      {list.map(({ doc, status, totals }) => (
        <div className="docrow" key={doc.id} onClick={() => onOpen(doc)}>
          <div className="avatar">{(doc.client?.name || '?').trim().charAt(0).toUpperCase() || '?'}</div>
          <div className="docinfo">
            <b>{doc.client?.name || 'Sans client'}</b>
            <small>{doc.number} • {doc.date}</small>
          </div>
          <div className="docamount">
            <b>{money(totals.total)}</b>
            <StatusBadge status={status}/>
          </div>
          <button className="icon danger" title="Supprimer" onClick={e => { e.stopPropagation(); if (confirm(`Supprimer ${doc.number} ?`)) onDelete(doc.id) }}><Trash2 size={16}/></button>
          <ChevronRight size={18} className="chev"/>
        </div>
      ))}
    </div>

    <button className="fab no-print" onClick={onNew}><Plus size={26}/></button>
  </section>
}
