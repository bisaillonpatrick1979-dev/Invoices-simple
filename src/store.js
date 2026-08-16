// Données, persistance localStorage et calculs partagés

export const uid = () => Math.random().toString(36).slice(2, 10)
export const today = () => new Date().toISOString().slice(0, 10)
export const money = n => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0))
// Format de date comme dans l'app : MM/DD/YYYY
export const fmtDate = iso => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

export const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

let quotaWarned = false
export const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Espace du navigateur plein (souvent une image trop lourde : logo, photos)
    if (!quotaWarned) {
      quotaWarned = true
      alert("La mémoire du navigateur est pleine : les dernières modifications n'ont pas pu être enregistrées.\n\nRetire des photos ou un logo trop lourd, puis réessaie.")
    }
  }
}

// Filigrane imprimé en pâle derrière chaque facture
export const defaultWatermark = {
  mode: 'logo',   // 'logo' | 'text' | 'none'
  text: '',       // vide = nom de la compagnie
  opacity: 8,     // %
  size: 60,       // % de la largeur du document
  rotate: -24     // degrés
}

export const emptySettings = {
  business: {
    name: 'Votre compagnie',
    owner: '',
    phone: '',
    email: '',
    address: '',
    city: 'Calgary, AB',
    website: '',
    gst: ''
  },
  logo: '',
  logoOnPdf: true,
  watermark: { ...defaultWatermark },
  ai: { provider: 'anthropic', apiKey: '', model: 'claude-opus-5', baseUrl: '' },
  taxLabel: 'Gst',
  taxRate: 5,
  taxDefault: true,
  accent: '#4353c9',
  invoicePrefix: 'INVOICE',
  estimatePrefix: 'EST',
  defaultNotes: '',
  paymentInstructions: ''
}

// Complète les réglages enregistrés avec les clés ajoutées par les nouvelles versions
export const mergeSettings = stored => ({
  ...emptySettings,
  ...stored,
  business: { ...emptySettings.business, ...(stored?.business || {}) },
  watermark: { ...defaultWatermark, ...(stored?.watermark || {}) },
  ai: { ...emptySettings.ai, ...(stored?.ai || {}) }
})

// Lit une image et la redimensionne : le localStorage est limité (~5 Mo),
// une photo de logo brute le remplirait à elle seule.
export function readImageFile(file, maxSize = 600) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Ce fichier n\'est pas une image'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.onload = () => {
      const src = String(reader.result)
      const img = new Image()
      // SVG : le canvas ne sait pas toujours le redimensionner, on garde l'original
      img.onerror = () => file.type === 'image/svg+xml' ? resolve(src) : reject(new Error('Image illisible'))
      img.onload = () => {
        if (!img.width || !img.height) return resolve(src)
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height))
        if (ratio === 1 && src.length < 200_000) return resolve(src)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        // PNG pour garder la transparence d'un logo, JPEG pour une photo
        const png = file.type === 'image/png' || file.type === 'image/webp'
        resolve(canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9))
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

export const emptyClient = { id: '', name: '', phone: '', email: '', address: '', city: '', notes: '' }
export const emptyItem = { id: '', description: '', unit: 'ea', rate: 0, taxable: true }
export const emptyExpense = { id: '', date: '', description: '', category: 'Matériel', amount: 0 }

export const EXPENSE_CATEGORIES = ['Matériel', 'Essence', 'Outils', 'Sous-traitance', 'Repas', 'Autre']

// Unités suggérées (le champ reste libre : on peut taper n'importe quoi)
export const UNITS = ['ea', 'h', 'pi²', 'pi lin.', 'verge²', 'jour', 'lot', 'km']

export const normDesc = d => String(d || '').trim().toLowerCase()

// Tout ce qui est facturé entre automatiquement au catalogue : en retapant
// les premières lettres, la description et son prix ressortent. Une
// description déjà connue est mise à jour au lieu d'être dupliquée.
export function mergeItemsFromLines(items, lines) {
  const byKey = new Map(items.map(i => [normDesc(i.description), i]))
  let changed = false
  for (const l of lines || []) {
    const key = normDesc(l.description)
    // 3 lettres : évite de mémoriser une description à moitié tapée
    if (key.length < 3) continue
    const prev = byKey.get(key)
    const rate = Number(l.rate || 0)
    const unit = l.unit || 'ea'
    const taxable = l.taxable !== false
    if (prev && Number(prev.rate) === rate && prev.unit === unit && (prev.taxable !== false) === taxable) continue
    byKey.set(key, { id: prev?.id || uid(), description: String(l.description).trim(), unit, rate, taxable })
    changed = true
  }
  return changed ? [...byKey.values()] : items
}

// Suggestions pour l'autocomplétion de la description
export function suggestItems(items, typed, limit = 6) {
  const q = normDesc(typed)
  if (q.length < 2) return []
  return items
    .filter(it => normDesc(it.description).includes(q) && normDesc(it.description) !== q)
    .sort((a, b) => {
      const rank = x => normDesc(x.description).startsWith(q) ? 0 : 1
      return rank(a) - rank(b) || String(a.description).localeCompare(String(b.description), 'fr')
    })
    .slice(0, limit)
}

export const newLine = () => ({ id: uid(), description: '', qty: 1, unit: 'ea', rate: 0, taxable: true })

