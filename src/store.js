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
export const save = (key, value) => localStorage.setItem(key, JSON.stringify(value))

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
  taxLabel: 'Gst',
  taxRate: 5,
  taxDefault: true,
  accent: '#4353c9',
  invoicePrefix: 'INVOICE',
  estimatePrefix: 'EST',
  defaultNotes: '',
  paymentInstructions: ''
}

export const emptyClient = { id: '', name: '', phone: '', email: '', address: '', city: '', notes: '' }
export const emptyItem = { id: '', description: '', unit: 'ea', rate: 0, taxable: true }
export const emptyExpense = { id: '', date: '', description: '', category: 'Matériel', amount: 0 }

export const EXPENSE_CATEGORIES = ['Matériel', 'Essence', 'Outils', 'Sous-traitance', 'Repas', 'Autre']

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
