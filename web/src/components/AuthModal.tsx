"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"choose" | "phone" | "otp">("choose");
  const [phone, setPhone] = useState("+91 ");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    };
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMode("choose");
      setPhone("+91 ");
      setOtp("");
      setLoading(false);
      confirmationRef.current = null;
    }
  }, [isOpen]);

  const handleGoogleSignIn = useCallback(async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Signed in successfully!");
      onClose();
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === "auth/popup-closed-by-user") {
        // User closed popup — not an error
        return;
      }
      if (error.code === "auth/popup-blocked") {
        toast.error("Popup blocked", {
          description: "Please allow popups for this site and try again.",
        });
        return;
      }
      console.error("[Auth] Google sign-in failed:", error.code, error.message);
      toast.error("Sign-in failed", {
        description: error.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [onClose]);

  const handleSendOtp = useCallback(async () => {
    const cleanPhone = phone.replace(/\s/g, "");
    if (!/^\+91\d{10}$/.test(cleanPhone)) {
      toast.error("Please enter a valid 10-digit Indian phone number.");
      return;
    }

    setLoading(true);
    try {
      // Setup invisible recaptcha
      if (!window.recaptchaVerifier && recaptchaContainerRef.current) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          size: "invisible",
        });
      }

      const appVerifier = window.recaptchaVerifier!;
      const confirmation = await signInWithPhoneNumber(auth, cleanPhone, appVerifier);
      confirmationRef.current = confirmation;
      setMode("otp");
      toast.success("OTP sent!", {
        description: `Verification code sent to ${cleanPhone}`,
      });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error("[Auth] Phone OTP failed:", error.code, error.message);

      // Clear recaptcha on failure so it can be recreated
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }

      if (error.code === "auth/too-many-requests") {
        toast.error("Too many attempts", {
          description: "Please wait a few minutes before trying again.",
        });
      } else if (error.code === "auth/invalid-phone-number") {
        toast.error("Invalid phone number", {
          description: "Please check the number and try again.",
        });
      } else {
        toast.error("Failed to send OTP", {
          description: error.message || "Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP.");
      return;
    }

    if (!confirmationRef.current) {
      toast.error("Session expired. Please request a new OTP.");
      setMode("phone");
      return;
    }

    setLoading(true);
    try {
      await confirmationRef.current.confirm(otp);
      toast.success("Signed in successfully!");
      onClose();
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error("[Auth] OTP verification failed:", error.code);
      if (error.code === "auth/invalid-verification-code") {
        toast.error("Invalid OTP", {
          description: "The code you entered is incorrect. Please try again.",
        });
      } else if (error.code === "auth/code-expired") {
        toast.error("OTP expired", {
          description: "Please request a new code.",
        });
        setMode("phone");
      } else {
        toast.error("Verification failed", {
          description: error.message || "Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [otp, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {mode === "otp" ? "Enter OTP" : "Sign In"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {mode === "otp"
              ? `We sent a 6-digit code to ${phone.replace(/\s/g, "")}`
              : "Sign in to save addresses and track orders."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {mode === "choose" && (
            <>
              <Button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-12 bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 font-semibold gap-3"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {loading ? "Signing in..." : "Continue with Google"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400">or</span>
                </div>
              </div>

              <Button
                onClick={() => setMode("phone")}
                variant="outline"
                className="w-full h-12 font-semibold gap-3"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
                Continue with Phone
              </Button>
            </>
          )}

          {mode === "phone" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Phone Number
                </label>
                <Input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 text-lg"
                  autoFocus
                />
                <p className="text-xs text-slate-400">
                  Indian mobile numbers only (+91)
                </p>
              </div>
              <Button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full h-12 bg-[#064e3b] hover:bg-[#065f46] font-semibold"
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </Button>
              <Button
                onClick={() => setMode("choose")}
                variant="ghost"
                className="w-full"
                disabled={loading}
              >
                Back to sign-in options
              </Button>
            </>
          )}

          {mode === "otp" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Verification Code
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-12 text-lg text-center tracking-[0.3em] font-mono"
                  autoFocus
                  maxLength={6}
                />
              </div>
              <Button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full h-12 bg-[#064e3b] hover:bg-[#065f46] font-semibold"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <Button
                onClick={() => {
                  setOtp("");
                  setMode("phone");
                }}
                variant="ghost"
                className="w-full"
                disabled={loading}
              >
                Resend OTP
              </Button>
            </>
          )}
        </div>

        {/* Invisible reCAPTCHA container */}
        <div ref={recaptchaContainerRef} id="recaptcha-container" />
      </DialogContent>
    </Dialog>
  );
}
