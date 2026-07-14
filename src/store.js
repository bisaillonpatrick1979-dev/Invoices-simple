// Données, persistance localStorage et calculs partagés

export const uid = () => Math.random().toString(36).slice(2, 10)
export const today = () => new Date().toISOString().slice(0, 10)
export const money = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0))

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
  taxLabel: 'GST',
  taxRate: 5,
  taxDefault: true,
  accent: '#2e7d32',
  invoicePrefix: 'INV',
  estimatePrefix: 'EST',
  defaultNotes: 'Merci pour votre confiance.',
  paymentInstructions: ''
}

export const emptyClient = { id: '', name: '', phone: '', email: '', address: '', city: '', notes: '' }
export const emptyItem = { id: '', description: '', unit: 'ea', rate: 0, taxable: true }

export const newLine = () => ({ id: uid(), description: '', qty: 1, unit: 'ea', rate: 0, taxable: true })

export const TERMS = [
  { id: 'receipt', label: 'Sur réception', days: 0 },
  { id: '7', label: 'Net 7 jours', days: 7 },
  { id: '14', label: 'Net 14 jours', days: 14 },
  { id: '30', label: 'Net 30 jours', days: 30 },
  { id: 'custom', label: 'Date personnalisée', days: null }
]

export const dueDateFromTerms = (date, termsId) => {
  const t = TERMS.find(x => x.id === termsId)
  if (!t || t.days == null) return ''
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + t.days)
  return d.toISOString().slice(0, 10)
}

export const nextNumber = (docs, type, prefix) => {
  const year = new Date().getFullYear()
  const nums = docs
    .filter(d => d.docType === type)
    .map(d => {
      const m = String(d.number || '').match(/(\d+)\s*$/)
      return m ? Number(m[1]) : 0
    })
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}-${year}-${String(next).padStart(3, '0')}`
}

export const newDocument = (type, settings, docs) => ({
  id: uid(),
  docType: type,
  number: nextNumber(docs, type, type === 'invoice' ? settings.invoicePrefix : settings.estimatePrefix),
  date: today(),
  terms: '14',
  dueDate: dueDateFromTerms(today(), '14'),
  clientId: '',
  client: { ...emptyClient },
  lines: [newLine()],
  chargeTax: settings.taxDefault,
  taxRate: settings.taxRate,
  discountType: '$',
  discountValue: 0,
  notes: settings.defaultNotes,
  photos: [],
  signature: '',
  payments: [],
  status: 'draft',
  updatedAt: new Date().toISOString()
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
  if (doc.docType === 'estimate') return doc.status === 'approved' ? 'approved' : (doc.status === 'sent' ? 'sent' : 'draft')
  if (total > 0 && balance <= 0.005) return 'paid'
  if (doc.status === 'sent' || (doc.payments || []).length > 0) {
    if (doc.dueDate && doc.dueDate < today()) return 'overdue'
    return 'outstanding'
  }
  return 'draft'
}

export const STATUS_LABELS = {
  draft: 'Brouillon',
  outstanding: 'Impayée',
  overdue: 'En retard',
  paid: 'Payée',
  sent: 'Envoyée',
  approved: 'Approuvée'
}

// Migration depuis l'ancienne version de l'app (inv_invoices / inv_company)
export function migrateOldData() {
  if (localStorage.getItem('is_docs') || !localStorage.getItem('inv_invoices')) return null
  try {
    const oldInvoices = JSON.parse(localStorage.getItem('inv_invoices')) || []
    const oldCompany = JSON.parse(localStorage.getItem('inv_company')) || {}
    const oldClients = JSON.parse(localStorage.getItem('inv_clients')) || []
    const docs = oldInvoices.map(inv => ({
      id: inv.id || uid(),
      docType: 'invoice',
      number: inv.number || 'INV-001',
      date: inv.date || today(),
      terms: 'custom',
      dueDate: inv.dueDate || '',
      clientId: inv.clientId || '',
      client: inv.client || { ...emptyClient },
      lines: (inv.lines || []).map(l => ({ id: l.id || uid(), description: l.description || '', qty: l.qty || 1, unit: l.unit || 'ea', rate: l.price || 0, taxable: true })),
      chargeTax: inv.chargeGst !== false,
      taxRate: 5,
      discountType: inv.discountType || '$',
      discountValue: inv.discountValue || 0,
      notes: inv.notes || '',
      photos: [],
      signature: inv.signature || '',
      payments: [],
      status: 'draft',
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
