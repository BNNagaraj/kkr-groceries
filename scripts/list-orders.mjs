/**
 * List all orders from Firestore using Firebase Admin SDK
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', '.firebase', 'serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'kkr-groceries-02'
});

const db = getFirestore();

async function listOrders() {
  try {
    console.log('🔍 Fetching orders from Firestore...\n');
    
    const ordersSnapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    if (ordersSnapshot.empty) {
      console.log('📭 No orders found');
      return;
    }
    
    console.log(`📦 Found ${ordersSnapshot.size} orders:\n`);
    console.log('═'.repeat(100));
    
    ordersSnapshot.docs.forEach((doc, index) => {
      const order = doc.data();
      console.log(`\n#${index + 1} | Order ID: ${order.orderId || order.id || doc.id}`);
      console.log(`    Customer: ${order.customerName || 'N/A'}`);
      console.log(`    Email: ${order.userEmail || order.email || 'N/A'}`);
      console.log(`    Phone: ${order.phone || order.userPhone || 'N/A'}`);
      console.log(`    Status: ${order.status || 'Pending'}`);
      console.log(`    Total: ${order.totalValue || 'N/A'}`);
      console.log(`    Items: ${order.productCount || (order.cart?.length || 0)}`);
      console.log(`    Created: ${order.createdAt?.toDate?.() || order.timestamp || 'N/A'}`);
      console.log(`    Location: ${order.location || 'N/A'}`);
      console.log('-'.repeat(100));
    });
    
    console.log(`\n✅ Total: ${ordersSnapshot.size} orders`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  process.exit(0);
}

listOrders();
