/**
 * One-off audit: verify HORECA custom claims.
 * - Looks up a specific phone number (passed as arg, default 9014628961)
 * - Lists ALL users that currently have horeca:true
 * - Cross-checks against approved horeca_requests to flag any approved
 *   request whose matched user is missing the claim.
 *
 * Run:  node scripts/check-horeca.js [phone]
 */
const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "..", "..", "serviceAccountkey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

async function main() {
  const phoneArg = (process.argv[2] || "9014628961").replace(/\D/g, "");
  const fullPhone = phoneArg.startsWith("91") && phoneArg.length === 12
    ? `+${phoneArg}`
    : `+91${phoneArg}`;

  console.log("=".repeat(60));
  console.log(`1) Checking specific account: ${fullPhone}`);
  console.log("=".repeat(60));
  try {
    const user = await auth.getUserByPhoneNumber(fullPhone);
    const claims = user.customClaims || {};
    console.log(`   UID:        ${user.uid}`);
    console.log(`   Phone:      ${user.phoneNumber}`);
    console.log(`   Email:      ${user.email || "(none)"}`);
    console.log(`   Claims:     ${JSON.stringify(claims)}`);
    console.log(`   horeca:     ${claims.horeca === true ? "✅ GRANTED" : "❌ NOT SET"}`);

    if (claims.horeca !== true) {
      console.log("\n   ⚠ Claim missing — granting it now...");
      await auth.setCustomUserClaims(user.uid, { ...claims, horeca: true });
      console.log("   ✅ horeca:true has been set. User must reload the app.");
    }
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.log(`   ❌ No Firebase Auth user registered with ${fullPhone}.`);
      console.log("      The user must sign in once with this phone number first.");
    } else {
      console.log(`   Error: ${err.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("2) All users with horeca:true");
  console.log("=".repeat(60));
  const horecaUsers = [];
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    res.users.forEach((u) => {
      if (u.customClaims && u.customClaims.horeca === true) {
        horecaUsers.push(u);
      }
    });
    pageToken = res.pageToken;
  } while (pageToken);

  if (horecaUsers.length === 0) {
    console.log("   (none)");
  } else {
    horecaUsers.forEach((u) => {
      console.log(`   ✅ ${u.phoneNumber || u.email || u.uid}  (uid: ${u.uid})`);
    });
  }
  console.log(`   Total HORECA users: ${horecaUsers.length}`);

  console.log("\n" + "=".repeat(60));
  console.log("3) Approved horeca_requests vs. actual claims");
  console.log("=".repeat(60));
  const approvedSnap = await db
    .collection("horeca_requests")
    .where("status", "==", "approved")
    .get();

  if (approvedSnap.empty) {
    console.log("   (no approved requests)");
  } else {
    let fixedCount = 0;
    for (const docSnap of approvedSnap.docs) {
      const d = docSnap.data();
      const phone = (d.phone || "").replace(/\D/g, "");
      const full = `+91${phone}`;
      let status;
      let userToFix = null;
      try {
        const u = await auth.getUserByPhoneNumber(full);
        const has = u.customClaims && u.customClaims.horeca === true;
        status = has ? "✅ claim present" : "❌ APPROVED but claim MISSING";
        if (!has) userToFix = u;
      } catch (e) {
        status = e.code === "auth/user-not-found"
          ? "⏳ not registered yet"
          : `error: ${e.message}`;
      }
      console.log(`   ${d.businessName || "(no name)"} — ${full}: ${status}`);

      // Self-heal: grant the claim to any approved user that's missing it
      if (userToFix) {
        await auth.setCustomUserClaims(userToFix.uid, {
          ...(userToFix.customClaims || {}),
          horeca: true,
        });
        console.log(`      → 🔧 Granted horeca:true to ${userToFix.uid}`);
        fixedCount++;
      }
    }
    if (fixedCount > 0) {
      console.log(`\n   🔧 Fixed ${fixedCount} account(s) that were approved but missing the claim.`);
    }
  }

  console.log("\nDone. Any affected users should reload the app to pick up the claim.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});
