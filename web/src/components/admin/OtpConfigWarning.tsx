"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isOtpConfigValid } from "@/lib/firebase-otp";
import { AlertTriangle, X } from "lucide-react";

/**
 * Yellow banner shown to admins when the OTP Firebase project's env vars are
 * missing or incomplete. Without these, "SMS" and "Customer App" delivery OTP
 * channels silently fall back to email-only.
 *
 * Lives in the Header — visible globally so admins notice immediately after
 * an env-var change or fresh deploy. Buyers never see it.
 *
 * Set the missing vars in `web/.env.local` and rebuild:
 *   NEXT_PUBLIC_OTP_FIREBASE_API_KEY=...
 *   NEXT_PUBLIC_OTP_FIREBASE_AUTH_DOMAIN=...
 *   NEXT_PUBLIC_OTP_FIREBASE_PROJECT_ID=...
 *   NEXT_PUBLIC_OTP_FIREBASE_APP_ID=...
 */
export function OtpConfigWarning() {
  const { isAdmin } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!isAdmin || dismissed || isOtpConfigValid()) return null;

  return (
    <div
      role="alert"
      className="fixed top-[70px] left-0 right-0 z-40 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-3 text-amber-900 text-sm"
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">OTP misconfigured:</span>{" "}
        <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[12px]">
          NEXT_PUBLIC_OTP_FIREBASE_*
        </code>{" "}
        env vars are missing. SMS &amp; Customer App OTP channels will fall back to email only.
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="w-6 h-6 rounded hover:bg-amber-100 flex items-center justify-center shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
