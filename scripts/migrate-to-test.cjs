/**
 * One-time migration: Copy current data from base collections to test_ prefixed collections.
 * After this, "real mode" starts with empty transactional data.
 *
 * Collections migrated:
 *   orders       → test_orders
 *   stockPurchases → test_stockPurchases
 *   accountEntries → test_accountEntries
 *   notifications  → test_notifications
 *
 * Usage: node scripts/migrate-to-test.cjs
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const COLLECTIONS_TO_MIGRATE = [
  "orders",
  "stockPurchases",
  "accountEntries",
  "notifications",
];

async function migrateCollection(baseName) {
  const targetName = `test_${baseName}`;
  const sourceRef = db.collection(baseName);
  const targetRef = db.collection(targetName);

  const snapshot = await sourceRef.get();

  if (snapshot.empty) {
    console.log(`  ${baseName}: 0 documents (skipping)`);
    return 0;
  }

  // Check if target already has data
  const existingTarget = await targetRef.limit(1).get();
  if (!existingTarget.empty) {
    console.log(`  ${baseName}: target "${targetName}" already has data — skipping to avoid duplicates`);
    return 0;
  }

  // Write documents one-by-one to avoid payload size limits
  // (some orders contain large base64 image data)
  let count = 0;

  for (const doc of snapshot.docs) {
    try {
      await targetRef.doc(doc.id).set(doc.data());
      count++;
      if (count % 10 === 0) {
        process.stdout.write(`  ${baseName}: ${count}/${snapshot.size} docs copied...\r`);
      }
    } catch (err) {
      console.error(`  ⚠ Failed to copy ${baseName}/${doc.id}: ${err.message}`);
      // Continue with remaining docs
    }
  }

  console.log(`  ${baseName}: ${count} documents → ${targetName}`);
  return count;
}

async function main() {
  console.log("=== Migrating current data to test_ collections ===\n");

  let totalMigrated = 0;

  for (const col of COLLECTIONS_TO_MIGRATE) {
    totalMigrated += await migrateCollection(col);
  }

  // Set app mode to "test" (so the app starts in test mode)
  await db.collection("settings").doc("appMode").set({
    mode: "test",
    switchedAt: admin.firestore.FieldValue.serverTimestamp(),
    switchedBy: "migration-script",
    migratedAt: new Date().toISOString(),
  });

  console.log(`\n=== Migration complete ===`);
  console.log(`  Total documents copied: ${totalMigrated}`);
  console.log(`  App mode set to: test`);
  console.log(`\n  Note: Original collections still have data.`);
  console.log(`  When you switch to "real mode", the original collections`);
  console.log(`  will be used (they contain the same data as before).`);
  console.log(`  You can clear them manually if you want real mode to start fresh.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
