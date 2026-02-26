/**
 * Set admin claim for a user using Firebase Admin SDK
 * Usage: node scripts/set-admin.js <email>
 * Example: node scripts/set-admin.js raju2uraju@gmail.com
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Check if service account exists
const fs = require('fs');
const path = require('path');

let serviceAccount;
const possiblePaths = [
  path.join(__dirname, '..', 'serviceAccountKey.json'),
  path.join(__dirname, 'serviceAccountKey.json'),
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    serviceAccount = require(p);
    break;
  }
}

if (!serviceAccount) {
  console.error('❌ Error: serviceAccountKey.json not found!');
  console.error('Please download your service account key from Firebase Console:');
  console.error('1. Go to https://console.firebase.google.com/project/kkr-groceries-02/settings/serviceaccounts/adminsdk');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save the file as "serviceAccountKey.json" in the project root');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'kkr-groceries-02'
});

const email = process.argv[2] || 'raju2uraju@gmail.com';

async function setAdminClaim() {
  try {
    console.log(`🔍 Finding user: ${email}`);
    const user = await getAuth().getUserByEmail(email);
    console.log(`✅ Found user: ${user.uid}`);
    
    console.log(`🔑 Setting admin claim...`);
    await getAuth().setCustomUserClaims(user.uid, { admin: true });
    
    // Verify
    const updatedUser = await getAuth().getUser(user.uid);
    console.log(`\n✅ SUCCESS! Admin claim set for ${email}`);
    console.log(`Current claims:`, updatedUser.customClaims);
    console.log(`\n⚠️  IMPORTANT: The user must sign out and sign back in for the changes to take effect.`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.code === 'auth/user-not-found') {
      console.error(`User with email ${email} not found in Firebase Authentication.`);
    }
    process.exit(1);
  }
  process.exit(0);
}

setAdminClaim();
