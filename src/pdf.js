// Génération d'un vrai fichier PDF, pour pouvoir l'envoyer en pièce jointe.
//
// L'impression du navigateur produit un PDF que l'app ne peut pas récupérer :
// le fichier part chez le système, pas dans le code. Or un texto ou un
// courriel avec la facture attachée demande le fichier en main. D'où ce
// deuxième rendu, dessiné au trait, qui suit l'aperçu à l'écran.

import { calcTotals, fmtDate, fmtStamp, lineTotal, money, receiptData, revisionInfo } from './store.js'

// jsPDF pèse plus que toute l'app réunie. Il n'est téléchargé qu'au premier
// PDF demandé, pas au démarrage : sur un chantier, on ouvre l'app bien plus
// souvent qu'on ne sort un PDF.
let jsPDFPromise = null
const loadJsPDF = () => {
  if (!jsPDFPromise) jsPDFPromise = import('jspdf').then(m => m.jsPDF)
  return jsPDFPromise
}

// Page lettre en millimètres
const W = 215.9
const H = 279.4
const M = 14              // marge
const LINE = 5.2          // hauteur d'une ligne de texte

const hex = c => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(c || '#4353c9'))
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [67, 83, 201]
}

// Les montants sont écrits avec une espace insécable étroite par Intl ; les
// polices de base du PDF ne la connaissent pas et affichent un carré.
const clean = v => String(v ?? '').replace(/[  ]/g, ' ')

