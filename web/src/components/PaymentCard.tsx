"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { db, functions } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useMode } from "@/contexts/ModeContext";
import { Order } from "@/types/order";
import { parseTotal } from "@/lib/helpers";
import { PaymentSettings, DEFAULT_PAYMENTS } from "@/types/settings";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock, Loader2, Smartphone, IndianRupee, Banknote } from "lucide-react";

/**
 * Buyer-facing payment card shown on the order detail page. Phase 1 = UPI.
 * Renders a UPI deep-link (mobile) + QR (desktop), and lets the buyer submit
 * the UPI reference/UTR after paying. Admin reconciles & marks the order paid.
 */
export function PaymentCard({ order }: { order: Order }) {
  const { col } = useMode();
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [choosingCod, setChoosingCod] = useState(false);

  const amount = parseTotal(order.totalValue);
  const status = order.paymentStatus || "unpaid";

  useEffect(() => {
    getDoc(doc(db, "settings", "payments"))
      .then((s) => setSettings(s.exists() ? ({ ...DEFAULT_PAYMENTS, ...s.data() } as PaymentSettings) : DEFAULT_PAYMENTS))
      .catch(() => setSettings(DEFAULT_PAYMENTS));
  }, []);

  const upiEnabled = !!settings && (settings.mode === "upi" || settings.mode === "both") && !!settings.upiVpa;

  const upiLink = upiEnabled
    ? `upi://pay?pa=${encodeURIComponent(settings!.upiVpa)}&pn=${encodeURIComponent(settings!.payeeName || "Store")}&am=${amount.toFixed(2)}&tn=${encodeURIComponent("Order " + (order.orderId || order.id))}&cu=INR`
    : "";

  useEffect(() => {
    if (!upiLink) return;
    QRCode.toDataURL(upiLink, { width: 220, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [upiLink]);

  // Already paid → confirmation card
  if (status === "paid") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 text-emerald-800 font-bold">
          <CheckCircle2 className="w-5 h-5" /> Payment received
        </div>
        {order.paymentRef && (
          <p className="text-sm text-emerald-700 mt-1">Reference: <span className="font-mono">{order.paymentRef}</span></p>
        )}
      </div>
    );
  }

  // No online payment configured / nothing to pay
  if (!upiEnabled || amount <= 0 || order.status === "Rejected") return null;

  const isCod = order.paymentMethod === "cod";

  const handleChooseCod = async () => {
    setChoosingCod(true);
    try {
      await httpsCallable(functions, "chooseCOD")({ orderId: order.id, orderCollection: col("orders") });
      toast.success("Cash on Delivery selected — pay the agent when your order arrives.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to select Cash on Delivery.";
      toast.error(msg);
    } finally {
      setChoosingCod(false);
    }
  };

  const handleSubmit = async () => {
    if (!utr.trim()) {
      toast.error("Enter the UPI reference / UTR number from your payment app.");
      return;
    }
    setSubmitting(true);
    try {
      await httpsCallable(functions, "submitPaymentUTR")({
        orderId: order.id,
        orderCollection: col("orders"),
        utr: utr.trim(),
      });
      toast.success("Payment reference submitted — we'll confirm it shortly.");
      setUtr("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to submit reference.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-emerald-600" /> Pay for this order
        </h2>
        <span className="text-lg font-extrabold text-emerald-700">₹{amount.toLocaleString("en-IN")}</span>
      </div>

      {status === "submitted" && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          <Clock className="w-4 h-4" /> Payment submitted{order.paymentRef ? <> (Ref: <span className="font-mono">{order.paymentRef}</span>)</> : null} — awaiting confirmation.
        </div>
      )}

      {isCod && status !== "submitted" && (
        <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
          <Banknote className="w-4 h-4 text-emerald-600" /> Cash on Delivery selected — pay ₹{amount.toLocaleString("en-IN")} to the delivery agent. You can still pay online below if you prefer.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* Mobile: open UPI app */}
        <div className="space-y-2">
          <a
            href={upiLink}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            <Smartphone className="w-4 h-4" /> Pay ₹{amount.toLocaleString("en-IN")} via UPI
          </a>
          <p className="text-[11px] text-slate-400 text-center">Opens GPay / PhonePe / Paytm with the amount pre-filled.</p>
        </div>

        {/* Desktop: scan QR */}
        {qrDataUrl && (
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="UPI QR code" className="w-36 h-36 rounded-lg border border-slate-200" />
            <p className="text-[11px] text-slate-400 mt-1">Scan with any UPI app</p>
          </div>
        )}
      </div>

      {/* UTR submission */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
          Already paid? Enter the UPI reference (UTR)
        </label>
        <div className="flex gap-2">
          <Input
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            placeholder="12-digit UTR / reference no."
            className="flex-1"
          />
          <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            I&apos;ve Paid
          </Button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Find the UTR in your UPI app&apos;s transaction details. We&apos;ll verify and confirm your payment.
        </p>
      </div>

      {/* Cash on Delivery alternative */}
      {!isCod && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-center">
          <button
            onClick={handleChooseCod}
            disabled={choosingCod}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
          >
            {choosingCod ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
            Prefer cash? Choose Cash on Delivery
          </button>
        </div>
      )}
    </div>
  );
}
