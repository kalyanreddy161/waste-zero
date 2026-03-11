self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : { title: 'Notification', body: '' };
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/recycle_icon.svg',
        data: { url: data.url },
        actions: [
          { action: 'open', title: 'Open' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      })
    );
  } catch (e) { }
});

self.addEventListener('notificationclick', (event) => {
  try {
    event.notification.close();
    if (event.action === 'open') {
      event.waitUntil(clients.openWindow(event.notification.data && event.notification.data.url ? event.notification.data.url : '/'));
    }
    else if (event.action === 'dismiss') {
    // do nothing
    return;
    }
     else {
      // default open
      event.waitUntil(clients.openWindow(event.notification.data && event.notification.data.url ? event.notification.data.url : '/'));
    }
  } catch (e) { }
});
