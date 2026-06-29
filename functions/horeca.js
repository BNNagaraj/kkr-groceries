/**
 * HORECA (Hotel/Restaurant/Catering) request Cloud Functions.
 * - onHorecaRequestCreated: Firestore trigger — emails admins on new request
 * - approveHorecaRequest: Callable — approves request, auto-grants claim if phone matches
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const functionsV1 = require("firebase-functions/v1");
const {
  db, FieldValue, getAuth,
  requireAdmin, isRateLimited,
  getNotificationEmails,
  emailLayout, getBusinessTagline,
} = require("./utils");

/** Normalise any phone string to the bare 10-digit Indian number (drops +91 / spaces). */
function last10Digits(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Find the Firebase Auth user a HORECA request refers to, trying the most
 * reliable signal first:
 *   1. requesterUid  — captured when the applicant was logged in (exact match)
 *   2. email / requesterEmail — for email/Google sign-in accounts
 *   3. phone (+91XXXXXXXXXX) — for phone-OTP accounts
 * Returns the UserRecord, or null if no account exists yet.
 */
async function findUserForRequest(reqData) {
  const auth = getAuth();

  // 1. Direct UID
  if (reqData.requesterUid) {
    try {
      return await auth.getUser(reqData.requesterUid);
    } catch (e) {
      if (e.code !== "auth/user-not-found") console.warn("UID lookup error:", e.message);
    }
  }

  // 2. Email (typed email field or the logged-in account's email)
  const email = (reqData.email || reqData.requesterEmail || "").trim().toLowerCase();
  if (email) {
    try {
      return await auth.getUserByEmail(email);
    } catch (e) {
      if (e.code !== "auth/user-not-found") console.warn("Email lookup error:", e.message);
    }
  }

  // 3. Phone
  const phone = last10Digits(reqData.phone);
  if (phone.length === 10) {
    try {
      return await auth.getUserByPhoneNumber(`+91${phone}`);
    } catch (e) {
      if (e.code !== "auth/user-not-found") console.warn("Phone lookup error:", e.message);
    }
  }

  return null;
}

/**
 * Firestore trigger: when a HORECA request becomes "pending" — either a brand
 * new submission OR a re-application after a previous rejection — queue an email
 * notification to all admin notification emails. Uses onDocumentWritten so that
 * re-submissions (which are updates, since the doc id is the applicant's uid)
 * are notified too. Approve/reject updates are ignored.
 */
exports.onHorecaRequestCreated = onDocumentCreated(
  { document: "horeca_requests/{requestId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (data.status !== "pending") return; // only notify on pending
    await queueHorecaNotification(data);
  }
);

/**
 * Build + queue the admin notification email for a HORECA application.
 * Shared by the create trigger and the re-submission callable.
 * @param {object} data — the horeca_request document data
 * @param {boolean} isResubmission — tweaks the heading for re-applications
 */
async function queueHorecaNotification(data, isResubmission = false) {
    const { contactName, businessName, businessType, phone, location, pincode, schedule, dailyVolume, notes } = data;
    const heading = isResubmission ? "🔁 HORECA Re-application" : "🏨 New HORECA Application";
    const intro = isResubmission
      ? "A previously-reviewed restaurant/hotel has re-applied for economy bulk pricing access."
      : "A new restaurant/hotel has applied for economy bulk pricing access.";

    // Build notification email
    const body = `
    <div style="padding:28px 24px 20px;">
      <h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 8px;">
        ${heading}
      </h2>
      <p style="color:#64748b;font-size:14px;margin:0;">
        ${intro}
      </p>
    </div>

    <div style="background:#faf5ff;padding:14px 24px;border-top:1px solid #e9d5ff;border-bottom:1px solid #e9d5ff;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <span style="color:#7c3aed;font-size:12px;font-weight:600;">BUSINESS</span><br>
          <span style="color:#1e293b;font-size:16px;font-weight:700;">${businessName || "—"}</span>
        </td>
        <td align="right">
          <span style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">${businessType || "Restaurant"}</span>
        </td>
      </tr></table>
    </div>

    <div style="padding:20px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;">
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" width="36" valign="top">👤</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
            <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Contact</div>
            <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${contactName || "—"}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" valign="top">📱</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
            <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Phone</div>
            <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${phone || "—"}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" valign="top">📍</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
            <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Location</div>
            <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${location || "—"}, ${pincode || "—"}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;" valign="top">📅</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
            <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Schedule</div>
            <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${schedule || "Daily"}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 16px;${notes ? "border-bottom:1px solid #e2e8f0;" : ""}" valign="top">⚖️</td>
          <td style="padding:10px 16px;${notes ? "border-bottom:1px solid #e2e8f0;" : ""}">
            <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Est. Daily Volume</div>
            <div style="color:#1e293b;font-size:14px;font-weight:600;margin-top:2px;">${dailyVolume || "—"}</div>
          </td>
        </tr>
        ${notes ? `<tr>
          <td style="padding:10px 16px;" valign="top">📝</td>
          <td style="padding:10px 16px;">
            <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Notes</div>
            <div style="color:#1e293b;font-size:14px;margin-top:2px;">${notes}</div>
          </td>
        </tr>` : ""}
      </table>
    </div>

    <div style="padding:0 24px 28px;text-align:center;">
      <a href="https://kkr-groceries-02.web.app/dashboard/admin" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;text-decoration:none;">Review in Admin Dashboard →</a>
    </div>`;

    await getBusinessTagline();
    const subjectPrefix = isResubmission ? "🔁 HORECA Re-application" : "🏨 New HORECA Request";
    const html = emailLayout(body, `${isResubmission ? "Re-application" : "New HORECA application"} from ${businessName}`);

    try {
      const notifyEmails = await getNotificationEmails();
      await db.collection("mail").add({
        to: notifyEmails,
        message: {
          subject: `${subjectPrefix} — ${businessName} (${businessType})`,
          html,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log(`HORECA notification queued for ${notifyEmails.join(", ")}`);
    } catch (err) {
      console.error("Failed to queue HORECA notification email:", err);
    }
}

/**
 * Notify admins that an applicant has RE-applied (after a prior rejection).
 * Re-applications are document updates, which the onDocumentCreated trigger
 * does not fire on — so the client calls this explicitly after re-submitting.
 */
exports.notifyHorecaResubmission = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const { requestId } = request.data || {};
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required.");

  // Only the applicant (doc id == uid) or an admin may trigger this
  let isAdminCaller = false;
  try { await requireAdmin(request); isAdminCaller = true; } catch (_) { /* not admin */ }
  if (!isAdminCaller && request.auth.uid !== requestId) {
    throw new HttpsError("permission-denied", "Not allowed.");
  }
  if (await isRateLimited(request.auth.uid, "notifyHorecaResubmission", 5, 60 * 60 * 1000)) {
    throw new HttpsError("resource-exhausted", "Too many requests.");
  }

  const snap = await db.collection("horeca_requests").doc(requestId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Request not found.");
  const data = snap.data();
  if (data.status !== "pending") return { success: true, skipped: true };

  await queueHorecaNotification(data, true);
  return { success: true };
});

/**
 * Approve a HORECA request (admin-only).
 * - Updates request status to "approved"
 * - Looks up phone in Firebase Auth to find matching user
 * - If match found, auto-grants horeca:true custom claim
 */
exports.approveHorecaRequest = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "approveHorecaRequest", 20, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { requestId } = request.data;
    if (!requestId) {
      throw new HttpsError("invalid-argument", "requestId is required.");
    }

    // Read the request document
    const reqRef = db.collection("horeca_requests").doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      throw new HttpsError("not-found", "HORECA request not found.");
    }

    const reqData = reqSnap.data();
    if (reqData.status !== "pending") {
      throw new HttpsError("failed-precondition", `Request is already ${reqData.status}.`);
    }

    // Try to find a Firebase Auth user by UID → email → phone
    let matchedUid = null;
    const user = await findUserForRequest(reqData);
    if (user) {
      matchedUid = user.uid;
      const existingClaims = user.customClaims || {};
      await getAuth().setCustomUserClaims(user.uid, { ...existingClaims, horeca: true });
      console.log(`HORECA claim auto-granted to user ${user.uid} (${user.email || user.phoneNumber || ""})`);
    }

    // Update the request document
    await reqRef.update({
      status: "approved",
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: caller.uid,
      ...(matchedUid ? { matchedUid } : {}),
    });

    console.log(`HORECA request ${requestId} approved by ${caller.uid}. Matched UID: ${matchedUid || "none"}`);

    return {
      success: true,
      message: matchedUid
        ? `Approved and HORECA access auto-granted to existing user.`
        : `Approved. HORECA access will be granted automatically when this applicant registers.`,
      matchedUid: matchedUid || null,
    };
  } catch (error) {
    console.error("Error in approveHorecaRequest:", error);
    throw new HttpsError(
      error.code || "internal",
      error.message || "Failed to approve HORECA request"
    );
  }
});

