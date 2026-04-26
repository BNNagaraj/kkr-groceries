"use client";

import { useState, useEffect, useCallback } from "react";
import { db, functions } from "@/lib/firebase";
import { getOtpAuth, isOtpConfigValid } from "@/lib/firebase-otp";
import { normalizeIndianPhone } from "@/lib/validation";
import { httpsCallable } from "firebase/functions";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  ConfirmationResult,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import type { Order } from "@/types/order";
import type { OtpChannelFlags } from "@/types/settings";
import { normalizeOtpChannels } from "@/types/settings";
import { useMode } from "@/contexts/ModeContext";

declare global {
  interface Window {
    otpRecaptchaVerifier?: RecaptchaVerifier;
  }
}

export interface UseDeliveryOTPOptions {
  /**
   * DOM element id for the invisible reCAPTCHA container — must exist in the DOM
   * outside of any conditionally-rendered dialog (so it survives open/close cycles).
   * Different consumers should use different ids if they can be mounted simultaneously.
   */
  recaptchaContainerId: string;

  /**
   * Called after successful OTP verification. Typically transitions the order to
   * "Fulfilled". Must throw on failure so the caller can keep the dialog open.
   */
  onVerified: (orderId: string) => void | Promise<void>;

  /** Optional log prefix to disambiguate which screen produced a console line. */
  logPrefix?: string;
}

export interface UseDeliveryOTPReturn {
  /** True when admin has configured `requireDeliveryOTP: true` in settings. */
  required: boolean;

  /** Resolved channel flags (legacy strings normalized to {email, sms, app}). */
  channels: OtpChannelFlags;

  /** Currently-open OTP dialog target, or null. */
  dialogOrder: Order | null;

  // Per-attempt state
  code: string;
  setCode: (code: string) => void;
  sending: boolean;
  sent: boolean;
  verifying: boolean;
  error: string;
  smsSent: boolean;
  emailSent: boolean;
  appSent: boolean;

  // Actions
  /** Open the OTP dialog for an order. Resets per-attempt state. */
  openDialog: (order: Order) => void;
  /** Close the dialog and clean up the reCAPTCHA verifier. */
  closeDialog: () => void;
  /** Dispatch the OTP via every enabled channel that has a target on the order. */
  send: () => Promise<void>;
  /** Verify the entered code. On success, calls `onVerified` and closes the dialog. */
  verify: () => Promise<void>;
}

function clearRecaptcha() {
  if (typeof window === "undefined") return;
  if (window.otpRecaptchaVerifier) {
    try {
      window.otpRecaptchaVerifier.clear();
    } catch {
      /* ignore */
    }
    window.otpRecaptchaVerifier = undefined;
  }
}

/**
 * Single source of truth for the delivery-OTP send/verify flow used by both
 * OrdersTab and CommandCenter. Owns settings load, dispatch dispatch, SMS
 * Firebase Phone Auth dance, and verification across all three channels
 * (email, SMS, customer app).
 *
 * Consumers render their own dialog UI bound to the returned state.
 */
