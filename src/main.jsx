import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  FileText, ClipboardList, Calculator, CreditCard, MoreHorizontal,
  Users, Package, ReceiptText, BarChart3, Settings as SettingsIcon, X, Sparkles, Eye
} from 'lucide-react'
import {
  load, save, emptySettings, hasDraftContent, mergeItemsFromLines, mergeSettings,
  migrateOldData, newDocument, nextNumber
} from './store.js'
import { prepareItems } from './seed.js'
import { DocumentList } from './lists.jsx'
import { DocumentEditor } from './editor.jsx'
import { ClientsScreen, ItemsScreen, ExpensesScreen } from './catalog.jsx'
import { ComptaScreen, RapportsScreen, PaiementsScreen } from './compta.jsx'
import { SettingsScreen } from './settings.jsx'
import { AiFab, AssistantScreen } from './assistant.jsx'
import { useCloudSync } from './cloudui.jsx'
import { agoFr, lastSeenView, markViewsSeen, newViews, pullShareActivity, shareState } from './share.js'
import { SharedInvoice, shareTokenFromUrl } from './shared.jsx'
import './styles.css'

// Une modification n'est pas envoyée tout de suite : sur un chantier, on
// enchaîne les touches, et une synchro par frappe ne servirait à rien.
const SYNC_DELAY = 3000

// Une facture en cours est enregistrée toute seule, sans attendre un bouton :
// on ne refait pas une facture parce que le téléphone a fermé l'onglet.
const AUTOSAVE_DELAY = 700

const NAV = [
  { id: 'factures', label: 'Factures', icon: FileText },
  { id: 'devis', label: 'Devis', icon: ClipboardList },
  { id: 'compta', label: 'Comptabilité', icon: Calculator, badge: 'Nouv.' },
  { id: 'paiements', label: 'Paiements', icon: CreditCard },
  { id: 'plus', label: 'Plus', icon: MoreHorizontal }
]