export async function buildPdf(settings, doc) {
  const jsPDF = await loadJsPDF()
  const totals = calcTotals(doc)
  const b = settings.business || {}
  const accent = hex(settings.accent)
  const pdf = new jsPDF({ unit: 'mm', format: [W, H] })

  let y = M

  const text = (s, x, opts = {}) => {
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    pdf.setFontSize(opts.size || 10)
    pdf.setTextColor(...(opts.color || [17, 24, 39]))
    pdf.text(clean(s), x, y, opts.align ? { align: opts.align } : undefined)
  }

  // Saut de page quand il ne reste plus la place d'écrire
  const room = need => {
    if (y + need <= H - M - 12) return
    pdf.addPage([W, H])
    y = M
  }

  // ===== Filigrane =====
  // Posé à la toute fin, par-dessus le contenu et sur chaque page. Dessous,
  // chaque rangée du tableau le découpait en bandes : les zébrures
  // l'assombrissaient, les rangées blanches l'effaçaient. Il traverse
  // maintenant la page d'un seul tenant, assez pâle pour lire au travers.
  const wm = settings.watermark || {}
  const drawWatermark = () => {
    if (wm.mode === 'none') return
    const angle = Number(wm.rotate) || 0
    const logo = wm.mode === 'logo' ? settings.logo : ''
    pdf.saveGraphicsState()
    pdf.setGState(new pdf.GState({ opacity: Math.min(Math.max(Number(wm.opacity) || 8, 1), 40) / 100 }))
    let drawn = false
    if (logo) {
      try {
        const props = pdf.getImageProperties(logo)
        // La taille réglée donne la largeur, mais un logo haut déborderait de
        // la page et se ferait couper : l'aperçu le borne à 94 % de la page,
        // le PDF doit faire pareil, sinon les deux ne montrent pas la même
        // chose.
        let w = W * (Math.min(Math.max(Number(wm.size) || 60, 20), 100) / 100)
        let h = (props.height / props.width) * w
        const maxW = W * 0.94
        const maxH = H * 0.94
        const fit = Math.min(1, maxW / w, maxH / h)
        w *= fit
        h *= fit
        // Avec un angle, addImage ne pose pas l'image où on croit : il place
        // le coin BAS-gauche de l'image (à hauteur y + h, comptée depuis le
        // haut) puis fait tourner la page autour de ce point. Le centre du
        // motif atterrit donc ailleurs, et le filigrane se retrouvait 23 % de
        // page trop bas — il mordait le pied de page.
        //
        // Centre obtenu = coin + rotation(w/2, h/2). On renverse le calcul
        // pour que ce centre tombe pile au milieu de la feuille.
        const rad = (angle * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const x = W / 2 - (w / 2) * cos + (h / 2) * sin
        const y = H / 2 - h + (w / 2) * sin + (h / 2) * cos
        pdf.addImage(logo, undefined, x, y, w, h, undefined, undefined, angle)
        drawn = true
      } catch { /* logo illisible : le nom prend le relais */ }
    }
    if (!drawn) {
      const label = (wm.mode === 'text' ? wm.text : '') || b.name || ''
      if (label) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(64)
        pdf.setTextColor(90, 90, 90)
        pdf.text(clean(label), W / 2, H / 2, { align: 'center', baseline: 'middle', angle: angle || -24 })
      }
    }
    pdf.restoreGraphicsState()
  }

  // Un aplat qui laisse passer le filigrane, comme les zébrures à l'écran.
  const fill = (x, yy, w, h, color, opacity) => {
    pdf.saveGraphicsState()
    pdf.setGState(new pdf.GState({ opacity }))
    pdf.setFillColor(...color)
    pdf.rect(x, yy, w, h, 'F')
    pdf.restoreGraphicsState()
  }

  // ===== Entête =====
  if (settings.logo && settings.logoOnPdf !== false) {
    try {
      const props = pdf.getImageProperties(settings.logo)
      const h = Math.min(18, (props.height / props.width) * 34)
      pdf.addImage(settings.logo, M, y - 2, (props.width / props.height) * h, h)
      y += h + 2
    } catch { /* logo illisible : on continue sans */ }
  }

  const headTop = y
  text(b.name || '', M, { bold: true, size: 17, color: accent })
  y += LINE + 1.5
  for (const l of [b.owner, b.address, b.city].filter(Boolean)) {
    text(l, M, { size: 9.5, color: [90, 98, 112] })
    y += LINE - 0.6
  }

  // Bloc de droite, aligné sur le haut de l'entête
  const rightY = y
  y = headTop
  text(doc.docType === 'invoice' ? 'FACTURE' : 'DEVIS', W - M, { bold: true, size: 20, align: 'right', color: accent })
  y += LINE + 2
  text(`No : ${doc.number}`, W - M, { size: 10, align: 'right' })
  y += LINE
  text(`Date : ${fmtDate(doc.date)}`, W - M, { size: 10, align: 'right' })
  y += LINE
  if (doc.dueDate) {
    text(`Échéance : ${fmtDate(doc.dueDate)}`, W - M, { size: 10, align: 'right' })
    y += LINE
  }
  // Une facture corrigée porte sa correction sur elle : le client qui a les
  // deux papiers doit voir tout de suite lequel compte.
  const rev = revisionInfo(doc)
  if (rev) {
    y += 1
    text(`RÉVISION ${rev.n}`, W - M, { bold: true, size: 10.5, align: 'right', color: [176, 42, 42] })
    y += LINE
    const when = fmtStamp(rev.replaces)
    text(when ? `Remplace et annule la version du ${when}` : 'Remplace et annule la version précédente',
      W - M, { size: 8.5, align: 'right', color: [140, 60, 55] })
    y += LINE
  }
  y = Math.max(y, rightY) + 2

  pdf.setDrawColor(...accent)
  pdf.setLineWidth(0.8)
  pdf.line(M, y, W - M, y)
  y += 7

  // ===== De / Facturé à =====
  const partiesTop = y
  text('DE', M, { bold: true, size: 8, color: accent })
  y += LINE - 0.8
  for (const l of [b.phone, b.email, b.website, b.gst ? `GST : ${b.gst}` : ''].filter(Boolean)) {
    text(l, M, { size: 9.5 })
    y += LINE - 0.8
  }
  const leftEnd = y

  y = partiesTop
  const midX = W / 2
  text('FACTURÉ À', midX, { bold: true, size: 8, color: accent })
  y += LINE - 0.8
  text(doc.client?.name || '', midX, { bold: true, size: 10 })
  y += LINE - 0.8
  for (const l of [doc.client?.address, doc.client?.city, doc.client?.phone, doc.client?.email].filter(Boolean)) {
    text(l, midX, { size: 9.5 })
    y += LINE - 0.8
  }
  y = Math.max(y, leftEnd) + 4

  // ===== Adresse des travaux =====
  if (doc.siteAddress) {
    const lines = pdf.splitTextToSize(clean(doc.siteAddress), W - 2 * M - 8)
    const boxH = 7 + lines.length * (LINE - 0.6)
    fill(M, y - 4, W - 2 * M, boxH, accent, 0.06)
    fill(M, y - 4, 1.2, boxH, accent, 1)
    text('ADRESSE DES TRAVAUX', M + 4, { bold: true, size: 8, color: accent })
    y += LINE - 1
    for (const l of lines) {
      text(l, M + 4, { bold: true, size: 10 })
      y += LINE - 0.6
    }
    y += 5
  }

  // ===== Tableau des lignes =====
  const cols = [M + 2, W - M - 78, W - M - 58, W - M - 34, W - M - 2]   // desc, qté, unité, prix, total
  const header = () => {
    fill(M, y - 4.6, W - 2 * M, 8, accent, 0.86)
    const t = (s, x, align) => {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(255, 255, 255)
      pdf.text(s, x, y, align ? { align } : undefined)
    }
    t('DESCRIPTION', cols[0])
    t('QTÉ', cols[1], 'right')
    t('UNITÉ', cols[2], 'right')
    t('PRIX', cols[3], 'right')
    t('TOTAL', cols[4], 'right')
    y += 7.5
  }

  header()
  let zebra = false
  for (const l of doc.lines || []) {
    const desc = pdf.splitTextToSize(clean(l.description || 'Article'), W - 2 * M - 84)
    const rowH = Math.max(desc.length * (LINE - 0.4) + 2.5, 8)
    if (y + rowH > H - M - 40) {
      pdf.addPage([W, H])
      y = M
      header()
    }
    if (zebra) fill(M, y - 4.6, W - 2 * M, rowH, [15, 23, 42], 0.035)
    zebra = !zebra
    const top = y
    for (const d of desc) {
      text(d, cols[0], { size: 9.5 })
      y += LINE - 0.4
    }
    y = top
    text(String(l.qty ?? ''), cols[1], { size: 9.5, align: 'right' })
    text(String(l.unit || ''), cols[2], { size: 9.5, align: 'right' })
    text(money(l.rate), cols[3], { size: 9.5, align: 'right' })
    text(money(lineTotal(l)), cols[4], { size: 9.5, align: 'right' })
    y = top + rowH
  }

  y += 4
  pdf.setDrawColor(225, 228, 235)
  pdf.setLineWidth(0.2)
  pdf.line(M, y, W - M, y)
  y += 7

  // ===== Totaux =====
  room(40)
  const totalsX = W - M - 2
  const labelX = W - M - 60
  const row = (label, value, opts = {}) => {
    text(label, labelX, { size: opts.big ? 11 : 10, bold: opts.bold })
    text(value, totalsX, { size: opts.big ? 11 : 10, bold: opts.bold, align: 'right', color: opts.color })
    y += LINE + 0.8
  }
  row('Sous-total', money(totals.subtotal))
  if (totals.discount > 0) row('Remise', `-${money(totals.discount)}`)
  if (doc.chargeTax && Number(doc.taxRate) > 0) row(`${settings.taxLabel} (${doc.taxRate} %)`, money(totals.tax))
  if (doc.chargeTax && Number(doc.taxRate2) > 0) row(`${settings.taxLabel2} (${doc.taxRate2} %)`, money(totals.tax2))
  pdf.setDrawColor(...accent)
  pdf.setLineWidth(0.5)
  pdf.line(labelX, y - 3.6, W - M, y - 3.6)
  y += 1.5
  row('Total', money(totals.total), { bold: true, big: true, color: accent })
  if (totals.paid > 0) {
    row('Paiements', `-${money(totals.paid)}`)
    row('Solde dû', money(totals.balance), { bold: true, big: true, color: accent })
  }
  y += 4

  // ===== Remarques, paiement, signature =====
  const block = (title, body) => {
    if (!String(body || '').trim()) return
    const lines = pdf.splitTextToSize(clean(body), W - 2 * M)
    room(lines.length * (LINE - 0.6) + 10)
    text(title, M, { bold: true, size: 8, color: accent })
    y += LINE - 0.8
    for (const l of lines) {
      text(l, M, { size: 9.5 })
      y += LINE - 0.8
    }
    y += 3
  }
  block('REMARQUES', doc.notes)
  block('INFO SUR LE PAIEMENT', doc.paymentInfo)

  if (doc.signature) {
    try {
      room(24)
      pdf.addImage(doc.signature, M, y, 50, 18)
      y += 20
      pdf.setDrawColor(180, 186, 196)
      pdf.setLineWidth(0.2)
      pdf.line(M, y, M + 60, y)
      y += 4
      text('Signature client', M, { size: 8, color: [120, 128, 140] })
      y += LINE
    } catch { /* signature illisible : on continue sans */ }
  }

  // ===== Pied de page sur chaque page =====
  const footer = [b.name, b.phone, b.email].filter(Boolean).join('  •  ')
  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i)
    // sur chaque page, et non plus seulement la première
    drawWatermark()
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(140, 146, 158)
    pdf.text(clean(footer), W / 2, H - 8, { align: 'center' })
    if (pages > 1) pdf.text(`${i} / ${pages}`, W - M, H - 8, { align: 'right' })
  }

  return pdf
}

