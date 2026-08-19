import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, MoreVertical, ChevronRight, Send, Paperclip, Trash2,
  Mail, MessageSquare, Printer, Clock, X, Maximize2, PenLine, Eye, MapPin,
  Share2, Download, Link2, Copy, EyeOff, CheckCheck
} from 'lucide-react'
import {
  buildEmailBody, buildSmsBody, calcTotals, docStatus, fmtDate, fmtStamp, isRevised,
  lineTotal, markSent, money, newLine, parseNum, suggestItems, uid,
  today, emptyClient, withEvent, UNITS
} from './store.js'
import { canSharePdf, downloadPdf, sharePdf } from './pdf.js'
import {
  agoFr, channelLabel, channelsOf, fmtViewedAt, publishShare, restoreShare,
  revokeShare, seenCurrent, shareUrl
} from './share.js'
import { AppBar, NumField } from './lists.jsx'
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

export function DocumentEditor({ doc, settings, clients, items, share, cloudUser, onShareChange, onChange, onSave, onDelete, onConvert, onSaveClient, onSaveItem, onOpenSettings, onClose }) {
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
  const [linkBusy, setLinkBusy] = useState('')
  const [linkNote, setLinkNote] = useState('')
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

  // Une facture corrigée qui repart n'est pas un deuxième envoi identique :
  // l'historique doit dire laquelle des versions est partie.
  const revised = isInvoice && isRevised(doc)
  const sendLabel = what => (revised ? `${what} — révision ${Number(doc.revision || 1) + 1}` : what)

  const sendEmail = () => {
    if (!doc.client.email?.trim()) return alert('Ajoute une adresse email au client avant d’envoyer.')
    const saved = persist(withEvent(markSent(doc), sendLabel('Envoyée par email')))
    const subject = encodeURIComponent(`${saved.number} - ${settings.business.name}`)
    const body = encodeURIComponent(buildEmailBody(settings, saved, totals))
    window.location.href = `mailto:${saved.client.email}?subject=${subject}&body=${body}`
    setSendOpen(false)
  }

  const sendSms = () => {
    if (!doc.client.phone?.trim()) return alert('Ajoute un numéro de téléphone au client avant d’envoyer par texto.')
    const saved = persist(withEvent(markSent(doc), sendLabel('Envoyée par texto')))
    const body = encodeURIComponent(buildSmsBody(settings, saved, totals))
    window.location.href = `sms:${saved.client.phone}?&body=${body}`
    setSendOpen(false)
  }

  // Envoi du PDF en pièce jointe, par le partage du téléphone : une seule
  // touche pour choisir Messages, Gmail, ou les deux.
  const sharePdfTo = async () => {
    const saved = persist(withEvent(markSent(doc), sendLabel('PDF partagé')))
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

  // Les liens de facture : un par destinataire. Le courriel part à
  // l'administration, le texto au contremaître — deux liens, donc l'app peut
  // dire lequel des deux a été ouvert. Chaque lien est mis à jour à chaque
  // envoi : celui que le client a déjà reçu montre toujours la bonne version.
  const chans = channelsOf(share)

  const withLink = async (channel, dest, label, markAsSent) => {
    const next = markAsSent ? withEvent(markSent(doc), sendLabel(label)) : doc
    const { token, url } = await publishShare(next, settings, channel, dest)
    persist({ ...next, shareTokens: { ...(next.shareTokens || {}), [channel]: token } })
    onShareChange?.()
    return { url, doc: next }
  }

  const sendLink = async via => {
    // On vérifie avant de publier : rien ne doit changer d'état si le message
    // ne peut même pas partir.
    if (via === 'sms' && !doc.client.phone?.trim())
      return setShareError('Ajoute un numéro de téléphone au client avant d’envoyer par texto.')
    if (via === 'mail' && !doc.client.email?.trim())
      return setShareError('Ajoute une adresse email au client avant d’envoyer.')
    setSendOpen(false)
    setLinkBusy(via)
    setLinkNote('')
    try {
      const dest = via === 'sms' ? doc.client.phone.trim() : doc.client.email.trim()
      const { url, doc: sent } = await withLink(
        via === 'sms' ? 'sms' : 'mail',
        dest,
        via === 'sms' ? `Lien envoyé par texto (${dest})` : `Lien envoyé par courriel (${dest})`,
        true
      )
      const totalsNow = calcTotals(sent)
      if (via === 'sms') {
        window.location.href = `sms:${sent.client.phone}?&body=${encodeURIComponent(buildSmsBody(settings, sent, totalsNow, url))}`
      } else {
        const subject = encodeURIComponent(`${sent.number} - ${settings.business.name}`)
        window.location.href = `mailto:${sent.client.email}?subject=${subject}&body=${encodeURIComponent(buildEmailBody(settings, sent, totalsNow, url))}`
      }
    } catch (e) {
      setShareError(String(e?.message || e))
    } finally {
      setLinkBusy('')
    }
  }

  const copyLink = async () => {
    setSendOpen(false)
    setLinkBusy('copy')
    setLinkNote('')
    try {
      // copier n'est pas envoyer : l'état de la facture ne bouge pas
      const { url } = await withLink('lien', '', 'Lien de facture créé', false)
      await navigator.clipboard.writeText(url)
      setLinkNote('Lien copié — colle-le où tu veux.')
    } catch (e) {
      setShareError(String(e?.message || e))
    } finally {
      setLinkBusy('')
    }
  }

  const cutLink = async c => {
    setLinkBusy('cut' + c.channel)
    setLinkNote('')
    try {
      const name = channelLabel(c.channel).toLowerCase()
      if (c.revoked) {
        await restoreShare(c.token)
        setLinkNote(`Lien ${name} réactivé.`)
      } else {
        await revokeShare(c.token)
        setLinkNote(`Lien ${name} coupé : ce destinataire ne voit plus la facture.`)
      }
      persist(withEvent(doc, `${c.revoked ? 'Lien réactivé' : 'Lien coupé'} — ${name}${c.label ? ` (${c.label})` : ''}`))
      onShareChange?.()
    } catch (e) {
      setShareError(String(e?.message || e))
    } finally {
      setLinkBusy('')
    }
  }

  const copyOne = async c => {
    try {
      await navigator.clipboard.writeText(shareUrl(c.token))
      setLinkNote(`Lien ${channelLabel(c.channel).toLowerCase()} copié.`)
    } catch {
      setLinkNote('Copie impossible : garde le lien affiché et recopie-le à la main.')
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

  // Une facture part parfois autrement que par l'app — remise en main propre,
  // envoyée depuis un autre appareil. Le bouton permet de le dire, et de
  // revenir en arrière si on s'est trompé.
  const toggleSent = () => {
    // Une facture corrigée est « envoyée » dans les données, mais ce n'est plus
    // la bonne version : le bouton sert alors à confirmer le renvoi, pas à
    // défaire l'envoi.
    const sent = doc.status === 'sent' && !revised
    persist(withEvent(
      sent ? { ...doc, status: 'draft' } : markSent(doc),
      sent ? 'Remise en cours' : sendLabel(revised ? 'Marquée comme renvoyée' : 'Marquée comme envoyée')
    ))
  }

  const markPaid = () => {
    if (totals.balance <= 0) return
    persist(withEvent({
      ...doc,
      payments: [...(doc.payments || []), { id: uid(), date: today(), amount: Number(totals.balance.toFixed(2)), method: 'Autre' }]
    }, `Marquée comme payée (${money(totals.balance)})`))
  }

  const addPayment = () => {
    const amount = parseNum(prompt('Montant du paiement :', totals.balance > 0 ? totals.balance.toFixed(2) : ''))
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
      // le numéro définitif est attribué à l'enregistrement, à la suite des
      // factures existantes
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

    {/* Le client a une version périmée entre les mains. Rien ne peut la lui
        reprendre : ce qui l'annule, c'est la suivante — et il faut qu'elle
        parte. Le bandeau reste tant que ce n'est pas fait. */}
    {revised && view !== 'history' && <div className="revised-banner no-print">
      <b>Version envoyée le {fmtStamp(doc.sentAt)} — modifiée depuis</b>
      <span>Le client a encore l'ancien montant. Renvoie la facture : elle partira
      en révision {Number(doc.revision || 1) + 1} et annulera la précédente, écrit noir sur blanc dessus.</span>
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
                <NumField value={l.qty} onChange={v => setLine(l.id, { qty: v })}/>
                ×
                <NumField value={l.rate} onChange={v => setLine(l.id, { rate: v })}/>
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
            <NumField value={doc.discountValue} onChange={v => set({ discountValue: v })}/>
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

      {/* Les liens de facture, un par destinataire, et ce qu'ils rapportent :
          c'est la seule façon de savoir qui a ouvert. Un PDF attaché, lui, ne
          dit jamais rien. */}
      {isInvoice && <div className="edit-card track">
        <div className="track-head">
          <Link2 size={17}/>
          <b>Liens de facture</b>
        </div>

        {chans.length === 0 && <p className="hint small-note">
          Envoie le lien plutôt que le fichier : la facture s'ouvre dans le navigateur du destinataire,
          et l'app te dit qui l'a lue. Le courriel et le texto ont chacun le leur, donc tu sais lequel
          des deux a ouvert. {cloudUser ? '' : 'Il faut être connecté à la sauvegarde infonuagique (Réglages).'}
        </p>}

        {chans.map(c => <div className="track-chan" key={c.channel}>
          <div className="track-chan-head">
            {c.channel === 'mail' ? <Mail size={15}/> : c.channel === 'sms' ? <MessageSquare size={15}/> : <Link2 size={15}/>}
            <b>{channelLabel(c.channel)}</b>
            {c.label && <small>{c.label}</small>}
            <span className={`track-badge ${c.revoked ? 'cut' : c.views > 0 ? (seenCurrent(c) ? 'seen' : 'stale') : 'wait'}`}>
              {c.revoked ? 'Coupé' : c.views === 0 ? 'Pas encore ouvert' : seenCurrent(c) ? 'Lu' : 'Lu avant la correction'}
            </span>
          </div>
          <p className="track-line">{c.last
            ? <><CheckCheck size={15}/> Ouvert {c.views} fois — dernière {agoFr(c.last.at)} ({fmtViewedAt(c.last.at)})</>
            : <><Eye size={15}/> Pas encore ouvert par ce destinataire.</>}
          </p>
          {c.last && !seenCurrent(c) &&
            <p className="track-warn">Cette ouverture date d'avant ta correction : la révision {c.revision} n'a pas encore été vue.</p>}
          <div className="track-actions">
            <button className="link-btn" onClick={() => copyOne(c)}><Copy size={15}/> Copier</button>
            <button className="link-btn" onClick={() => window.open(`${shareUrl(c.token)}?apercu=1`, '_blank')}><Eye size={15}/> Voir la page</button>
            <button className="link-btn danger" onClick={() => cutLink(c)} disabled={!!linkBusy}>
              {c.revoked ? <><Link2 size={15}/> Réactiver</> : <><EyeOff size={15}/> Couper</>}
            </button>
          </div>
        </div>)}
        {linkNote && <p className="track-note">{linkNote}</p>}
      </div>}

      {/* L'état se lit dans la liste : ces deux boutons sont ce qui le change
          à la main, quand l'envoi ou le paiement s'est fait hors de l'app. */}
      {isInvoice && status !== 'paid' && <button className="outline-btn" onClick={toggleSent}>
        {revised ? 'Marquer comme renvoyée' : doc.status === 'sent' ? 'Remettre « en cours »' : 'Marquer comme envoyée'}
      </button>}
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
          {/* Le lien d'abord : c'est le seul envoi qui revient dire au patron
              que le client a ouvert la facture. */}
          <button onClick={() => sendLink('sms')} disabled={!!linkBusy}>
            <MessageSquare size={19}/> <span>Texto avec le lien<small>tu sauras quand il l'ouvre</small></span>
          </button>
          <button onClick={() => sendLink('mail')} disabled={!!linkBusy}>
            <Mail size={19}/> <span>Courriel avec le lien<small>tu sauras quand il l'ouvre</small></span>
          </button>
          <button onClick={copyLink} disabled={!!linkBusy}><Copy size={19}/> Copier le lien</button>
          <div className="send-menu-sep"/>
          {shareable && <>
            <button onClick={sharePdfTo}><Share2 size={19}/> <span>Envoyer le PDF<small>fichier attaché, sans suivi</small></span></button>
            <div className="send-menu-sep"/>
          </>}
          <button onClick={sendEmail}><Mail size={19}/> <span>Courriel<small>texte seulement, sans suivi</small></span></button>
          <button onClick={sendSms}><MessageSquare size={19}/> <span>Texto<small>texte seulement, sans suivi</small></span></button>
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
            <button className="primary" onClick={() => setSendOpen(o => !o)}><Send size={18}/> {revised ? 'Renvoyer' : 'Envoyer'}</button>
          </div>
        : <button className="send-fab no-print" onClick={() => setSendOpen(o => !o)}><Send size={19}/> {revised ? 'Renvoyer' : 'Envoyer'}</button>}
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