export const nextNumber = (docs, type, prefix) => {
  const nums = docs
    .filter(d => d.docType === type)
    .map(d => {
      const m = String(d.number || '').match(/(\d+)\s*$/)
      return m ? Number(m[1]) : 0
    })
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

export const newDocument = (type, settings, docs) => ({
  id: uid(),
  docType: type,
  number: nextNumber(docs, type, type === 'invoice' ? settings.invoicePrefix : settings.estimatePrefix),
  date: today(),
  dueDate: '',
  clientId: '',
  client: { ...emptyClient },
  lines: [],
  chargeTax: settings.taxDefault,
  taxRate: settings.taxRate,
  discountType: '$',
  discountValue: 0,
  notes: settings.defaultNotes,
  paymentInfo: settings.paymentInstructions,
  photos: [],
  signature: '',
  payments: [],
  status: 'draft',
  closed: false,
  history: [{ id: uid(), at: new Date().toISOString(), label: type === 'invoice' ? 'Facture créée' : 'Devis créé' }],
  updatedAt: new Date().toISOString()
})

// Facture fictive : sert à voir le rendu final du PDF (logo, filigrane,
// couleur, taxe, textes) depuis les réglages, sans créer une vraie facture.
export function sampleDocument(settings) {
  const line = (description, qty, unit, rate) => ({ id: uid(), description, qty, unit, rate, taxable: true })
  return {
    ...newDocument('invoice', settings, []),
    number: `${settings.invoicePrefix}0001`,
    dueDate: '',
    client: {
      ...emptyClient,
      name: 'Client Exemple inc.',
      address: '123, rue Principale',
      city: 'Calgary, AB  T2P 1J9',
      phone: '403-555-0142',
      email: 'client@exemple.ca'
    },
    lines: [
      line("Main-d'œuvre — installation", 8, 'h', 85),
      line('Matériaux (bois traité)', 1, 'ea', 450),
      line("Location d'équipement", 2, 'jour', 120),
      line('Déplacement', 1, 'ea', 60)
    ],
    notes: settings.defaultNotes || 'Merci pour votre confiance.',
    history: []
  }
}

export const withEvent = (doc, label) => ({
  ...doc,
  history: [...(doc.history || []), { id: uid(), at: new Date().toISOString(), label }]
})

export const lineTotal = l => Number(l.qty || 0) * Number(l.rate || 0)

export function calcTotals(doc) {
  const subtotal = doc.lines.reduce((s, l) => s + lineTotal(l), 0)
  const rawDiscount = doc.discountType === '%'
    ? subtotal * (Number(doc.discountValue || 0) / 100)
    : Number(doc.discountValue || 0)
  const discount = Math.min(Math.max(rawDiscount, 0), subtotal)
  const taxableSum = doc.lines.reduce((s, l) => s + (l.taxable !== false ? lineTotal(l) : 0), 0)
  const discountShare = subtotal > 0 ? taxableSum * (discount / subtotal) : 0
  const taxBase = Math.max(taxableSum - discountShare, 0)
  const tax = doc.chargeTax ? taxBase * (Number(doc.taxRate || 0) / 100) : 0
  const total = subtotal - discount + tax
  const paid = (doc.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
  const balance = total - paid
  return { subtotal, discount, tax, total, paid, balance }
}

export function docStatus(doc) {
  const { total, balance } = calcTotals(doc)
  if (doc.docType === 'estimate') return doc.closed ? 'closed' : 'open'
  if (total > 0 && balance <= 0.005) return 'paid'
  return 'unpaid'
}

export const lastPaymentDate = doc => {
  const ps = doc.payments || []
  return ps.length ? ps[ps.length - 1].date : ''
}

// Migration depuis les anciennes versions de l'app
export function migrateOldData() {
  try {
    const docs = JSON.parse(localStorage.getItem('is_docs'))
    if (docs) {
      // v2 -> v3 : ajouter history/closed/paymentInfo manquants
      let changed = false
      const upgraded = docs.map(d => {
        if (d.history) return d
        changed = true
        return { ...d, history: [], closed: d.status === 'approved', paymentInfo: d.paymentInfo || '' }
      })
      return changed ? { docs: upgraded } : null
    }
  } catch { /* continue */ }
  if (!localStorage.getItem('inv_invoices')) return null
  try {
    const oldInvoices = JSON.parse(localStorage.getItem('inv_invoices')) || []
    const oldCompany = JSON.parse(localStorage.getItem('inv_company')) || {}
    const oldClients = JSON.parse(localStorage.getItem('inv_clients')) || []
    const docs = oldInvoices.map(inv => ({
      id: inv.id || uid(),
      docType: 'invoice',
      number: inv.number || 'INVOICE0001',
      date: inv.date || today(),
      dueDate: inv.dueDate || '',
      clientId: inv.clientId || '',
      client: inv.client || { ...emptyClient },
      lines: (inv.lines || []).map(l => ({ id: l.id || uid(), description: l.description || '', qty: l.qty || 1, unit: l.unit || 'ea', rate: l.price ?? l.rate ?? 0, taxable: true })),
      chargeTax: inv.chargeGst !== false,
      taxRate: 5,
      discountType: inv.discountType || '$',
      discountValue: inv.discountValue || 0,
      notes: inv.notes || '',
      paymentInfo: '',
      photos: [],
      signature: inv.signature || '',
      payments: [],
      status: 'draft',
      closed: false,
      history: [],
      updatedAt: inv.updatedAt || new Date().toISOString()
    }))
    const settings = {
      ...emptySettings,
      business: {
        ...emptySettings.business,
        name: oldCompany.name || emptySettings.business.name,
        phone: oldCompany.phone || '',
        email: oldCompany.email || '',
        address: oldCompany.address || '',
        city: oldCompany.city || '',
        website: oldCompany.website || '',
        gst: oldCompany.gst || ''
      },
      logo: oldCompany.logo || ''
    }
    return { docs, settings, clients: oldClients }
  } catch {
    return null
  }
}
