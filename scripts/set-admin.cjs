#!/usr/bin/env node
/**
 * Set Admin Claim for a User
 * Usage: node scripts/set-admin.cjs <email>
 */

const admin = require('firebase-admin');
const serviceAccount = require('../.firebase/serviceAccountKey.json');

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

async function setAdminClaim(email) {
  if (!email) {
    console.error('❌ Error: Email address required');
    console.log('Usage: node scripts/set-admin.cjs <email>');
    process.exit(1);
  }
  
  try {
    console.log(`Setting admin claim for: ${email}...`);
    
    // Get user by email
    const user = await auth.getUserByEmail(email);
    console.log(`Found user: ${user.uid}`);
    
    // Set custom claim
    await auth.setCustomUserClaims(user.uid, { admin: true });
    
    // Verify
    const updatedUser = await auth.getUser(user.uid);
    console.log('\n✅ Admin claim set successfully!');
    console.log(`Email: ${updatedUser.email}`);
    console.log(`UID: ${updatedUser.uid}`);
    console.log(`Claims: ${JSON.stringify(updatedUser.customClaims)}`);
    console.log('\n⚠️  Note: User must sign out and sign back in for changes to take effect.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.log('\n💡 User does not exist. They need to sign up first.');
    }
    process.exit(1);
  }
}

const email = process.argv[2];
setAdminClaim(email).finally(() => process.exit());
