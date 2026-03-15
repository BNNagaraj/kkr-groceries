/**
 * Price Alert Checker — Cloud Function
 *
 * Runs every 4 hours to check if any commodity prices have crossed
 * user-defined alert thresholds, and sends FCM notifications.
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const db = getFirestore();

/**
 * priceAlertChecker — Scheduled Cloud Function
 *
 * Every 4 hours:
 *  1. Read fresh APMC cache from settings/apmc_cache
 *  2. Read all active alerts from user_alerts collection group
 *  3. Check if commodity price crosses threshold
 *  4. Send FCM notification for triggered alerts
 *  5. Update lastTriggered timestamp
 */
exports.priceAlertChecker = onSchedule(
  {
    schedule: "every 4 hours",
    region: "asia-south1",
    memory: "256MiB",
  },
  async () => {
    // 1. Read current APMC cache
    const cacheSnap = await db.doc("settings/apmc_cache").get();
    if (!cacheSnap.exists || !cacheSnap.data().records?.length) {
      console.log("No APMC cache available, skipping alert check.");
      return;
    }

    const records = cacheSnap.data().records;

    // Build a lookup: commodity (lowercase) -> record with modal price
    const priceLookup = {};
    for (const r of records) {
      const key = (r.commodity || "").toLowerCase().trim();
      if (!key) continue;
      // Keep the record with the latest data or highest modal price per commodity
      if (!priceLookup[key] || r.modalPrice > priceLookup[key].modalPrice) {
        priceLookup[key] = r;
      }
    }

    // 2. Read all active alerts via collection group query
    const alertsSnap = await db
      .collectionGroup("user_alerts")
      .where("active", "==", true)
      .get();

    if (alertsSnap.empty) {
      console.log("No active alerts found.");
      return;
    }

    console.log(`Checking ${alertsSnap.size} active alerts against ${Object.keys(priceLookup).length} commodities.`);

    const messaging = getMessaging();
    let triggered = 0;
    let notified = 0;

    // 3. Check each alert
    const batch = db.batch();
    const notifications = [];

    for (const alertDoc of alertsSnap.docs) {
      const alert = alertDoc.data();
      const commodity = (alert.commodity || "").toLowerCase().trim();
      const priceRecord = priceLookup[commodity];

      if (!priceRecord) continue; // commodity not in current cache

      const currentPrice = priceRecord.modalPrice;
      const threshold = Number(alert.threshold);
      const direction = alert.direction || "below"; // "below" or "above"

      if (isNaN(threshold) || isNaN(currentPrice)) continue;

      let shouldTrigger = false;
      if (direction === "below" && currentPrice <= threshold) {
        shouldTrigger = true;
      } else if (direction === "above" && currentPrice >= threshold) {
        shouldTrigger = true;
      }

      if (!shouldTrigger) continue;

      triggered++;

      // Update lastTriggered
      batch.update(alertDoc.ref, {
        lastTriggered: FieldValue.serverTimestamp(),
      });

      // Queue FCM notification if user has an FCM token
      if (alert.fcmToken) {
        const priceDir = direction === "below" ? "dropped to" : "risen to";
        notifications.push(
          messaging
            .send({
              token: alert.fcmToken,
              notification: {
                title: `Price Alert: ${priceRecord.commodity}`,
                body: `${priceRecord.commodity} has ${priceDir} Rs ${currentPrice}/kg (threshold: Rs ${threshold}/kg) at ${priceRecord.market || "APMC"}.`,
              },
              data: {
                type: "price_alert",
                commodity: priceRecord.commodity,
                currentPrice: String(currentPrice),
                threshold: String(threshold),
                market: priceRecord.market || "",
              },
            })
            .then(() => {
              notified++;
            })
            .catch((e) => {
              console.warn(`FCM send failed for ${alertDoc.id}:`, e.message);
            })
        );
      }
    }

    // Commit batch updates
    if (triggered > 0) {
      await batch.commit();
    }

    // Send all notifications
    if (notifications.length > 0) {
      await Promise.allSettled(notifications);
    }

    console.log(`Alert check complete: ${triggered} triggered, ${notified} notifications sent.`);
  }
);
