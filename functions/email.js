/**
 * Email Cloud Functions.
 * - processMailQueue (Firestore trigger)
 * - testSmtpConfig
 * - getEmailStats
 * - getEmailLogs
 * - retryFailedEmail
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const {
  db, FieldValue,
  isRateLimited, requireAdmin,
  getSmtpConfig,
  emailLayout,
} = require("./utils");

/**
 * Trigger Email: watches the `mail` collection and sends emails via Gmail SMTP.
 * Documents must have: { to: string[], message: { subject, html } }
 * SMTP config is read from Firestore settings/smtp (admin-configurable).
 */
exports.processMailQueue = onDocumentCreated(
  { document: "mail/{mailId}", secrets: ["GMAIL_APP_PASSWORD"] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const mailDoc = snap.data();
    const { to, message } = mailDoc;

    if (!to || !Array.isArray(to) || to.length === 0 || !message) {
      console.error("Invalid mail document:", snap.id);
      await snap.ref.update({ status: "error", error: "Invalid mail document format" });
      return;
    }

    // Read SMTP config from Firestore (cached, fallback to env/defaults)
    const smtp = await getSmtpConfig();

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
    });

    try {
      const mailOptions = {
        from: `${smtp.fromName} <${smtp.user}>`,
        to: to.join(", "),
        subject: message.subject,
        html: message.html,
      };
      // Attach PDF files if present in the mail document
      if (mailDoc.attachments && Array.isArray(mailDoc.attachments)) {
        mailOptions.attachments = mailDoc.attachments.map((att) => ({
          filename: att.filename,
          content: Buffer.from(att.content, "base64"),
          contentType: att.contentType || "application/pdf",
        }));
      }
      await transporter.sendMail(mailOptions);

      await snap.ref.update({
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
        smtpUser: smtp.user,
      });
      console.log(`Email sent to ${to.join(", ")} \u2014 subject: ${message.subject}${mailOptions.attachments ? ` (${mailOptions.attachments.length} attachment(s))` : ""}`);
    } catch (err) {
      console.error("Email send failed:", err);
      let errorCategory = "unknown";
      if (err.code === "EAUTH") errorCategory = "auth";
      else if (err.code === "ECONNECTION" || err.code === "ESOCKET") errorCategory = "connection";
      else if (err.code === "EENVELOPE") errorCategory = "recipient";
      else if (err.message?.includes("rate")) errorCategory = "rate_limit";

      await snap.ref.update({
        status: "error",
        error: err.message,
        errorCategory,
        processedAt: FieldValue.serverTimestamp(),
        smtpUser: smtp.user,
        attempts: FieldValue.increment(1),
      });
    }
  }
);

/**
 * Test SMTP configuration by sending a test email.
 * Reads settings/smtp from Firestore and verifies credentials work.
 */
exports.testSmtpConfig = onCall({ secrets: ["GMAIL_APP_PASSWORD"] }, async (request) => {
  try {
    const caller = await requireAdmin(request);
    if (await isRateLimited(caller.uid, "testSmtp", 5, 10 * 60 * 1000)) {
      throw new HttpsError("resource-exhausted", "Too many test emails. Please wait.");
    }

    const { testEmail, recipients } = request.data || {};

    // Read SMTP config from Firestore
    const smtp = await getSmtpConfig();

    console.log(`[SMTP-DEBUG] user="${smtp.user}", passLen=${smtp.password?.length || 0}, host=${smtp.host}, port=${smtp.port}, secure=${smtp.secure}`);

    if (!smtp.user || !smtp.password) {
      throw new HttpsError("failed-precondition", "SMTP credentials not configured. Save Gmail address and App Password first.");
    }

    // Support single testEmail, array of recipients, or default to smtp.user
    const recipientList = recipients && Array.isArray(recipients) && recipients.length > 0
      ? recipients
      : (testEmail ? [testEmail] : [smtp.user]);
    const recipient = recipientList.join(", ");

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
    });

    await transporter.sendMail({
      from: `${smtp.fromName} <${smtp.user}>`,
      to: recipient,
      subject: "\u2705 KKR Groceries \u2014 SMTP Test Successful",
      html: emailLayout(
        `<div style="padding:28px 24px;text-align:center;">
          <div style="width:64px;height:64px;background:#f0fdf4;border-radius:50%;line-height:64px;font-size:28px;margin:0 auto 16px;">\u2705</div>
          <h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 8px;">SMTP Configuration Working!</h2>
          <p style="color:#64748b;font-size:14px;margin:0;">Email notifications are properly configured and operational.</p>
          <div style="margin-top:16px;padding:12px 20px;background:#f8fafc;border-radius:10px;display:inline-block;">
            <span style="color:#94a3b8;font-size:12px;">Sender:</span>
            <span style="color:#047857;font-size:13px;font-weight:600;margin-left:4px;">${smtp.user}</span>
          </div>
        </div>`,
        "SMTP test successful"
      ),
    });

    console.log(`SMTP test email sent to ${recipient} by ${caller.uid}`);
    return { success: true, message: `Test email sent to ${recipient}` };

  } catch (error) {
    console.error("SMTP test failed:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `SMTP test failed: ${error.message}`);
  }
});

