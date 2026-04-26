"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Phone as PhoneIcon,
  ShieldCheck,
} from "lucide-react";
import type { useDeliveryOTP } from "@/hooks/useDeliveryOTP";

type OtpHookReturn = ReturnType<typeof useDeliveryOTP>;

interface DeliveryOtpDialogProps {
  otp: OtpHookReturn;
  onFulfillWithoutOtp: (orderId: string) => void;
}

/**
 * Shared OTP-on-fulfill dialog used by both OrdersTab and CommandCenter.
 * Hooks into the useDeliveryOTP hook's exposed state/actions.
 */
export function DeliveryOtpDialog({ otp, onFulfillWithoutOtp }: DeliveryOtpDialogProps) {
  const order = otp.dialogOrder;
  const wantEmail = otp.channels.email;
  const wantSms = otp.channels.sms;
  const wantApp = otp.channels.app;
  const hasEmail = !!order?.userEmail;
  const hasPhone = !!order?.phone;
  const hasApp = !!order?.userId;
  const canSend = (wantEmail && hasEmail) || (wantSms && hasPhone) || (wantApp && hasApp);
  const enabledCount = (wantEmail ? 1 : 0) + (wantSms ? 1 : 0) + (wantApp ? 1 : 0);

  const channelParts: string[] = [];
  if (wantSms && hasPhone) channelParts.push("SMS");
  if (wantEmail && hasEmail) channelParts.push("Email");
  if (wantApp && hasApp) channelParts.push("App");
  const channelLabel = channelParts.length > 0 ? channelParts.join(" & ") : "N/A";

  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open) otp.closeDialog(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            Delivery OTP Verification
          </DialogTitle>
          <DialogDescription>
            Send OTP to confirm delivery of order{" "}
            <span className="font-mono font-semibold text-slate-700">
              {order?.orderId || order?.id}
            </span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1.5">
            <div>
              <span className="text-slate-400">Customer:</span>{" "}
              <span className="font-medium">{order?.customerName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <PhoneIcon className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Phone:</span>
              <span className="font-medium">{order?.phone || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Email:</span>
              <span className="font-medium">{order?.userEmail || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
              <MessageSquare className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Channel:</span>
              <span className="font-medium text-xs uppercase tracking-wider">
                {channelParts.length > 0 ? channelParts.join(" \u00B7 ") : "\u2014"}
              </span>
            </div>
          </div>

          {!otp.sent ? (
            <div className="space-y-3">
              <Button
                onClick={otp.send}
                disabled={otp.sending || !canSend}
                className="w-full bg-amber-500 hover:bg-amber-600"
              >
                {otp.sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" /> Send OTP via {channelLabel}</>
                )}
              </Button>
              {!canSend && (
                <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-2">
                  No contact info available for the selected channel{enabledCount > 1 ? "s" : ""}.
                  {!hasPhone && wantSms && <span className="block text-xs mt-0.5">Phone number missing.</span>}
                  {!hasEmail && wantEmail && <span className="block text-xs mt-0.5">Email missing.</span>}
                  {!hasApp && wantApp && (
                    <span className="block text-xs mt-0.5">
                      Buyer not signed in (no app account on this order).
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => {
                      if (order) onFulfillWithoutOtp(order.id);
                      otp.closeDialog();
                    }}
                  >
                    Fulfill Without OTP
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                {otp.smsSent && (
                  <div className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> SMS sent to {order?.phone}
                  </div>
                )}
                {otp.emailSent && (
                  <div className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Email sent to {order?.userEmail}
                  </div>
                )}
                {otp.appSent && (
                  <div className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> App banner active for buyer
                  </div>
                )}
                {otp.smsSent && (otp.emailSent || otp.appSent) && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    SMS uses a separate code. Enter either the SMS code or the Email/App code to verify.
                  </p>
                )}
              </div>
              <Input
                placeholder="Enter 6-digit OTP"
                value={otp.code}
                onChange={(e) => otp.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
              <div className="flex gap-2">
                <Button
                  onClick={otp.verify}
                  disabled={otp.verifying || otp.code.length !== 6}
                  className="flex-1"
                >
                  {otp.verifying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Verify &amp; Fulfill</>
                  )}
                </Button>
                <Button variant="outline" onClick={otp.send} disabled={otp.sending} size="sm">
                  Resend
                </Button>
              </div>
            </div>
          )}

          {otp.error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2 whitespace-pre-line">
              {otp.error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
