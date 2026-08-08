// public/push/sw.js
// A second, minimal service worker registered at scope /push/ — separate
// from vite-plugin-pwa's Workbox-generated SW at scope / (which handles
// offline caching). Two SWs at the same scope would fight over which one
// controls fetches; putting this one at its own nested scope avoids that
// entirely. Push event delivery only depends on which registration the
// subscription was created against, not on the current page's scope, so
// this still works no matter what page the tourist has open — or none.
self.addEventListener('push', (event) => {
  let data = { title: 'Aaraksha', body: 'You have a new safety alert.', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    // Non-JSON payload — fall back to the defaults above
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-icon.svg',
      badge: '/pwa-icon.svg',
      data: { url: data.url },
      requireInteraction: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
