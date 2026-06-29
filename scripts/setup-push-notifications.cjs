#!/usr/bin/env node
/**
 * Setup Push Notifications Script
 * 
 * This script provides instructions for setting up Firebase Cloud Messaging
 * push notifications for the KKR Groceries app.
 * 
 * To get a valid VAPID key:
 * 1. Go to Firebase Console: https://console.firebase.google.com/project/kkr-groceries-02/settings/cloudmessaging
 * 2. Scroll down to "Web Push certificates"
 * 3. Click "Generate Key Pair"
 * 4. Copy the public key (starts with "B")
 * 5. Replace VAPID_KEY in src/services/notifications.js
 * 
 * To deploy the Cloud Functions:
 * firebase deploy --only functions
 */

const fs = require('fs');
const path = require('path');

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║          KKR Groceries - Push Notification Setup Guide                       ║
╠══════════════════════════════════════════════════════════════════════════════╣

1. GET VAPID KEY FROM FIREBASE CONSOLE:
   ------------------------------------
   a. Visit: https://console.firebase.google.com/project/kkr-groceries-02/settings/cloudmessaging
   b. Scroll to "Web Push certificates" section
   c. Click "Generate Key Pair"
   d. Copy the public key (starts with "B")

2. UPDATE VAPID_KEY IN NOTIFICATIONS SERVICE:
   ------------------------------------------
   File: src/services/notifications.js
   
   Replace:
   const VAPID_KEY = 'BBlQ7_sB2eR0_Q-j53f6bH0KJrLEeON1X5sY7L8nX9QyQ9zQa0gJ3YyV7qK3x7v9w0x8z7y6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4';
   
   With your actual key:
   const VAPID_KEY = 'YOUR_ACTUAL_VAPID_KEY_HERE';

3. DEPLOY CLOUD FUNCTIONS:
   -----------------------
   Run: firebase deploy --only functions
   
   This deploys:
   - registerFCMToken: Registers device tokens for push notifications
   - sendPushNotification: Sends push notifications to users
   - onNotificationCreated: Firestore trigger for automatic push notifications

4. VERIFY SETUP:
   -------------
   a. Open the app in a browser
   b. Sign in as a user
   c. Click user menu → "🔔 Enable Notifications"
   d. Accept the browser permission prompt
   e. Check browser console for "FCM Token obtained"

5. TEST NOTIFICATIONS:
   -------------------
   a. Place an order as a buyer
   b. Admin should receive email notification
   c. Buyer should receive push when order status changes

╔══════════════════════════════════════════════════════════════════════════════╗
║          Cloud Functions Deployed                                            ║
╠══════════════════════════════════════════════════════════════════════════════╣

The following Cloud Functions have been added to functions/index.js:

✓ registerFCMToken(userId, token, platform)
  - Registers FCM token for a user
  
✓ sendPushNotification(userId, title, body, data)
  - Sends push notification to specific user
  
✓ onNotificationCreated(trigger)
  - Automatically sends push when notification doc is created
  
✓ getUserClaims(email)
  - Gets user claims (existing)
  
✓ setAdminClaim(email, admin)
  - Sets admin claim (existing)
  
✓ submitOrder(data)
  - Submits order and sends email (existing)

╚══════════════════════════════════════════════════════════════════════════════╝
`);

// Check if functions/index.js exists and has the new functions
const functionsPath = path.join(__dirname, '..', 'functions', 'index.js');
if (fs.existsSync(functionsPath)) {
    const content = fs.readFileSync(functionsPath, 'utf8');
    
    const hasRegisterFCM = content.includes('registerFCMToken');
    const hasSendPush = content.includes('sendPushNotification');
    const hasOnNotification = content.includes('onNotificationCreated');
    
    console.log('Function Status:');
    console.log(`  ${hasRegisterFCM ? '✓' : '✗'} registerFCMToken`);
    console.log(`  ${hasSendPush ? '✓' : '✗'} sendPushNotification`);
    console.log(`  ${hasOnNotification ? '✓' : '✗'} onNotificationCreated`);
    console.log('');
    
    if (hasRegisterFCM && hasSendPush && hasOnNotification) {
        console.log('✅ All push notification functions are ready!');
        console.log('');
        console.log('Next step: Run the following command to deploy:');
        console.log('  firebase deploy --only functions');
    } else {
        console.log('⚠️  Some functions are missing. Please check functions/index.js');
    }
} else {
    console.log('⚠️  functions/index.js not found');
}

console.log('');
