/**
 * Scheduled Firestore backup.
 * Exports the whole (default) Firestore database to a Cloud Storage bucket
 * every night. Combined with Point-in-Time Recovery (enabled in the console),
 * this gives both daily snapshots and 7-day rollback.
 *
 * One-time setup required (see handoff notes):
 *   1. Create a bucket:  gs://<projectId>-firestore-backups
 *   2. Grant the functions runtime service account:
 *        - roles/datastore.importExportAdmin
 *        - Storage Object Admin on that bucket
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const firestoreAdmin = require("@google-cloud/firestore").v1;

const client = new firestoreAdmin.FirestoreAdminClient();

exports.scheduledFirestoreBackup = onSchedule(
  { schedule: "every day 02:00", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    const projectId =
      process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID;
    if (!projectId) {
      console.error("[backup] No project id in env — skipping.");
      return;
    }

    const bucket = `gs://${projectId}-firestore-backups`;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const databaseName = client.databasePath(projectId, "(default)");

    try {
      const [operation] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: `${bucket}/${stamp}`,
        collectionIds: [], // empty = all collections
      });
      console.log(`[backup] Export started → ${bucket}/${stamp} (op: ${operation.name})`);
    } catch (err) {
      console.error("[backup] Export failed:", err.message);
      throw err;
    }
  }
);
