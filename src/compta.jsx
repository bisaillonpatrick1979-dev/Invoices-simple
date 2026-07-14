import React, { useMemo, useState } from 'react'
import { ArrowLeft, CreditCard, Settings as SettingsIcon, ChevronRight } from 'lucide-react'
import { calcTotals, docStatus, money } from './store.js'
import { AppBar } from './lists.jsx'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const COMPTA_TABS = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'rapports', label: 'Rapports' }
]

function useAccounting(docs, expenses, year) {
  return useMemo(() => {
    const invoices = docs.filter(d => d.docType === 'invoice')
    // Revenus = paiements reçus dans l'année
    const payments = invoices.flatMap(d => (d.payments || []).map(p => ({ ...p, client: d.client?.name || 'Client', number: d.number })))
      .filter(p => (p.date || '').startsWith(year))
    const revenue = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
    const exps = expenses.filter(e => (e.date || '').startsWith(year))
    const expensesTotal = exps.reduce((s, e) => s + Number(e.amount || 0), 0)
    const byMonth = MONTHS.map((label, i) => {
      const mm = String(i + 1).padStart(2, '0')
      return {
        label,
        revenue: payments.filter(p => p.date?.slice(5, 7) === mm).reduce((s, p) => s + Number(p.amount || 0), 0),
        expenses: exps.filter(e => e.date?.slice(5, 7) === mm).reduce((s, e) => s + Number(e.amount || 0), 0)
      }
    })
    return { payments, exps, revenue, expensesTotal, net: revenue - expensesTotal, byMonth }
  }, [docs, expenses, year])
}

