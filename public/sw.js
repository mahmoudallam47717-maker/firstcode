self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      let isVisible = false;
      for (let i = 0; i < windowClients.length; i++) {
        // لو فاتح المنصة قدامه مش هنبعت إشعار خارجي عشان ميبقاش مرتين
        if (windowClients[i].visibilityState === 'visible') {
          isVisible = true; break;
        }
      }
      // لو قافل المتصفح أو في الخلفية، ابعت إشعار النظام الأساسي
      if (!isVisible) {
        return self.registration.showNotification(data.title || 'مكتبنا', {
          body: data.message || 'يوجد تحديث في مشاريعك',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200, 100, 200], // هزاز التليفون
          requireInteraction: true
        });
      }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === '/' && 'focus' in client) { return client.focus(); }
      }
      if (clients.openWindow) { return clients.openWindow('/'); }
    })
  );
});