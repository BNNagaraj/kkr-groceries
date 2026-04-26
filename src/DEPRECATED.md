# DEPRECATED — do not modify

This `/src` folder is the **legacy vanilla-JS app** (pre-Next.js).

The current production app lives in `/web` (Next.js + Firebase). All new
features, bug fixes, and UI work go there.

## Why this folder still exists

Some files are referenced by `src/services/notifications.js` (FCM push
infrastructure that the old app exercised). The notification Cloud Functions
were extracted to `/functions` and remain in use; the client-side scaffold
here is a historical reference only.

## Plan

Delete this folder once `/web` covers every flow that ran in the old app
and we've confirmed no Cloud Function or external integration depends on
anything inside `/src`. Until then, treat it as read-only.

If you find yourself wanting to edit a file in here, **stop** — the
correct place is almost certainly somewhere under `/web/src`.