// ===== Reçu de paiement =====
//
// Un document court et sans ambiguïté : qui a payé, combien, quand, comment,
// sur quelle facture, et ce qu'il reste à payer. C'est la preuve que le client
// classe — et celle qu'il sort quand quelqu'un lui redemande le même montant
// six mois plus tard.
export async function buildReceiptPdf(settings, doc, paymentId) {
  const jsPDF = await loadJsPDF()
  const r = receiptData(doc, paymentId)
  if (!r) throw new Error('Ce paiement est introuvable.')
  const b = settings.business || {}
  const accent = hex(settings.accent)
  const pdf = new jsPDF({ unit: 'mm', format: [W, H] })

  let y = M
  const text = (t, x, opts = {}) => {
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    pdf.setFontSize(opts.size || 10)
    pdf.setTextColor(...(opts.color || [17, 24, 39]))
    pdf.text(clean(t), x, y, opts.align ? { align: opts.align } : undefined)
  }

  // ----- Entête -----
  if (settings.logo && settings.logoOnPdf !== false) {
    try {
      const props = pdf.getImageProperties(settings.logo)
      const h = Math.min(18, (props.height / props.width) * 34)
      pdf.addImage(settings.logo, M, y - 2, (props.width / props.height) * h, h)
      y += h + 2
    } catch { /* logo illisible : on continue sans */ }
  }
  const headTop = y
  text(b.name || '', M, { bold: true, size: 17, color: accent })
  y += LINE + 1.5
  for (const l of [b.owner, b.address, b.city, b.phone, b.email].filter(Boolean)) {
    text(l, M, { size: 9.5, color: [90, 98, 112] })
    y += LINE - 0.6
  }
  const leftEnd = y

  y = headTop
  text('REÇU', W - M, { bold: true, size: 20, align: 'right', color: accent })
  y += LINE + 2
  if (r.number) { text(`No : ${r.number}`, W - M, { size: 10, align: 'right' }); y += LINE }
  text(`Date : ${fmtDate(r.date)}`, W - M, { size: 10, align: 'right' })
  y = Math.max(y + LINE, leftEnd) + 2

  pdf.setDrawColor(...accent)
  pdf.setLineWidth(0.8)
  pdf.line(M, y, W - M, y)
  y += 9

  // ----- De qui, pour quoi -----
  text('REÇU DE', M, { bold: true, size: 8, color: accent })
  y += LINE
  text(doc.client?.name || '', M, { bold: true, size: 12 })
  y += LINE + 3

  text('EN PAIEMENT DE', M, { bold: true, size: 8, color: accent })
  y += LINE
  text(`Facture ${doc.number}${doc.date ? ` du ${fmtDate(doc.date)}` : ''}`, M, { size: 11 })
  y += LINE
  if (doc.siteAddress) {
    for (const ligne of String(doc.siteAddress).split('\n').filter(Boolean)) {
      text(ligne, M, { size: 10, color: [90, 98, 112] })
      y += LINE - 0.6
    }
  }
  y += 6

  // ----- Le montant, en gros : c'est ce qu'on vient lire -----
  pdf.saveGraphicsState()
  pdf.setGState(new pdf.GState({ opacity: 0.07 }))
  pdf.setFillColor(...accent)
  pdf.rect(M, y - 1, W - 2 * M, 26, 'F')
  pdf.restoreGraphicsState()
  y += 8
  text('MONTANT REÇU', M + 5, { bold: true, size: 8, color: accent })
  text(money(r.amount), W - M - 5, { bold: true, size: 20, align: 'right', color: accent })
  y += 9
  text(`Mode de paiement : ${r.method}`, M + 5, { size: 10, color: [70, 78, 92] })
  y += 16

  // ----- L'état de la facture après ce versement -----
  const rowW = 70
  const row = (label, valeur, opts = {}) => {
    text(label, W - M - rowW, { size: opts.bold ? 11 : 10, bold: opts.bold, color: opts.color })
    text(valeur, W - M, { size: opts.bold ? 11 : 10, bold: opts.bold, align: 'right', color: opts.color })
    y += LINE + 1
  }
  row('Total de la facture', money(r.invoiceTotal))
  row('Versements reçus', money(r.paidToDate))
  pdf.setDrawColor(210, 214, 222)
  pdf.setLineWidth(0.3)
  pdf.line(W - M - rowW, y - 3, W - M, y - 3)
  y += 1
  row('Solde restant', money(r.remaining), { bold: true, color: r.settled ? [46, 125, 50] : [176, 42, 42] })
  y += 6

  // ----- Le verdict, écrit en toutes lettres -----
  const verdict = r.settled ? 'FACTURE PAYÉE EN ENTIER' : 'PAIEMENT PARTIEL'
  const vert = r.settled ? [46, 125, 50] : [176, 42, 42]
  pdf.saveGraphicsState()
  pdf.setGState(new pdf.GState({ opacity: 0.1 }))
  pdf.setFillColor(...vert)
  pdf.roundedRect(M, y, 78, 12, 2, 2, 'F')
  pdf.restoreGraphicsState()
  y += 8
  text(verdict, M + 6, { bold: true, size: 11, color: vert })
  y += 12

  text(
    r.settled
      ? 'Merci. Rien ne reste dû sur cette facture.'
      : `Merci. Il reste ${money(r.remaining)} à payer sur cette facture.`,
    M, { size: 10, color: [70, 78, 92] }
  )
  y += LINE + 12

  // ----- Signature de celui qui reçoit -----
  pdf.setDrawColor(180, 186, 196)
  pdf.setLineWidth(0.2)
  pdf.line(M, y, M + 70, y)
  y += 4
  text(`Pour ${b.name || 'l’entreprise'}`, M, { size: 8, color: [120, 128, 140] })

  // ----- Pied de page -----
  const pied = [b.name, b.phone, b.email].filter(Boolean).join('  •  ')
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(140, 146, 158)
  pdf.text(clean(pied), W / 2, H - 8, { align: 'center' })

  return pdf
}

