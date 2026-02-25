/**
 * Migration Script: Update existing orders with buyer details and status timestamps
 * 
 * This script fetches all existing orders and updates them with:
 * - customerName (from user profile)
 * - phone (from user profile)  
 * - location (copied from address field)
 * - pincode (extracted from address or set to 'N/A')
 * - userEmail (copied from order or fetched from user)
 * - userPhone (from user profile)
 * - placedAt (from createdAt or timestamp)
 * - acceptedAt (for Accepted/Fulfilled orders)
 * - shippedAt (for Fulfilled orders)
 * - deliveredAt (for Fulfilled orders)
 * 
 * Usage: node scripts/migrate-orders.js
 */

const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Check for service account key
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account key not found!');
    console.error('Please download your Firebase service account key from:');
    console.error('https://console.firebase.google.com/project/kkr-groceries-02/settings/serviceaccounts/adminsdk');
    console.error('\nSave it as "serviceAccountKey.json" in the project root.');
    process.exit(1);
}

// Initialize Firebase Admin
const serviceAccount = require(serviceAccountPath);

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'kkr-groceries-02'
});

const db = getFirestore();

// Pincode extraction patterns
const PINCODE_PATTERNS = [
    /(\d{6})/,                          // 6 digits anywhere
    /pincode[\s:]*?(\d{6})/i,          // pincode: 500001
    /pin[\s:]*?(\d{6})/i,              // pin: 500001
    /postal[\s:]*?(\d{6})/i,           // postal: 500001
    /(\d{6})\s*,?\s*(?:India|IN)/i,   // 500001, India
];

/**
 * Extract pincode from address string
 * @param {string} address 
 * @returns {string|null}
 */
