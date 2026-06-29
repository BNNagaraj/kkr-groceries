# Push Notification Setup - Complete ✅

## Overview
Push notifications have been successfully implemented for the KKR Groceries app using Firebase Cloud Messaging (FCM).

## Deployed Cloud Functions

| Function | Status | Purpose |
|----------|--------|---------|
| `registerFCMToken` | ✅ Active | Registers device tokens for push notifications |
| `sendPushNotification` | ✅ Active | Sends push notifications to specific users |
| `onNotificationCreated` | ⚠️ Skipped | Firestore trigger (Eventarc permissions issue) |

**Note:** The `onNotificationCreated` trigger had Eventarc permission issues, so we implemented a workaround by calling `sendPushNotification` directly from the client-side notification service.

## How Push Notifications Work

### 1. Token Registration
When a user enables notifications:
1. Browser requests notification permission
2. FCM generates a device token
3. Token is saved via `registerFCMToken` Cloud Function
4. Token stored in Firestore: `users/{userId}/tokens/fcm`

### 2. Sending Notifications
When an order status changes:
1. `notifyBuyerOrderStatus()` is called
2. Creates notification document in Firestore
3. Calls `sendPushNotification()` Cloud Function directly
4. Cloud Function sends FCM message to user's device

### 3. Notification Triggers

| Event | Notification Sent To |
|-------|---------------------|
| Order Placed | Admin (email) |
| Order Accepted | Buyer (push + in-app) |
| Order Fulfilled | Buyer (push + in-app) |
| Order Rejected | Buyer (push + in-app) |
| Order Modified | Buyer (push + in-app) |

## Files Modified

### Cloud Functions (`functions/index.js`)
- Added `registerFCMToken` - Registers FCM tokens
- Added `sendPushNotification` - Sends push notifications
- Added `onNotificationCreated` - Firestore trigger (not deployed)

### Client Side
- `src/services/notifications.js` - Complete notification service
- `src/services/orders.js` - Triggers notifications on status changes
- `sw.js` - Service worker for background message handling
- `index.html` - Added notification enable button

## Testing Push Notifications

### Step 1: Enable Notifications
1. Open https://kkr-groceries-02.web.app
2. Sign in as a buyer
3. Click user menu (avatar) → "🔔 Enable Notifications"
4. Accept browser permission prompt
5. Check browser console for: "FCM Token obtained"

### Step 2: Test Order Flow
1. Place an order as a buyer
2. Admin receives email notification
3. Admin accepts the order
4. **Buyer receives push notification**: "Your order has been accepted! 🎉"

### Step 3: Verify Token Storage
Check Firestore for token:
```
/users/{userId}/tokens/fcm
  - token: "fcm_token_here"
  - platform: "web"
  - active: true
```

## VAPID Key Configuration

The VAPID key is configured in `src/services/notifications.js`:

```javascript
const VAPID_KEY = 'BN2ZK9oUMQ2NN9mIDb-bFD6kUAtJSQKNkRcag5znq2o-rZkRpD2sU03i291DuYueXSjlAN-sNili7aCWW_ZNVD8';
```

**Note:** If you need to regenerate the VAPID key:
1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Scroll to "Web Push certificates"
3. Generate new key pair
4. Update the `VAPID_KEY` constant
5. Rebuild and redeploy

## Troubleshooting

### Notifications not appearing
1. Check browser console for errors
2. Verify notification permission is granted
3. Check FCM token is saved in Firestore
4. Verify `sendPushNotification` function is deployed

### Token registration fails
1. Ensure user is signed in
2. Check Firebase Functions are deployed: `firebase functions:list`
3. Verify browser supports notifications

### Push not received
1. Check browser notification settings
2. Ensure service worker is registered
3. Check Cloud Function logs in Firebase Console

## Architecture Diagram

```
┌─────────────┐     Accept Order      ┌─────────────┐
│   Admin     │ ────────────────────> │   Firestore │
│   Panel     │                       │   Orders    │
└─────────────┘                       └──────┬──────┘
                                             │
                                             │ onSnapshot
                                             │
┌─────────────┐     Send Push             ┌─────────────┐
│   Buyer     │ <──────────────────────── │  Client App │
│   Device    │   (FCM HTTP v1 API)       │             │
└─────────────┘                           └─────────────┘
                                                │
                                                │ Callable Function
                                                ▼
                                         ┌─────────────┐
                                         │sendPushNotif│
                                         │  (Cloud Fn) │
                                         └─────────────┘
```

## Deployment Status

✅ **Hosting**: https://kkr-groceries-02.web.app  
✅ **registerFCMToken**: Deployed  
✅ **sendPushNotification**: Deployed  
⚠️ **onNotificationCreated**: Skipped (using direct call workaround)  

---

**Last Updated**: 2026-02-26  
**Deployed By**: Firebase MCP Tools