export function ComptaScreen({ docs, expenses, onOpenSettings }) {
  const [view, setView] = useState('apercu')
  const year = String(new Date().getFullYear())
  const acc = useAccounting(docs, expenses, year)
  const max = Math.max(...acc.byMonth.map(m => Math.max(m.revenue, m.expenses)), 1)

  return <section className="screen">
    <AppBar
      title="Comptabilité"
      left={<button className="icon light" onClick={onOpenSettings}><SettingsIcon size={22}/></button>}
      tabs={COMPTA_TABS}
      activeTab={view}
      onTab={setView}
    />

    {view === 'apercu' && <div className="editor-body">
      <div className="stat-card"><small>Revenue</small><b>{money(acc.revenue)}</b></div>
      <div className="stat-card"><small>Expenses</small><b>{money(acc.expensesTotal)}</b></div>
      <div className="stat-card"><small>Net Profit</small><b className={acc.net >= 0 ? 'pos' : 'neg'}>{money(acc.net)}</b></div>

      <div className="edit-card chart-card">
        <div className="chart-head">
          <b>Profit & Loss — {year}</b>
          <span className="legend"><i className="dot rev"/> Revenue <i className="dot exp"/> Expenses</span>
        </div>
        <div className="pl-chart">
          {acc.byMonth.map(m => <div className="pl-col" key={m.label}>
            <div className="pl-bars">
              <div className="pl-bar rev" style={{ height: `${Math.round((m.revenue / max) * 100)}%` }}/>
              <div className="pl-bar exp" style={{ height: `${Math.round((m.expenses / max) * 100)}%` }}/>
            </div>
            <small>{m.label}</small>
          </div>)}
        </div>
      </div>
    </div>}

    {view === 'transactions' && <div className="editor-body">
      <div className="edit-card">
        {acc.payments.length === 0 && acc.exps.length === 0 && <div className="empty"><p>Les paiements reçus et vos dépenses s'afficheront ici.</p></div>}
        {acc.payments.map(p => <div className="edit-row" key={p.id}>
          <div className="row-text"><b>{p.client}</b><small>{p.number} • paiement reçu</small></div>
          <b className="pos">+{money(p.amount)}</b>
        </div>)}
        {acc.exps.map(e => <div className="edit-row" key={e.id}>
          <div className="row-text"><b>{e.description}</b><small>{e.category} • dépense</small></div>
          <b className="neg">-{money(e.amount)}</b>
        </div>)}
      </div>
    </div>}

    {view === 'rapports' && <div className="editor-body">
      <div className="edit-card">
        <div className="edit-row"><b>Profit and Loss — {year}</b></div>
        <div className="edit-row"><span>Revenue</span><b>{money(acc.revenue)}</b></div>
        <div className="edit-row"><span>Operating Expenses</span><b>{money(acc.expensesTotal)}</b></div>
        <div className="edit-row bold"><span>Net Profit</span><b className={acc.net >= 0 ? 'pos' : 'neg'}>{money(acc.net)}</b></div>
      </div>
    </div>}
  </section>
}

export function RapportsScreen({ docs, onBack }) {
  const invoices = useMemo(() => docs
    .filter(d => d.docType === 'invoice')
    .map(d => ({ doc: d, status: docStatus(d), totals: calcTotals(d) })), [docs])

  const years = useMemo(() => {
    const ys = new Set(invoices.map(({ doc }) => (doc.date || '').slice(0, 4)).filter(Boolean))
    ys.add(String(new Date().getFullYear()))
    return [...ys].sort().reverse()
  }, [invoices])

  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [view, setView] = useState('months')

  const inYear = invoices.filter(({ doc }) => (doc.date || '').startsWith(year))
  const billed = inYear.reduce((s, x) => s + x.totals.total, 0)
  const paid = inYear.reduce((s, x) => s + x.totals.paid, 0)
  const outstanding = inYear.reduce((s, x) => s + Math.max(x.totals.balance, 0), 0)

  const byMonth = MONTHS.map((label, i) => {
    const mm = String(i + 1).padStart(2, '0')
    const rows = inYear.filter(({ doc }) => doc.date?.slice(5, 7) === mm)
    return { label, total: rows.reduce((s, x) => s + x.totals.total, 0), count: rows.length }
  })

  const byClient = Object.values(inYear.reduce((acc, x) => {
    const name = x.doc.client?.name || 'Sans client'
    acc[name] = acc[name] || { label: name, total: 0, count: 0 }
    acc[name].total += x.totals.total
    acc[name].count += 1
    return acc
  }, {})).sort((a, b) => b.total - a.total)

  const byItem = Object.values(inYear.flatMap(x => x.doc.lines).reduce((acc, l) => {
    const name = l.description?.trim() || 'Sans description'
    const total = Number(l.qty || 0) * Number(l.rate || 0)
    acc[name] = acc[name] || { label: name, total: 0, count: 0 }
    acc[name].total += total
    acc[name].count += 1
    return acc
  }, {})).sort((a, b) => b.total - a.total)

  const rows = view === 'months' ? byMonth : view === 'clients' ? byClient : byItem
  const max = Math.max(...rows.map(r => r.total), 1)

  return <section className="screen">
    <AppBar
      title="Rapports"
      left={<button className="icon light" onClick={onBack}><ArrowLeft size={22}/></button>}
      right={<select className="year-pick" value={year} onChange={e => setYear(e.target.value)}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>}
      tabs={[
        { id: 'months', label: 'Par mois' },
        { id: 'clients', label: 'Par client' },
        { id: 'items', label: 'Par article' }
      ]}
      activeTab={view}
      onTab={setView}
    />

    <div className="editor-body">
      <div className="stat-card"><small>Facturé</small><b>{money(billed)}</b></div>
      <div className="stat-card"><small>Payé</small><b className="pos">{money(paid)}</b></div>
      <div className="stat-card"><small>Impayé</small><b className="neg">{money(outstanding)}</b></div>

      <div className="edit-card">
        {rows.length === 0 && <div className="empty"><p>Aucune donnée pour cette année.</p></div>}
        <div className="report-rows">
          {rows.map(r => <div className="report-row" key={r.label}>
            <span className="report-label">{r.label}</span>
            <div className="bar-track"><div className="bar" style={{ width: `${Math.round((r.total / max) * 100)}%` }}/></div>
            <b>{money(r.total)}</b>
          </div>)}
        </div>
      </div>
    </div>
  </section>
}

export function PaiementsScreen({ onOpenSettings }) {
  return <section className="screen">
    <AppBar title="Paiements" left={<button className="icon light" onClick={onOpenSettings}><SettingsIcon size={22}/></button>}/>
    <div className="editor-body pay-setup">
      <div className="empty tall">
        <CreditCard size={60} strokeWidth={1.2} className="pay-ico"/>
        <p><b>Terminer la configuration des paiements</b></p>
        <p>Vous êtes presque prêt à accepter les paiements en ligne et à être payé deux fois plus vite !</p>
        <button className="primary" onClick={onOpenSettings}>Terminer la configuration</button>
        <small className="hint">Ajoute tes instructions de paiement (virement Interac, chèque...) dans les réglages — elles sortiront sur chaque facture.</small>
      </div>
      <div className="edit-card">
        <div className="edit-row">
          <div className="row-text">
            <b>Paiements en ligne</b>
            <small>Pour accepter les cartes de crédit et paiements en ligne, il faudra brancher plus tard un fournisseur de paiement (Stripe, PayPal...). Pour l'instant, utilise les instructions de paiement sur la facture.</small>
          </div>
          <ChevronRight size={20} className="row-chev"/>
        </div>
      </div>
    </div>
  </section>
}
