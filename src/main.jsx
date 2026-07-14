import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  FileText, ClipboardList, Calculator, CreditCard, MoreHorizontal,
  Users, Package, ReceiptText, BarChart3, Settings as SettingsIcon, X
} from 'lucide-react'
import { load, save, emptySettings, migrateOldData, newDocument } from './store.js'
import { DocumentList } from './lists.jsx'
import { DocumentEditor } from './editor.jsx'
import { ClientsScreen, ItemsScreen, ExpensesScreen } from './catalog.jsx'
import { ComptaScreen, RapportsScreen, PaiementsScreen } from './compta.jsx'
import { SettingsScreen } from './settings.jsx'
import './styles.css'

const NAV = [
  { id: 'factures', label: 'Factures', icon: FileText },
  { id: 'devis', label: 'Devis', icon: ClipboardList },
  { id: 'compta', label: 'Comptabilité', icon: Calculator, badge: 'Nouv.' },
  { id: 'paiements', label: 'Paiements', icon: CreditCard },
  { id: 'plus', label: 'Plus', icon: MoreHorizontal }
]

const PLUS_ITEMS = [
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'articles', label: 'Articles', icon: Package },
  { id: 'depenses', label: 'Dépenses', icon: ReceiptText },
  { id: 'rapports', label: 'Rapports', icon: BarChart3 },
  { id: 'settings', label: 'Réglages', icon: SettingsIcon }
]

function App() {
  const [migrated] = useState(() => migrateOldData())
  const [tab, setTab] = useState('factures')
  const [plusOpen, setPlusOpen] = useState(false)
  const [settings, setSettings] = useState(() => migrated?.settings || load('is_settings', emptySettings))
  const [clients, setClients] = useState(() => migrated?.clients || load('is_clients', []))
  const [items, setItems] = useState(() => load('is_items', []))
  const [expenses, setExpenses] = useState(() => load('is_expenses', []))
  const [docs, setDocs] = useState(() => migrated?.docs || load('is_docs', []))
  const [editing, setEditing] = useState(null)

  useEffect(() => save('is_settings', settings), [settings])
  useEffect(() => save('is_clients', clients), [clients])
  useEffect(() => save('is_items', items), [items])
  useEffect(() => save('is_expenses', expenses), [expenses])
  useEffect(() => save('is_docs', docs), [docs])

  const upsertDoc = doc => {
    const stamped = { ...doc, updatedAt: new Date().toISOString() }
    setDocs(list => list.some(d => d.id === stamped.id)
      ? list.map(d => d.id === stamped.id ? stamped : d)
      : [stamped, ...list])
    return stamped
  }

  const deleteDoc = id => {
    setDocs(list => list.filter(d => d.id !== id))
    if (editing?.id === id) setEditing(null)
  }

  const createDoc = type => {
    setTab(type === 'invoice' ? 'factures' : 'devis')
    setEditing(newDocument(type, settings, docs))
  }

  const upsertClient = client => {
    setClients(list => list.some(c => c.id === client.id)
      ? list.map(c => c.id === client.id ? client : c)
      : [...list, client])
  }

  const upsertItem = item => {
    setItems(list => list.some(i => i.id === item.id)
      ? list.map(i => i.id === item.id ? item : i)
      : [...list, item])
  }

  const openTab = id => {
    setEditing(null)
    setPlusOpen(false)
    if (id === 'plus') { setPlusOpen(true); return }
    setTab(id)
  }

  const screen = editing
    ? <DocumentEditor
        key={editing.id}
        doc={editing}
        settings={settings}
        clients={clients}
        items={items}
        onSaveClient={upsertClient}
        onSaveItem={upsertItem}
        onChange={setEditing}
        onSave={upsertDoc}
        onDelete={() => deleteDoc(editing.id)}
        onConvert={inv => {
          const stored = upsertDoc(inv)
          setTab('factures')
          setEditing(stored)
        }}
        onOpenSettings={() => { setEditing(null); setTab('settings') }}
        onClose={() => setEditing(null)}
      />
    : <>
        {tab === 'factures' && <DocumentList type="invoice" docs={docs} onOpen={setEditing} onNew={() => createDoc('invoice')} onOpenSettings={() => setTab('settings')}/>}
        {tab === 'devis' && <DocumentList type="estimate" docs={docs} onOpen={setEditing} onNew={() => createDoc('estimate')} onOpenSettings={() => setTab('settings')}/>}
        {tab === 'compta' && <ComptaScreen docs={docs} expenses={expenses} onOpenSettings={() => setTab('settings')}/>}
        {tab === 'paiements' && <PaiementsScreen onOpenSettings={() => setTab('settings')}/>}
        {tab === 'clients' && <ClientsScreen clients={clients} setClients={setClients} onBack={() => setTab('factures')}/>}
        {tab === 'articles' && <ItemsScreen items={items} setItems={setItems} onBack={() => setTab('factures')}/>}
        {tab === 'depenses' && <ExpensesScreen expenses={expenses} setExpenses={setExpenses} onBack={() => setTab('factures')}/>}
        {tab === 'rapports' && <RapportsScreen docs={docs} onBack={() => setTab('factures')}/>}
        {tab === 'settings' && <SettingsScreen settings={settings} setSettings={setSettings} onBack={() => setTab('factures')}/>}
      </>

  const activeNav = editing
    ? (editing.docType === 'invoice' ? 'factures' : 'devis')
    : (['clients', 'articles', 'depenses', 'rapports', 'settings'].includes(tab) ? 'plus' : tab)

  return (
    <div className="app">
      <div className="phone">{screen}</div>

      {plusOpen && <div className="sheet-backdrop no-print" onClick={() => setPlusOpen(false)}>
        <div className="sheet" onClick={e => e.stopPropagation()}>
          <div className="sheet-head">
            <span/>
            <button className="icon" onClick={() => setPlusOpen(false)}><X size={20}/></button>
          </div>
          {PLUS_ITEMS.map(it => (
            <button key={it.id} className="sheet-row" onClick={() => { setPlusOpen(false); setEditing(null); setTab(it.id) }}>
              <it.icon size={21}/>
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      </div>}

      <nav className="bottombar no-print">
        {NAV.map(n => (
          <button key={n.id} className={activeNav === n.id && !plusOpen ? 'active' : ''} onClick={() => openTab(n.id)}>
            <span className="nav-ico">
              <n.icon size={22}/>
              {n.badge && <span className="nav-badge">{n.badge}</span>}
            </span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
