"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteField, addDoc, collection } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  FileText,
  MapPin,
  Phone,
  Store,
  User,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { Order, OrderCartItem } from "@/types/order";
import { downloadInvoice } from "@/lib/invoice";
import { StatusTimeline, formatStatusTime } from "@/components/OrderTimeline";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Fulfilled") return "default";
  if (status === "Accepted") return "secondary";
  if (status === "Rejected") return "destructive";
  return "outline";
}

export default function OrderDetailPage() {
  const { currentUser } = useAuth();
  const { col } = useMode();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("id") as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || !orderId) return;

    const fetchOrder = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, col("orders"), orderId));
        if (!snap.exists()) {
          setError("Order not found.");
          return;
        }
        const data = { ...snap.data(), id: snap.id } as Order;
        if (data.userId !== currentUser.uid) {
          setError("You don't have permission to view this order.");
          return;
        }
        setOrder(data);
      } catch (e) {
        console.error("Failed to fetch order:", e);
        setError("Failed to load order.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [currentUser, orderId, col]);

  const handleApproveModification = async () => {
    if (!order?.pendingModification) return;
    setApproveDialogOpen(false);
    setActionLoading(true);
    try {
      const mod = order.pendingModification;
      await updateDoc(doc(db, col("orders"), order.id), {
        cart: mod.proposedCart,
        orderSummary: mod.proposedSummary,
        totalValue: mod.proposedTotalValue,
        productCount: mod.proposedCount,
        pendingModification: deleteField(),
        modificationStatus: "Approved",
        modificationApprovedAt: new Date().toISOString(),
      });

      // Notify admin
      await addDoc(collection(db, col("notifications")), {
        userId: "admin",
        orderId: order.id,
        type: "modificationApproved",
        title: "Modification Approved",
        message: `Buyer approved changes for order ${order.orderId || order.id}.`,
        read: false,
        createdAt: new Date().toISOString(),
      });

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              cart: mod.proposedCart,
              orderSummary: mod.proposedSummary,
              totalValue: mod.proposedTotalValue,
              productCount: mod.proposedCount,
              pendingModification: undefined,
              modificationStatus: "Approved",
            }
          : null
      );
      toast.success("Modification approved.");
    } catch (e) {
      console.error("[Order] Failed to approve modification:", e);
      toast.error("Failed to approve modification.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectModification = async () => {
    if (!order) return;
    setRejectDialogOpen(false);
    setActionLoading(true);
    try {
      await updateDoc(doc(db, col("orders"), order.id), {
        pendingModification: deleteField(),
        modificationStatus: "RejectedByBuyer",
      });

      await addDoc(collection(db, col("notifications")), {
        userId: "admin",
        orderId: order.id,
        type: "modificationRejected",
        title: "Modification Rejected",
        message: `Buyer rejected changes for order ${order.orderId || order.id}.`,
        read: false,
        createdAt: new Date().toISOString(),
      });

      setOrder((prev) =>
        prev ? { ...prev, pendingModification: undefined, modificationStatus: "RejectedByBuyer" } : null
      );
      toast.success("Modification rejected.");
    } catch (e) {
      console.error("[Order] Failed to reject modification:", e);
      toast.error("Failed to reject modification.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">Please Sign In</h2>
          <Link href="/" className="text-primary mt-2 block hover:underline">Return Home</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading order...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">{error || "Order not found"}</h2>
          <Link href="/dashboard/buyer" className="text-primary hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const cart = order.cart || [];
  const hasPendingMod = !!order.pendingModification;
  const mod = order.pendingModification;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        {/* Back link */}
        <Link
          href="/dashboard/buyer"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Order Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800 mb-1">
                Order {order.orderId || order.id}
              </h1>
              <div className="text-sm text-slate-500">
                {order.timestamp || formatStatusTime(order.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusBadgeVariant(order.status || "Pending")}>
                {order.status || "Pending"}
              </Badge>
              <Button variant="secondary" size="sm" onClick={() => downloadInvoice(order)}>
                <FileText className="w-4 h-4" /> Invoice
              </Button>
            </div>
          </div>

          <StatusTimeline order={order} />
        </div>

        {/* Pending Modification Banner */}
        {hasPendingMod && mod && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-bold text-amber-800">Modification Request</h2>
              </div>
              <p className="text-sm text-amber-700 mb-4">
                The admin has proposed changes to your order. Please review and approve or reject.
              </p>

              {/* Changes list */}
              <div className="bg-white rounded-xl p-4 mb-4 border border-amber-100">
                <h3 className="text-sm font-bold text-slate-700 mb-2">Changes:</h3>
                <ul className="space-y-1">
                  {mod.changes.map((change, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Proposed cart comparison */}
              <div className="bg-white rounded-xl p-4 mb-4 border border-amber-100">
                <h3 className="text-sm font-bold text-slate-700 mb-2">Proposed Items:</h3>
                <div className="space-y-2">
                  {mod.proposedCart.map((item, idx) => {
                    const currentItem = cart.find((ci) => ci.name === item.name);
                    const qtyChanged = currentItem && currentItem.qty !== item.qty;
                    const priceChanged = currentItem && currentItem.price !== item.price;

                    return (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-slate-700">{item.name}</span>
                        <span className="text-slate-500">
                          {qtyChanged && (
                            <span className="line-through text-slate-400 mr-1">{currentItem.qty}</span>
                          )}
                          <span className={qtyChanged ? "bg-yellow-100 rounded px-0.5" : ""}>
                            {item.qty}
                          </span>
                          {" "}{item.unit} ×{" "}
                          {priceChanged && (
                            <span className="line-through text-slate-400 mr-1">₹{currentItem.price}</span>
                          )}
                          <span className={priceChanged ? "bg-yellow-100 rounded px-0.5" : ""}>
                            ₹{item.price}
                          </span>
                          {" = "}
                          <span className="font-semibold text-slate-800">
                            ₹{(item.qty * item.price).toLocaleString("en-IN")}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                  <div className="border-t border-slate-100 pt-2 flex justify-between font-bold">
                    <span>New Total</span>
                    <span>{mod.proposedTotalValue}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setApproveDialogOpen(true)}
                  disabled={actionLoading}
                  className="flex-1"
                >
                  Approve Changes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={actionLoading}
                  className="flex-1"
                >
                  Reject Changes
                </Button>
              </div>
            </div>

            <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve modification?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your order will be updated with the proposed changes. The new total will be {mod.proposedTotalValue}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApproveModification}>Approve</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject modification?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The admin will be notified and your original order will remain unchanged.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleRejectModification}>Reject</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {/* Customer Details */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
          <h2 className="font-bold text-slate-800 mb-3">Delivery Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{order.customerName}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{order.phone}</span>
            </div>
            {order.shopName && (
              <div className="flex items-center gap-2 text-slate-600">
                <Store className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{order.shopName}</span>
              </div>
            )}
            {order.location && (
              <div className="flex items-start gap-2 text-slate-600 sm:col-span-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(order.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  {order.location}{order.pincode ? ` - ${order.pincode}` : ""}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
          <h2 className="font-bold text-slate-800 mb-3 uppercase tracking-wide text-xs text-emerald-700">Order Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-emerald-600">
                  <th className="py-2 px-2 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider w-8">#</th>
                  <th className="py-2 px-2 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">Item</th>
                  <th className="py-2 px-2 text-center text-xs font-bold text-emerald-700 uppercase tracking-wider w-14">Qty</th>
                  <th className="py-2 px-2 text-center text-xs font-bold text-emerald-700 uppercase tracking-wider w-16">Unit</th>
                  <th className="py-2 px-2 text-right text-xs font-bold text-emerald-700 uppercase tracking-wider w-16">Price</th>
                  <th className="py-2 px-2 text-right text-xs font-bold text-emerald-700 uppercase tracking-wider w-20">Amount</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item: OrderCartItem, idx: number) => {
                  const amount = item.qty * item.price;
                  const origItem = order.originalCart
                    ? order.originalCart.find((oi) => oi.name === item.name)
                    : undefined;
                  const qtyChanged = origItem && origItem.qty !== item.qty;
                  const priceChanged = origItem && origItem.price !== item.price;

                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 px-2 text-slate-400 text-xs">{idx + 1}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden relative shrink-0 flex items-center justify-center">
                            {item.image ? (
                              <Image src={item.image} alt={item.name} fill sizes="36px" className="object-cover" unoptimized={!item.image.includes("googleapis.com")} />
                            ) : (
                              <span className="text-xs font-bold text-slate-300">{item.name[0]}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800">{item.name}</span>
                            {(item.telugu || item.hindi) && (
                              <div className="text-xs text-slate-400">
                                {[item.telugu, item.hindi].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        {qtyChanged && (
                          <span className="line-through text-slate-400 mr-1 text-xs">{origItem.qty}</span>
                        )}
                        <span className={qtyChanged ? "bg-yellow-100 rounded px-1" : "text-slate-700"}>{item.qty}</span>
                      </td>
                      <td className="py-3 px-2 text-center text-slate-500">{item.unit}</td>
                      <td className="py-3 px-2 text-right">
                        {priceChanged && (
                          <span className="line-through text-slate-400 mr-1 text-xs">₹{origItem.price}</span>
                        )}
                        <span className={priceChanged ? "bg-yellow-100 rounded px-1" : "text-slate-700"}>₹{item.price}</span>
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-700">₹{amount.toLocaleString("en-IN")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="border-t-2 border-emerald-600 mt-1 pt-3 flex justify-between items-center">
            <div className="text-sm text-slate-500 flex items-center gap-1">
              <Truck className="w-4 h-4" /> Free Delivery
            </div>
            <div>
              <span className="text-sm text-slate-500 mr-2">{order.productCount || cart.length} items</span>
              <span className="text-xl font-bold text-slate-800">{order.totalValue}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