function extractPincode(address) {
    if (!address) return null;
    
    for (const pattern of PINCODE_PATTERNS) {
        const match = address.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

/**
 * Fetch user details from Firestore
 * @param {string} userId 
 * @returns {Promise<Object|null>}
 */
async function getUserDetails(userId) {
    if (!userId) return null;
    
    try {
        // Try to get user from users collection
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const data = userDoc.data();
            return {
                displayName: data.displayName || data.name || null,
                phoneNumber: data.phoneNumber || data.phone || null,
                email: data.email || null
            };
        }
        
        // If no user doc, try to get from saved addresses
        const addressesSnap = await db.collection('users').doc(userId).collection('addresses').limit(1).get();
        if (!addressesSnap.empty) {
            const addrData = addressesSnap.docs[0].data();
            return {
                displayName: addrData.contactName || addrData.name || null,
                phoneNumber: addrData.contactPhone || addrData.phone || null,
                email: null
            };
        }
        
        return null;
    } catch (error) {
        console.warn(`⚠️  Could not fetch user details for ${userId}:`, error.message);
        return null;
    }
}

/**
 * Migrate all orders
 */
async function migrateOrders() {
    console.log('🚀 Starting order migration...\n');
    
    try {
        // Get all orders
        const ordersSnapshot = await db.collection('orders').get();
        const orders = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`📦 Found ${orders.length} orders to process\n`);
        
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        
        for (const order of orders) {
            try {
                console.log(`Processing order: ${order.id}`);
                
                // Check if already has all fields
                if (order.customerName && order.phone && order.location && order.pincode) {
                    console.log(`  ✅ Already has all details, skipping`);
                    skipped++;
                    continue;
                }
                
                const updates = {};
                
                // Get user details if userId exists
                let userDetails = null;
                if (order.userId) {
                    userDetails = await getUserDetails(order.userId);
                }
                
                // Set customerName
                if (!order.customerName) {
                    if (userDetails?.displayName) {
                        updates.customerName = userDetails.displayName;
                    } else if (order.userEmail) {
                        // Use email username as fallback
                        updates.customerName = order.userEmail.split('@')[0];
                    } else {
                        updates.customerName = 'Unknown';
                    }
                }
                
                // Set phone
                if (!order.phone) {
                    if (userDetails?.phoneNumber) {
                        updates.phone = userDetails.phoneNumber;
                    } else {
                        updates.phone = 'N/A';
                    }
                }
                
                // Set userPhone
                if (!order.userPhone && userDetails?.phoneNumber) {
                    updates.userPhone = userDetails.phoneNumber;
                }
                
                // Set userEmail if missing
                if (!order.userEmail && userDetails?.email) {
                    updates.userEmail = userDetails.email;
                }
                
                // Set location from address
                if (!order.location && order.address) {
                    updates.location = order.address;
                }
                
                // Set pincode
                if (!order.pincode) {
                    // Try to extract from address
                    const extractedPin = extractPincode(order.address);
                    if (extractedPin) {
                        updates.pincode = extractedPin;
                    } else {
                        updates.pincode = 'N/A';
                    }
                }
                
                // Set up status timestamps for workflow tracking
                // placedAt - use existing createdAt, timestamp, or current time
                if (!order.placedAt) {
                    if (order.createdAt) {
                        updates.placedAt = order.createdAt;
                    } else if (order.timestamp) {
                        updates.placedAt = admin.firestore.Timestamp.fromDate(new Date(order.timestamp));
                    }
                }
                
                // acceptedAt - for Accepted/Fulfilled orders, estimate if not present
                if (!order.acceptedAt && (order.status === 'Accepted' || order.status === 'Fulfilled')) {
                    // Use placedAt + 1 hour as estimate, or current time as fallback
                    if (updates.placedAt || order.placedAt || order.createdAt) {
                        const baseTime = (updates.placedAt || order.placedAt || order.createdAt).toDate 
                            ? (updates.placedAt || order.placedAt || order.createdAt).toDate() 
                            : new Date(order.timestamp);
                        baseTime.setHours(baseTime.getHours() + 1);
                        updates.acceptedAt = admin.firestore.Timestamp.fromDate(baseTime);
                    }
                }
                
                // shippedAt - for Fulfilled orders
                if (!order.shippedAt && order.status === 'Fulfilled') {
                    // Use acceptedAt + 2 hours as estimate, or placedAt + 3 hours
                    const baseTime = (updates.acceptedAt || order.acceptedAt || updates.placedAt || order.placedAt || order.createdAt)?.toDate 
                        ? (updates.acceptedAt || order.acceptedAt || updates.placedAt || order.placedAt || order.createdAt).toDate()
                        : new Date(order.timestamp);
                    if (baseTime) {
                        baseTime.setHours(baseTime.getHours() + (updates.acceptedAt || order.acceptedAt ? 2 : 3));
                        updates.shippedAt = admin.firestore.Timestamp.fromDate(baseTime);
                    }
                }
                
                // deliveredAt (fulfilledAt) - for Fulfilled orders
                if (!order.deliveredAt && !order.fulfilledAt && order.status === 'Fulfilled') {
                    // Use shippedAt + 2 hours as estimate, or placedAt + 5 hours
                    const baseTime = (updates.shippedAt || order.shippedAt || updates.acceptedAt || order.acceptedAt || updates.placedAt || order.placedAt || order.createdAt)?.toDate
                        ? (updates.shippedAt || order.shippedAt || updates.acceptedAt || order.acceptedAt || updates.placedAt || order.placedAt || order.createdAt).toDate()
                        : new Date(order.timestamp);
                    if (baseTime) {
                        baseTime.setHours(baseTime.getHours() + (updates.shippedAt || order.shippedAt ? 2 : 5));
                        updates.deliveredAt = admin.firestore.Timestamp.fromDate(baseTime);
                    }
                }
                
                // rejectedAt - for Rejected orders
                if (!order.rejectedAt && order.status === 'Rejected') {
                    if (order.createdAt) {
                        updates.rejectedAt = order.createdAt;
                    } else if (order.timestamp) {
                        updates.rejectedAt = admin.firestore.Timestamp.fromDate(new Date(order.timestamp));
                    }
                }
                
                // Update order if there are changes
                if (Object.keys(updates).length > 0) {
                    await db.collection('orders').doc(order.id).update(updates);
                    console.log(`  ✅ Updated with:`, updates);
                    updated++;
                } else {
                    console.log(`  ℹ️  No updates needed`);
                    skipped++;
                }
                
            } catch (error) {
                console.error(`  ❌ Error updating order ${order.id}:`, error.message);
                errors++;
            }
        }
        
        console.log('\n📊 Migration Summary:');
        console.log(`   ✅ Updated: ${updated} orders`);
        console.log(`   ⏭️  Skipped: ${skipped} orders`);
        console.log(`   ❌ Errors: ${errors} orders`);
        console.log('\n🎉 Migration complete!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateOrders().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});