/**
 * Sync / repair HORECA claims (admin-only).
 *
 * Walks every approved horeca_request, finds the matching registered user by
 * phone, and grants horeca:true to anyone who is missing it. This self-heals
 * accounts that were approved before they registered, or where the claim was
 * never applied for any reason. Returns a per-account report.
 *
 * Safe to run repeatedly — it only writes when a claim is actually missing.
 */
exports.syncHorecaClaims = onCall(async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "syncHorecaClaims", 10, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const approvedSnap = await db
      .collection("horeca_requests")
      .where("status", "==", "approved")
      .get();

    const report = {
      checked: 0,
      granted: 0,
      alreadyHad: 0,
      notRegistered: 0,
      details: [],
    };

    for (const docSnap of approvedSnap.docs) {
      const d = docSnap.data();
      report.checked += 1;
      const label = d.email || (last10Digits(d.phone) ? `+91${last10Digits(d.phone)}` : d.businessName);
      try {
        const user = await findUserForRequest(d);
        if (!user) {
          report.notRegistered += 1;
          report.details.push({ business: d.businessName, who: label, status: "not-registered" });
          continue;
        }
        const existingClaims = user.customClaims || {};
        if (existingClaims.horeca === true) {
          report.alreadyHad += 1;
          report.details.push({ business: d.businessName, who: user.email || user.phoneNumber, status: "already-granted", uid: user.uid });
        } else {
          await getAuth().setCustomUserClaims(user.uid, { ...existingClaims, horeca: true });
          if (!d.matchedUid) {
            await docSnap.ref.update({ matchedUid: user.uid });
          }
          report.granted += 1;
          report.details.push({ business: d.businessName, who: user.email || user.phoneNumber, status: "granted", uid: user.uid });
          console.log(`syncHorecaClaims: granted horeca:true to ${user.uid} (${user.email || user.phoneNumber})`);
        }
      } catch (err) {
        report.details.push({ business: d.businessName, who: label, status: `error: ${err.message}` });
      }
    }

    console.log(`syncHorecaClaims by ${caller.uid}: checked=${report.checked} granted=${report.granted} alreadyHad=${report.alreadyHad} notRegistered=${report.notRegistered}`);
    return { success: true, ...report };
  } catch (error) {
    console.error("Error in syncHorecaClaims:", error);
    throw new HttpsError(error.code || "internal", error.message || "Failed to sync HORECA claims");
  }
});