const PLUS_ITEMS = [
  { id: 'assistant', label: 'Assistant IA', icon: Sparkles },
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
  const [settings, setSettings] = useState(() => mergeSettings(migrated?.settings || load('is_settings', emptySettings)))
  const [clients, setClients] = useState(() => migrated?.clients || load('is_clients', []))
  const [items, setItems] = useState(() => prepareItems(load('is_items', [])))
  const [expenses, setExpenses] = useState(() => load('is_expenses', []))
  const [docs, setDocs] = useState(() => migrated?.docs || load('is_docs', []))
  // On rouvre la facture qui était à l'écran la dernière fois : fermer
  // l'application au milieu d'une facture ne doit rien coûter.
  const [editing, setEditing] = useState(() => {
    const id = load('is_open_doc', null)
    return id ? (migrated?.docs || load('is_docs', [])).find(d => d.id === id) || null : null
  })
  const [dirty, setDirty] = useState(0)
  // L'assistant s'ouvre par-dessus l'écran courant : on revient exactement où
  // on était en le fermant, depuis n'importe quel onglet.
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  // Liens de facture et ouvertures par le client : gardés en mémoire locale
  // pour que la pastille « Vue » soit là même sans réseau.
  const [shares, setShares] = useState(shareState)
  const [seenView, setSeenView] = useState(lastSeenView)

  useEffect(() => save('is_settings', settings), [settings])
  useEffect(() => save('is_clients', clients), [clients])
  useEffect(() => save('is_items', items), [items])
  useEffect(() => save('is_expenses', expenses), [expenses])
  useEffect(() => save('is_docs', docs), [docs])

  // Ce que la synchro rapporte du nuage remplace ce qui est en mémoire. Ça ne
  // touche pas `dirty` : sinon chaque synchro en déclencherait une autre.
  const applyCloud = r => {
    if (r.docs) setDocs(r.docs)
    if (r.clients) setClients(r.clients)
    if (r.items) setItems(r.items)
    if (r.expenses) setExpenses(r.expenses)
    if (r.settings) setSettings(mergeSettings(r.settings))
  }

  const cloud = useCloudSync({ settings, clients, items, expenses, docs }, applyCloud)

  // Qui a ouvert sa facture ? On le redemande après chaque synchro, et au
  // retour sur l'app : c'est là qu'on apprend qu'un client a lu.
  const refreshShares = () => {
    pullShareActivity().then(s => s && setShares(s)).catch(() => { /* hors ligne : on garde ce qu'on sait */ })
  }

  useEffect(() => {
    if (!cloud.user) return
    refreshShares()
  }, [cloud.user?.id, cloud.state.at])

  useEffect(() => {
    const onShow = () => { if (document.visibilityState === 'visible' && cloud.user) refreshShares() }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [cloud.user?.id])

  const fresh = newViews(shares, docs, seenView)
  const dismissViews = () => {
    const top = Math.max(...fresh.map(v => Number(v.id)), seenView)
    markViewsSeen(top)
    setSeenView(top)
  }

  // L'avis s'efface tout seul : l'information reste sur la rangée de la
  // facture (« Vue il y a 4 min ») et dans la carte de suivi, rien ne se perd.
  useEffect(() => {
    if (!fresh.length) return
    const t = setTimeout(dismissViews, 12000)
    return () => clearTimeout(t)
  }, [fresh.length ? fresh[0].id : 0])

  const touch = () => setDirty(n => n + 1)
  // Les écrans de listes reçoivent le vrai setter : on l'enveloppe pour savoir
  // qu'il y a du neuf à envoyer, sans rien changer à leur code.
  const tracked = setter => value => { touch(); setter(value) }

  useEffect(() => {
    if (!dirty || !cloud.user) return
    const t = setTimeout(() => cloud.sync(), SYNC_DELAY)
    return () => clearTimeout(t)
  }, [dirty, cloud.user?.id])

  // ===== Ne jamais reperdre une facture en cours =====
  const editingRef = useRef(editing)
  editingRef.current = editing

  // De quoi la rouvrir au prochain lancement
  useEffect(() => { save('is_open_doc', editing?.id || null) }, [editing?.id])

  useEffect(() => {
    if (!editing || !hasDraftContent(editing)) return
    const t = setTimeout(() => autosaveDoc(editing), AUTOSAVE_DELAY)
    return () => clearTimeout(t)
  }, [editing])

  // Un téléphone ferme l'onglet sans prévenir, au milieu du délai
  // d'enregistrement. On écrit alors directement, sans passer par React : il
  // n'aurait pas le temps de faire un rendu de plus.
  useEffect(() => {
    const flush = () => {
      const d = editingRef.current
      if (!d || !hasDraftContent(d)) return
      const stamped = { ...d, updatedAt: new Date().toISOString() }
      const list = load('is_docs', [])
      save('is_docs', list.some(x => x.id === stamped.id)
        ? list.map(x => x.id === stamped.id ? stamped : x)
        : [stamped, ...list])
    }
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  const storeDoc = (doc, catalog) => {
    touch()
    const stamped = { ...doc, updatedAt: new Date().toISOString() }
    setDocs(list => list.some(d => d.id === stamped.id)
      ? list.map(d => d.id === stamped.id ? stamped : d)
      : [stamped, ...list])
    // tout ce qui est facturé est mémorisé pour l'autocomplétion
    if (catalog) setItems(list => mergeItemsFromLines(list, stamped.lines))
    return stamped
  }

  const upsertDoc = doc => storeDoc(doc, true)

  // L'enregistrement automatique ne touche pas au catalogue : une description
  // à moitié tapée n'a rien à faire dans la liste de prix.
  const autosaveDoc = doc => storeDoc(doc, false)

  const deleteDoc = id => {
    touch()
    setDocs(list => list.filter(d => d.id !== id))
    if (editing?.id === id) setEditing(null)
  }

  const createDoc = type => {
    setTab(type === 'invoice' ? 'factures' : 'devis')
    setEditing(newDocument(type, settings, docs))
  }

  const upsertClient = client => {
    touch()
    setClients(list => list.some(c => c.id === client.id)
      ? list.map(c => c.id === client.id ? client : c)
      : [...list, client])
  }

  const upsertItem = item => {
    touch()
    setItems(list => list.some(i => i.id === item.id)
      ? list.map(i => i.id === item.id ? item : i)
      : [...list, item])
  }

  // L'assistant peut proposer plusieurs prix d'un coup
  const addItems = list => {
    touch()
    setItems(cur => mergeItemsFromLines(cur, list))
    return list.length
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
          // Le devis EST0003 donnait la facture INVOICE0003 — qui existait
          // peut-être déjà. Deux factures au même numéro, c'est une erreur de
          // livres. Le numéro est donc pris à la suite des factures, ici, où
          // la liste complète est connue.
          const stored = upsertDoc({ ...inv, number: nextNumber(docs, 'invoice', settings.invoicePrefix) })
          setTab('factures')
          setEditing(stored)
        }}
        share={shares[editing.id] || null}
        onShareChange={() => refreshShares()}
        cloudUser={cloud.user}
        onOpenSettings={() => { setEditing(null); setTab('settings') }}
        onClose={() => setEditing(null)}
      />
    : <>
        {tab === 'factures' && <DocumentList type="invoice" docs={docs} shares={shares} onOpen={setEditing} onNew={() => createDoc('invoice')} onOpenSettings={() => setTab('settings')}/>}
        {tab === 'devis' && <DocumentList type="estimate" docs={docs} shares={shares} onOpen={setEditing} onNew={() => createDoc('estimate')} onOpenSettings={() => setTab('settings')}/>}
        {tab === 'compta' && <ComptaScreen docs={docs} expenses={expenses} onOpenSettings={() => setTab('settings')}/>}
        {tab === 'paiements' && <PaiementsScreen onOpenSettings={() => setTab('settings')}/>}
        {tab === 'clients' && <ClientsScreen clients={clients} setClients={tracked(setClients)} onBack={() => setTab('factures')}/>}
        {tab === 'articles' && <ItemsScreen items={items} setItems={tracked(setItems)} onBack={() => setTab('factures')}/>}
        {tab === 'depenses' && <ExpensesScreen expenses={expenses} setExpenses={tracked(setExpenses)} onBack={() => setTab('factures')}/>}
        {tab === 'rapports' && <RapportsScreen docs={docs} onBack={() => setTab('factures')}/>}
        {tab === 'settings' && <SettingsScreen
          settings={settings}
          setSettings={tracked(setSettings)}
          cloud={cloud}
          data={{ clients, items, expenses, docs }}
          onBack={() => setTab('factures')}
        />}
      </>

  const activeNav = editing
    ? (editing.docType === 'invoice' ? 'factures' : 'devis')
    : (['clients', 'articles', 'depenses', 'rapports', 'settings'].includes(tab) ? 'plus' : tab)

  return (
    <div className="app">
      <div className="phone">{screen}</div>

      {/* Un client vient d'ouvrir sa facture : on le dit tout de suite, où
          qu'on soit dans l'app. Une touche ouvre la facture en question. */}
      {fresh.length > 0 && <div className="view-toast no-print">
        <button className="view-toast-main" onClick={() => {
          const first = fresh[0]
          const doc = docs.find(d => d.id === first.docId)
          dismissViews()
          if (doc) { setPlusOpen(false); setAiOpen(false); setTab(doc.docType === 'invoice' ? 'factures' : 'devis'); setEditing(doc) }
        }}>
          <Eye size={20}/>
          <span>
            <b>{fresh[0].client || 'Le client'} a ouvert {fresh[0].number}</b>
            <small>{agoFr(fresh[0].at)}{fresh.length > 1 ? ` — et ${fresh.length - 1} autre${fresh.length > 2 ? 's' : ''}` : ''}</small>
          </span>
        </button>
        <button className="icon" onClick={dismissViews} aria-label="Fermer"><X size={18}/></button>
      </div>}

      {/* Sur tous les onglets et jusque dans l'éditeur : l'assistant est à une
          touche, sans perdre l'écran en cours. */}
      {!aiOpen && <AiFab busy={aiBusy} onClick={() => { setPlusOpen(false); setAiOpen(true) }}/>}

      {/* Toujours monté, seulement caché : la conversation est encore là en
          rouvrant la bulle, et une réponse partie continue d'arriver. */}
      <div className={aiOpen ? 'assistant-overlay no-print' : 'assistant-overlay hidden no-print'}>
        <AssistantScreen
          open={aiOpen}
          settings={settings}
          docs={docs}
          expenses={expenses}
          clients={clients}
          items={items}
          onCreateDoc={upsertDoc}
          onSaveItems={addItems}
          onBusy={setAiBusy}
          onOpenDoc={doc => { setAiOpen(false); setTab('factures'); setEditing(doc) }}
          onOpenSettings={() => { setAiOpen(false); setEditing(null); setTab('settings') }}
          onBack={() => setAiOpen(false)}
        />
      </div>

      {plusOpen && <div className="sheet-backdrop no-print" onClick={() => setPlusOpen(false)}>
        <div className="sheet" onClick={e => e.stopPropagation()}>
          <div className="sheet-head">
            <span/>
            <button className="icon" onClick={() => setPlusOpen(false)}><X size={20}/></button>
          </div>
          {PLUS_ITEMS.map(it => (
            <button key={it.id} className="sheet-row" onClick={() => {
              setPlusOpen(false)
              // L'assistant s'ouvre en panneau, pas en onglet : d'où qu'on
              // vienne, on retombe sur le même écran en le fermant.
              if (it.id === 'assistant') return setAiOpen(true)
              setEditing(null)
              setTab(it.id)
            }}>
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

// Un lien de facture n'ouvre pas l'application : il ouvre la facture, et
// rien d'autre. « ?apercu=1 » sert au propriétaire à vérifier son lien sans
// que sa propre visite compte comme une ouverture du client.
const shareToken = shareTokenFromUrl()
const ownerPreview = new URLSearchParams(location.search).get('apercu') === '1'

createRoot(document.getElementById('root')).render(
  shareToken ? <SharedInvoice token={shareToken} log={!ownerPreview}/> : <App />
)
