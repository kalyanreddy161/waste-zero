self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : { title: 'Notification', body: '' };
    console.log('[sw] push received', data);
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
    console.log('[sw] notificationclick', event.action, event.notification && event.notification.data);
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
