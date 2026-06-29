"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { Order } from "@/types/order";
import { toast } from "sonner";
import { Zap, Truck, Loader2, UserCog, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const AssignDeliveryDialog = dynamic(() => import("./AssignDeliveryDialog"), { ssr: false });

interface Props {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  /**
   * Called after a delivery agent has been assigned (or the admin chose to skip).
   * The parent uses this to finalize shipping (set status → Shipped + notify).
   */
  onShipped: (orderId: string) => Promise<void> | void;
}

/**
 * Two-option delivery-assignment chooser shown when an admin ships an order:
 *   1. Auto Assign  — one tap; picks the nearest available online agent.
 *   2. Manual Assign — opens the full smart-assignment dialog (store + agent).
 * After assignment, `onShipped` finalizes the order.
 */
export default function ShipDeliveryChooser({ open, order, onClose, onShipped }: Props) {
  const [mode, setMode] = useState<"choose" | "manual">("choose");
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [shipping, setShipping] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("choose");
      setAutoAssigning(false);
      setShipping(false);
    }
  }, [open]);

  if (!order) return null;

  const handleAuto = async () => {
    setAutoAssigning(true);
    try {
      const fn = httpsCallable<
        { orderId: string },
        { success: boolean; assigned: { name: string; distanceKm: number }; candidateCount: number }
      >(functions, "autoAssignDeliveryBoy");
      const res = await fn({ orderId: order.id });
      if (res.data.success) {
        toast.success(
          `Assigned ${res.data.assigned.name} (${res.data.assigned.distanceKm}km away)`,
          { description: `${res.data.candidateCount} agent(s) considered` }
        );
      }
      await onShipped(order.id);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Auto-assign failed.";
      toast.error(msg, {
        description: "Try Manual assign, or make sure a delivery agent is online with GPS.",
      });
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleShipWithout = async () => {
    setShipping(true);
    try {
      await onShipped(order.id);
      onClose();
    } finally {
      setShipping(false);
    }
  };

  // Manual mode delegates to the full smart-assignment dialog.
  if (mode === "manual") {
    return (
      <AssignDeliveryDialog
        open={open}
        order={order}
        onClose={onClose}
        onAssigned={async () => {
          await onShipped(order.id);
          onClose();
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> Assign Delivery Agent
          </DialogTitle>
          <DialogDescription>
            Order #{order.orderId} — {order.customerName}. Choose how to assign a delivery agent before shipping.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Auto */}
          <button
            onClick={handleAuto}
            disabled={autoAssigning || shipping}
            className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-left hover:bg-blue-50 transition-colors disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              {autoAssigning ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin" /> : <Zap className="w-5 h-5 text-blue-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-800 text-sm">Auto Assign Delivery Agent</div>
              <div className="text-xs text-slate-500 mt-0.5">Picks the nearest available agent who is online with GPS.</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {/* Manual */}
          <button
            onClick={() => setMode("manual")}
            disabled={autoAssigning || shipping}
            className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50/60 p-4 text-left hover:bg-purple-50 transition-colors disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <UserCog className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-800 text-sm">Manual Assign Delivery Agent</div>
              <div className="text-xs text-slate-500 mt-0.5">Pick the pickup store and the delivery agent yourself.</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={handleShipWithout}
            disabled={autoAssigning || shipping}
            className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            {shipping ? "Shipping…" : "Ship without assigning"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
