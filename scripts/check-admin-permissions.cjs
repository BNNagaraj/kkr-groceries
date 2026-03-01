#!/usr/bin/env node
/**
 * Check Firebase Admin Permissions
 * 
 * This script checks:
 * 1. Firestore rules for admin permissions
 * 2. User custom claims in Firebase Auth
 * 3. Cloud Functions configuration
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../.firebase/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

// Admin emails list (must match firestore.rules)
const ADMIN_EMAILS = [
  'raju2uraju@gmail.com',
  'kanthati.chakri@gmail.com',
  'nagaraj.b@swastikinfralogics.com'
];

async function checkAdminUsers() {
  console.log('========================================');
  console.log('  FIREBASE ADMIN PERMISSIONS CHECK');
  console.log('========================================\n');
  
  console.log('Step 1: Checking Firestore Rules...');
  console.log('----------------------------------------');
  
  const rulesPath = path.join(__dirname, '../firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');
  
  // Check if rules have admin function with email fallback
  const hasAdminFunction = rulesContent.includes('function isAdmin()');
  const hasEmailCheck = rulesContent.includes('request.auth.token.email.lower()');
  const hasClaimCheck = rulesContent.includes('request.auth.token.admin == true');
  
  console.log('Admin Function:', hasAdminFunction ? '✅ Found' : '❌ Missing');
  console.log('Custom Claim Check:', hasClaimCheck ? '✅ Found' : '❌ Missing');
  console.log('Email Fallback Check:', hasEmailCheck ? '✅ Found' : '❌ Missing');
  
  // Extract admin emails from rules
  const emailMatch = rulesContent.match(/\[([^\]]+)\]/);
  if (emailMatch) {
    const emails = emailMatch[0].match(/'[^']+'/g) || [];
    console.log('\nAdmin Emails in Rules:');
    emails.forEach(email => console.log('  •', email.replace(/'/g, '')));
  }
  
  console.log('\n----------------------------------------');
  console.log('Step 2: Checking Firebase Auth Users...');
  console.log('----------------------------------------\n');
  
  let adminUsersFound = 0;
  let issuesFound = [];
  
  for (const email of ADMIN_EMAILS) {
    try {
      const user = await auth.getUserByEmail(email);
      const claims = user.customClaims || {};
      const hasAdminClaim = claims.admin === true;
      
      console.log(`User: ${email}`);
      console.log(`  UID: ${user.uid}`);
      console.log(`  Email Verified: ${user.emailVerified ? '✅ Yes' : '⚠️  No'}`);
      console.log(`  Admin Claim: ${hasAdminClaim ? '✅ Yes' : '❌ No'}`);
      console.log(`  All Claims: ${JSON.stringify(claims)}`);
      
      if (hasAdminClaim) {
        adminUsersFound++;
      } else {
        issuesFound.push({
          email,
          issue: 'Missing admin custom claim',
          fix: `Run: node scripts/set-admin.cjs ${email}`
        });
      }
      
      // Check if user is disabled
      if (user.disabled) {
        issuesFound.push({
          email,
          issue: 'Account is disabled',
          fix: 'Enable account in Firebase Console'
        });
        console.log(`  ⚠️  WARNING: Account is disabled!`);
      }
      
      console.log();
    } catch (err) {
      console.log(`User: ${email}`);
      console.log(`  ❌ Error: ${err.message}`);
      issuesFound.push({
        email,
        issue: `User not found: ${err.message}`,
        fix: 'User needs to sign up first'
      });
      console.log();
    }
  }
  
  console.log('----------------------------------------');
  console.log('Step 3: Checking All Users with Admin Claims...');
  console.log('----------------------------------------\n');
  
  let nextPageToken;
  const allAdmins = [];
  do {
    const listUsersResult = await auth.listUsers(100, nextPageToken);
    listUsersResult.users.forEach(user => {
      if (user.customClaims && user.customClaims.admin === true) {
        allAdmins.push({ email: user.email, uid: user.uid });
      }
    });
    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);
  
  if (allAdmins.length === 0) {
    console.log('⚠️  No users with admin claim found!');
    issuesFound.push({
      email: 'N/A',
      issue: 'No admin users configured',
      fix: 'Run: node scripts/set-admin.cjs <email>'
    });
  } else {
    console.log(`Found ${allAdmins.length} admin(s):`);
    allAdmins.forEach(admin => {
      console.log(`  ✅ ${admin.email} (${admin.uid})`);
    });
  }
  
  console.log('\n----------------------------------------');
  console.log('Step 4: Testing Firestore Admin Access...');
  console.log('----------------------------------------\n');
  
  try {
    // Try to read orders collection (admin should be able to)
    const ordersSnap = await db.collection('orders').limit(1).get();
    console.log('✅ Firestore read access: Working');
    console.log(`   Orders collection accessible (${ordersSnap.size} documents in sample)`);
  } catch (err) {
    console.log('❌ Firestore read access failed:', err.message);
    issuesFound.push({
      email: 'N/A',
      issue: 'Firestore access failed: ' + err.message,
      fix: 'Check Firestore rules deployment'
    });
  }
  
  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`Admin Users with Claims: ${adminUsersFound}/${ADMIN_EMAILS.length}`);
  console.log(`Total Admins in System: ${allAdmins.length}`);
  console.log(`Issues Found: ${issuesFound.length}`);
  
  if (issuesFound.length > 0) {
    console.log('\n⚠️  Issues Found:');
    console.log('----------------------------------------');
    issuesFound.forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue.email}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Fix: ${issue.fix}`);
      console.log();
    });
    
    console.log('\n🔧 Quick Fixes:');
    console.log('----------------------------------------');
    console.log('To set admin claim for a user:');
    console.log('  node scripts/set-admin.cjs <email>');
    console.log('\nTo deploy updated Firestore rules:');
    console.log('  firebase deploy --only firestore:rules');
  } else {
    console.log('\n✅ All admin permissions are configured correctly!');
  }
  
  console.log('\n========================================\n');
}

checkAdminUsers()
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
