"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteField, addDoc, collection } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
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
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

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
        const snap = await getDoc(doc(db, "orders", orderId));
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
  }, [currentUser, orderId]);

  const handleApproveModification = async () => {
    if (!order?.pendingModification) return;
    setApproveDialogOpen(false);
    setActionLoading(true);
    try {
      const mod = order.pendingModification;
      await updateDoc(doc(db, "orders", order.id), {
        cart: mod.proposedCart,
        orderSummary: mod.proposedSummary,
        totalValue: mod.proposedTotalValue,
        productCount: mod.proposedCount,
        pendingModification: deleteField(),
        modificationStatus: "Approved",
        modificationApprovedAt: new Date().toISOString(),
      });

      // Notify admin
      await addDoc(collection(db, "notifications"), {
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
      console.error(e);
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
      await updateDoc(doc(db, "orders", order.id), {
        pendingModification: deleteField(),
        modificationStatus: "RejectedByBuyer",
      });

      await addDoc(collection(db, "notifications"), {
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
      console.error(e);
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
                  {mod.proposedCart.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.name}</span>
                      <span className="text-slate-500">
                        {item.qty} {item.unit} × ₹{item.price} = <span className="font-semibold text-slate-800">₹{(item.qty * item.price).toLocaleString("en-IN")}</span>
                      </span>
                    </div>
                  ))}
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
                <span>{order.location}{order.pincode ? ` - ${order.pincode}` : ""}</span>
              </div>
            )}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
          <h2 className="font-bold text-slate-800 mb-3">Order Items</h2>
          <div className="space-y-3">
            {cart.map((item: OrderCartItem, idx: number) => {
              const amount = item.qty * item.price;
              return (
                <div key={idx} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden relative shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill sizes="40px" className="object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-slate-300">{item.name[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-500">
                      {item.qty} {item.unit} × ₹{item.price}
                    </div>
                  </div>
                  <div className="font-bold text-slate-800 text-sm">
                    ₹{amount.toLocaleString("en-IN")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between items-center">
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