export function useDeliveryOTP(options: UseDeliveryOTPOptions): UseDeliveryOTPReturn {
  const { recaptchaContainerId, onVerified, logPrefix = "[OTP]" } = options;
  const { col } = useMode();

  const [required, setRequired] = useState(false);
  const [channels, setChannels] = useState<OtpChannelFlags>({
    email: true,
    sms: false,
    app: false,
  });
  const [dialogOrder, setDialogOrder] = useState<Order | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [smsConfirmation, setSmsConfirmation] = useState<ConfirmationResult | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [appSent, setAppSent] = useState(false);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "checkout"));
        if (!cancelled && snap.exists()) {
          const data = snap.data();
          setRequired(data.requireDeliveryOTP === true);
          setChannels(normalizeOtpChannels(data.otpChannels));
        }
      } catch (e) {
        console.warn(`${logPrefix} Failed to load settings:`, e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logPrefix]);

  // Cleanup reCAPTCHA on unmount
  useEffect(() => {
    return clearRecaptcha;
  }, []);

  const resetAttempt = useCallback(() => {
    setCode("");
    setSent(false);
    setSmsSent(false);
    setEmailSent(false);
    setAppSent(false);
    setSmsConfirmation(null);
    setError("");
  }, []);

  const openDialog = useCallback(
    (order: Order) => {
      setDialogOrder(order);
      resetAttempt();
    },
    [resetAttempt]
  );

  const closeDialog = useCallback(() => {
    setDialogOrder(null);
    clearRecaptcha();
  }, []);

  const send = useCallback(async () => {
    if (!dialogOrder) return;
    setSending(true);
    setError("");

    const wantEmail = channels.email;
    const wantSms = channels.sms;
    const wantApp = channels.app;
    const hasEmail = !!dialogOrder.userEmail;
    const hasPhone = !!dialogOrder.phone;
    const hasApp = !!dialogOrder.userId;

    let okEmail = false;
    let okSms = false;
    let okApp = false;
    const errors: string[] = [];

    // 1. Email + App share one Cloud Function call (single OTP code in delivery_otps).
    if ((wantEmail && hasEmail) || (wantApp && hasApp)) {
      try {
        const sendFn = httpsCallable(functions, "sendDeliveryOTP");
        await sendFn({
          orderId: dialogOrder.id,
          orderCollection: col("orders"),
          channels: {
            email: wantEmail && hasEmail,
            app: wantApp && hasApp,
          },
        });
        if (wantEmail && hasEmail) okEmail = true;
        if (wantApp && hasApp) okApp = true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "OTP dispatch failed";
        if (wantEmail && hasEmail) errors.push(`Email: ${msg}`);
        if (wantApp && hasApp) errors.push(`App: ${msg}`);
      }
    }

    // 2. SMS via Firebase Phone Auth on the second project.
    if (wantSms && hasPhone) {
      try {
        if (!isOtpConfigValid()) {
          throw Object.assign(
            new Error(
              "OTP Firebase config missing. Rebuild with NEXT_PUBLIC_OTP_FIREBASE_* env vars."
            ),
            { code: "config/missing" }
          );
        }

        const cleanPhone = `+91${normalizeIndianPhone(dialogOrder.phone)}`;
        const otpAuthInstance = getOtpAuth();

        clearRecaptcha();

        const containerEl = document.getElementById(recaptchaContainerId);
        if (!containerEl) {
          throw Object.assign(new Error("reCAPTCHA container not found in DOM"), {
            code: "recaptcha/no-container",
          });
        }

        window.otpRecaptchaVerifier = new RecaptchaVerifier(
          otpAuthInstance,
          recaptchaContainerId,
          { size: "invisible" }
        );

        if (window.location.hostname !== "localhost") {
          await window.otpRecaptchaVerifier.render();
        }

        const confirmation = await signInWithPhoneNumber(
          otpAuthInstance,
          cleanPhone,
          window.otpRecaptchaVerifier
        );
        setSmsConfirmation(confirmation);
        okSms = true;
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        console.error(`${logPrefix} SMS error:`, e.code, e.message, err);
        clearRecaptcha();

        if (e.code === "auth/too-many-requests") {
          errors.push("SMS: Too many attempts. Wait a few minutes.");
        } else if (e.code === "auth/invalid-phone-number") {
          errors.push("SMS: Invalid phone number format.");
        } else if (
          e.code === "auth/unauthorized-domain" ||
          e.code === "auth/operation-not-allowed"
        ) {
          errors.push(
            `SMS: Domain not authorized. Add "${window.location.hostname}" to OTP project's Authorized Domains.`
          );
        } else if (e.code === "auth/internal-error" || e.code === "auth/captcha-check-failed") {
          errors.push(
            `SMS: reCAPTCHA failed. Ensure "${window.location.hostname}" is in OTP project's Authorized Domains.`
          );
        } else if (e.code === "config/missing") {
          errors.push(`SMS: ${e.message}`);
        } else {
          errors.push(`SMS: ${e.message || "Failed to send"} (${e.code || "unknown"})`);
        }
      }
    }

    setSmsSent(okSms);
    setEmailSent(okEmail);
    setAppSent(okApp);
    setSent(okEmail || okSms || okApp);

    if (okEmail || okSms || okApp) {
      const labels: string[] = [];
      if (okSms) labels.push("SMS");
      if (okEmail) labels.push("Email");
      if (okApp) labels.push("App");
      toast.success(`OTP sent via ${labels.join(" & ")}`);
    }

    if (errors.length > 0) {
      setError(errors.join("\n"));
      if (!okEmail && !okSms && !okApp) {
        toast.error("Failed to send OTP");
      }
    }

    setSending(false);
  }, [dialogOrder, channels, col, recaptchaContainerId, logPrefix]);

  const verify = useCallback(async () => {
    if (!dialogOrder || !code) return;
    setVerifying(true);
    setError("");

    let verified = false;

    // Try 1: SMS confirmation if SMS was sent
    if (smsConfirmation) {
      try {
        await smsConfirmation.confirm(code);
        try {
          await signOut(getOtpAuth());
        } catch {
          /* ignore — we just want the ghost session out */
        }
        verified = true;
      } catch {
        // SMS code didn't match — try email/app next
      }
    }

    // Try 2: Email/App verification via Cloud Function (shared OTP doc in delivery_otps)
    if (!verified && (emailSent || appSent)) {
      try {
        const verifyFn = httpsCallable(functions, "verifyDeliveryOTP");
        await verifyFn({ orderId: dialogOrder.id, otp: code });
        verified = true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Invalid OTP";
        if (!smsConfirmation) {
          setError(msg);
        }
      }
    }

    if (verified) {
      clearRecaptcha();
      toast.success("OTP verified — order fulfilled!");
      try {
        await onVerified(dialogOrder.id);
      } catch (e) {
        console.error(`${logPrefix} onVerified callback failed:`, e);
      }
      closeDialog();
    } else if (!error) {
      setError("Incorrect OTP. Please check the code and try again.");
    }

    setVerifying(false);
  }, [
    dialogOrder,
    code,
    smsConfirmation,
    emailSent,
    appSent,
    onVerified,
    closeDialog,
    error,
    logPrefix,
  ]);

  return {
    required,
    channels,
    dialogOrder,
    code,
    setCode,
    sending,
    sent,
    verifying,
    error,
    smsSent,
    emailSent,
    appSent,
    openDialog,
    closeDialog,
    send,
    verify,
  };
}
