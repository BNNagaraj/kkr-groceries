# Operations Runbook

## Deploy

**Hosting** (web app) — auto-deploys on every push to `main` via
[firebase-hosting-merge.yml](.github/workflows/firebase-hosting-merge.yml).

**Cloud Functions** — auto-deploy on push to `main` when files under
`functions/**` change, via
[firebase-functions-deploy.yml](.github/workflows/firebase-functions-deploy.yml).

Manual deploy if needed:
```bash
FUNCTIONS_DISCOVERY_TIMEOUT=60 npx firebase-tools deploy --only functions
# Single function:
FUNCTIONS_DISCOVERY_TIMEOUT=60 npx firebase-tools deploy --only functions:sendDeliveryOTP
```

The `FUNCTIONS_DISCOVERY_TIMEOUT=60` env var is required — local module
load time is ~6.7s, near the 10s default. The timeout is also baked
into the GH Actions workflow.

## Rollback

**Hosting** — revert to a previous deploy via Firebase Console
(Hosting → Versions → pick → "Rollback") or:
```bash
npx firebase-tools hosting:clone kkr-groceries-02:live kkr-groceries-02:live --version <PREVIOUS_VERSION>
```

**Cloud Functions** — revert the commit on `main` and let the
auto-deploy roll the function back. There is no built-in version
history for Functions; the source of truth is git.

**Firestore data** — point-in-time recovery (PITR) is enabled in the
default database. Export a snapshot before any destructive migration:
```bash
gcloud firestore export gs://kkr-groceries-02-backups/$(date +%F)
```

## Firestore housekeeping

### TTL policies

Set up TTL on collections that accumulate stale docs forever:

| Collection | Field | Console: Firestore → Indexes → TTL |
|---|---|---|
| `delivery_otps` | `expiresAt` | Add policy. Enabled. |
| `test_delivery_otps` | `expiresAt` | Same. |
| `deliveryTracking` | `expiresAt` | Already cleaned by `cleanupExpiredTracking` scheduled function — TTL is belt + suspenders. |

Without TTL, `delivery_otps` grows ~1 doc per OTP send forever.

### Test mode

Collections are namespaced (`orders` vs `test_orders`) — admin can
flip mode via the toggle in the dashboard header. Always reset to
"real" mode before handing the device to anyone else.

## Secrets

| Secret | Where | Used by |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KKR_GROCERIES_02` | GitHub Actions secrets | Both workflow files |
| `NEXT_PUBLIC_OTP_FIREBASE_*` | `web/.env.local` (build-time) | OTP SMS via Phone Auth |
| Firebase API key (main) | `web/.env.local` | Web app runtime |

`.env.local` is gitignored. Source of truth for env vars is the local
file on the build machine. If a `NEXT_PUBLIC_OTP_FIREBASE_*` var is
missing, the OTP SMS flow silently falls back to email-only — the app
will display a yellow banner to admins flagging this.

## Known gotchas

- **Pre-commit safety**: `web/out/` is the production build dir. If
  the dev server is running, never run `npx next build` in parallel —
  it clobbers the Turbopack dev cache. Stop dev, build, restart dev.
- **Two Firebase projects**: main = `kkr-groceries-02`, OTP =
  `kkr-groceries-02-otp`. The OTP project exists only to isolate
  Phone Auth ghost UIDs from real users.
- **OTP env var check**: see `isOtpConfigValid()` in
  [firebase-otp.ts](web/src/lib/firebase-otp.ts) — Header surfaces a
  warning banner if false.