/**
 * Get aggregated email statistics from the mail collection.
 * Returns counts by status + recent failures for the Activity dashboard.
 */
exports.getEmailStats = onCall(async (request) => {
  await requireAdmin(request);

  const mailRef = db.collection("mail");
  const [sentSnap, errorSnap, retriedSnap, totalSnap] = await Promise.all([
    mailRef.where("status", "==", "sent").count().get(),
    mailRef.where("status", "==", "error").count().get(),
    mailRef.where("status", "==", "retried").count().get(),
    mailRef.count().get(),
  ]);

  const total = totalSnap.data().count;
  const sent = sentSnap.data().count;
  const errors = errorSnap.data().count;
  const retried = retriedSnap.data().count;
  const pending = total - sent - errors - retried;

  // Recent failures (last 10)
  const failedSnap = await mailRef
    .where("status", "==", "error")
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  const recentFailures = failedSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      to: data.to || [],
      subject: data.message?.subject || "(no subject)",
      error: data.error || "Unknown error",
      errorCategory: data.errorCategory || "unknown",
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      attempts: data.attempts || 1,
    };
  });

  return { total, sent, errors, pending, retried, recentFailures };
});

/**
 * Get paginated email logs from the mail collection.
 * Supports status filtering and cursor-based pagination.
 */
exports.getEmailLogs = onCall(async (request) => {
  await requireAdmin(request);
  const { statusFilter, limit: pageSize = 25, startAfterId } = request.data || {};

  let q = db.collection("mail").orderBy("createdAt", "desc");
  if (statusFilter && statusFilter !== "all") {
    q = q.where("status", "==", statusFilter);
  }
  if (startAfterId) {
    const startDoc = await db.collection("mail").doc(startAfterId).get();
    if (startDoc.exists) q = q.startAfter(startDoc);
  }
  q = q.limit(Math.min(pageSize, 50)); // cap at 50

  const snap = await q.get();
  return {
    logs: snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        to: data.to || [],
        subject: data.message?.subject || "(no subject)",
        status: data.status || "pending",
        error: data.error,
        errorCategory: data.errorCategory,
        smtpUser: data.smtpUser,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        sentAt: data.sentAt?.toDate?.()?.toISOString() || null,
        attempts: data.attempts || 0,
        retriedFrom: data.retriedFrom || null,
      };
    }),
    hasMore: snap.docs.length === Math.min(pageSize, 50),
  };
});

/**
 * Retry a failed email by creating a new mail doc with the same content.
 * Marks original as "retried" and creates fresh doc to trigger processMailQueue.
 */
exports.retryFailedEmail = onCall(async (request) => {
  await requireAdmin(request);
  const { mailId } = request.data || {};
  if (!mailId) throw new HttpsError("invalid-argument", "mailId is required");

  const mailDoc = await db.collection("mail").doc(mailId).get();
  if (!mailDoc.exists) throw new HttpsError("not-found", "Mail document not found");

  const data = mailDoc.data();
  if (data.status !== "error") {
    throw new HttpsError("failed-precondition", "Only failed emails can be retried");
  }

  // Create new mail doc with same content (triggers processMailQueue)
  const newDoc = await db.collection("mail").add({
    to: data.to,
    message: data.message,
    createdAt: FieldValue.serverTimestamp(),
    retriedFrom: mailId,
  });

  // Mark original as retried
  await mailDoc.ref.update({ status: "retried", retriedAs: newDoc.id });

  console.log(`Retried mail ${mailId} as ${newDoc.id}`);
  return { success: true, newMailId: newDoc.id };
});
