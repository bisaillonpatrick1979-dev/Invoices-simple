// Service worker : ce qui rend l'app installable, et vivante sans réseau.
//
// Deux règles, pas plus. Les fichiers de code portent une empreinte dans leur
// nom : une fois téléchargés, ils ne changent jamais, donc on les sert depuis
// le cache sans rien demander. Les pages, elles, passent par le réseau
// d'abord — sinon une mise à jour mettrait des jours à arriver — et retombent
// sur la dernière page connue quand il n'y a pas de signal.
//
// Un magasin d'applications refuse une app qui affiche une page blanche hors
// ligne. Un chantier à Fort McKay aussi.

const CACHE = 'invoices-simple-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Les pages : réseau d'abord, cache en secours.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const copie = res.clone()
          caches.open(CACHE).then(c => c.put('/', copie))
          return res
        })
        .catch(() => caches.match('/').then(r => r || caches.match(request)))
    )
    return
  }

  // Le reste : cache d'abord, et on garde ce qui arrive.
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      if (res.ok && res.type === 'basic') {
        const copie = res.clone()
        caches.open(CACHE).then(c => c.put(request, copie))
      }
      return res
    }))
  )
})
