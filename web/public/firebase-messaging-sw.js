/* Firebase Cloud Messaging — background notification handler.
   Runs outside the app (even when no tab is open) to show push notifications
   for new delivery assignments. The config values below are the public
   NEXT_PUBLIC_* keys already shipped in the client bundle — safe to embed. */

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCHO2m3Cs9ESdKl-3dzqzPrT_eup-SX2OE",
  authDomain: "kkr-groceries-02.firebaseapp.com",
  projectId: "kkr-groceries-02",
  storageBucket: "kkr-groceries-02.firebasestorage.app",
  messagingSenderId: "651622006147",
  appId: "1:651622006147:web:da188b9ad4f4640eb1cab6",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "KKR Groceries";
  const body = (payload.notification && payload.notification.body) || "You have a new delivery.";
  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: (payload.data && payload.data.tag) || "kkr-delivery",
    data: payload.data || {},
    requireInteraction: true,
    vibrate: [200, 100, 200],
  });
});

// Focus/open the delivery console when the agent taps the notification.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/delivery";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