/**
 * Auth onCreate back-fill: when a brand-new user registers (typically via phone
 * OTP), check whether their phone number has an approved HORECA request. If so,
 * grant the horeca:true claim immediately so they never have to wait for a
 * manual re-approval.
 *
 * This closes the gap where a request is approved BEFORE the applicant has an
 * account — previously the claim was never applied when they later signed in.
 */
exports.onUserRegisteredGrantHoreca = functionsV1.auth.user().onCreate(async (user) => {
  const phone = last10Digits(user.phoneNumber);
  const email = (user.email || "").trim().toLowerCase();
  if (phone.length !== 10 && !email) return;

  try {
    // Look for an approved request matching this account by email first, then phone.
    let match = null;
    if (email) {
      const byEmail = await db
        .collection("horeca_requests")
        .where("email", "==", email)
        .where("status", "==", "approved")
        .limit(1)
        .get();
      if (!byEmail.empty) match = byEmail.docs[0];
    }
    if (!match && phone.length === 10) {
      const byPhone = await db
        .collection("horeca_requests")
        .where("phone", "==", phone)
        .where("status", "==", "approved")
        .limit(1)
        .get();
      if (!byPhone.empty) match = byPhone.docs[0];
    }
    if (!match) return;

    const existingClaims = user.customClaims || {};
    if (existingClaims.horeca === true) return;

    await getAuth().setCustomUserClaims(user.uid, { ...existingClaims, horeca: true });
    await match.ref.update({ matchedUid: user.uid });
    console.log(`onUserRegisteredGrantHoreca: granted horeca:true to new user ${user.uid} (${email || "+91" + phone})`);
  } catch (err) {
    console.error("onUserRegisteredGrantHoreca failed:", err.message);
  }
});