// « REÇU0001 » ne doit pas devenir « RE-U0001 » : on remplace les accents par
// leur lettre nue avant de nettoyer le reste.
const sansAccents = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const receiptFileName = (doc, r) =>
  `${sansAccents(r?.number || `recu-${doc.number || ''}`).replace(/[^\w.-]+/g, '-')}.pdf`

export const pdfFileName = doc =>
  `${String(doc.number || 'facture').replace(/[^\w.-]+/g, '-')}.pdf`

export const pdfBlob = async (settings, doc) => (await buildPdf(settings, doc)).output('blob')

export async function pdfFile(settings, doc) {
  return new File([await pdfBlob(settings, doc)], pdfFileName(doc), { type: 'application/pdf' })
}

// Enregistrer un fichier depuis le navigateur : le même geste pour une facture
// et pour un reçu.
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function downloadPdf(settings, doc) {
  saveBlob(await pdfBlob(settings, doc), pdfFileName(doc))
}

// ===== Reçu : mêmes chemins que la facture =====
export async function receiptFile(settings, doc, paymentId) {
  const pdf = await buildReceiptPdf(settings, doc, paymentId)
  const r = receiptData(doc, paymentId)
  return new File([pdf.output('blob')], receiptFileName(doc, r), { type: 'application/pdf' })
}

export async function downloadReceipt(settings, doc, paymentId) {
  const pdf = await buildReceiptPdf(settings, doc, paymentId)
  saveBlob(pdf.output('blob'), receiptFileName(doc, receiptData(doc, paymentId)))
}

export async function shareReceipt(settings, doc, paymentId, { title, text }) {
  const file = await receiptFile(settings, doc, paymentId)
  if (!navigator.canShare?.({ files: [file] })) throw new Error('nofiles')
  await navigator.share({ files: [file], title, text })
}

// Le partage natif du téléphone : il ouvre Messages, Gmail, WhatsApp… avec le
// PDF déjà attaché. C'est la seule façon, dans un navigateur, d'envoyer un
// fichier par texto ou par courriel — un lien sms: ou mailto: ne transporte
// que du texte.
export const canSharePdf = () => {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false
  try {
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'x.pdf', { type: 'application/pdf' })] })
  } catch {
    return false
  }
}

export async function sharePdf(settings, doc, { title, text }) {
  const file = await pdfFile(settings, doc)
  if (!navigator.canShare?.({ files: [file] })) throw new Error('nofiles')
  await navigator.share({ files: [file], title, text })
}
