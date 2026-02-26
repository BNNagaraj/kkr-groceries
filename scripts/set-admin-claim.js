/**
 * Set admin claim for a user using Firebase Admin SDK
 * Run with: node scripts/set-admin-claim.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Initialize with service account
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'kkr-groceries-02'
});

const email = process.argv[2] || 'nagaraj.b@swastikinfralogics.com';

async function setAdminClaim() {
  try {
    console.log(`Setting admin claim for: ${email}`);
    
    const user = await getAuth().getUserByEmail(email);
    console.log(`Found user: ${user.uid}`);
    
    await getAuth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`✅ Admin claim set successfully!`);
    
    // Verify
    const updatedUser = await getAuth().getUser(user.uid);
    console.log('Current claims:', updatedUser.customClaims);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  process.exit(0);
}

setAdminClaim();
