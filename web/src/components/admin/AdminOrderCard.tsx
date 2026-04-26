"use client";

import Image from "next/image";
import {
  CheckCircle2,
  XCircle,
  Pencil,
  FileText,
  MapPin,
  Clock,
  Truck,
} from "lucide-react";
import { Order, OrderStatus, OrderCartItem } from "@/types/order";
import { StatusTimeline, formatStatusTime } from "@/components/OrderTimeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function statusBadgeVariant(
  status: OrderStatus,
  hasPendingMod: boolean
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Fulfilled") return "default";
  if (status === "Shipped") return "secondary";
  if (status === "Accepted") return "secondary";
  if (status === "Rejected") return "destructive";
  if (hasPendingMod) return "outline";
  return "outline";
}

interface AdminOrderCardProps {
  order: Order;
  productImageMap: Record<string, string>;
  highlight: boolean;
  onAccept: (orderId: string) => void;
  onShip: (orderId: string) => void;
  onReject: (orderId: string) => void;
  onFulfillClick: (order: Order) => void;
  onEdit: (order: Order) => void;
  onCancelModification: (orderId: string) => void;
  onDownloadInvoice: (order: Order) => void;
}

export function AdminOrderCard({
  order: o,
  productImageMap,
  highlight,
  onAccept,
  onShip,
  onReject,
  onFulfillClick,
  onEdit,
  onCancelModification,
  onDownloadInvoice,
}: AdminOrderCardProps) {
  const hasPendingMod = o.modificationStatus === "PendingBuyerApproval";
  const statusText = hasPendingMod ? "Pending Approval" : o.status || "Pending";
  const cart = o.cart || [];

  return (
    <div
      id={`order-card-${o.id}`}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden${
        highlight ? " c2-order-highlight" : ""
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                {o.orderId || o.id}
              </span>
              <Badge variant={statusBadgeVariant(o.status || "Pending", hasPendingMod)}>
                {statusText}
              </Badge>
              {hasPendingMod && (
                <Badge
                  variant="outline"
                  className="text-orange-600 border-orange-200 bg-orange-50"
                >
                  Waiting for buyer approval
                </Badge>
              )}
            </div>
            <div className="text-sm text-slate-500 mb-0.5">
              <Clock className="w-3 h-3 inline mr-1" />
              {o.timestamp || formatStatusTime(o.createdAt)}
            </div>
            <div className="text-sm text-slate-700">
              <span className="font-semibold">{o.shopName || o.customerName}</span>
              {" \u2022 "}
              {o.customerName} {" \u2022 "} {o.phone}
            </div>
            {o.location && (
              <div className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(o.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  {o.location}
                  {o.pincode ? ` - ${o.pincode}` : ""}
                </a>
              </div>
            )}
            <StatusTimeline order={o} />
          </div>
        </div>
      </div>

      {/* Cart items */}
      <div className="px-4 py-3">
        {cart.length > 0 ? (
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
                {cart.map((item, idx) => {
                  const amount = (item.qty || 0) * (item.price || 0);
                  const origItem = o.originalCart
                    ? o.originalCart.find((oi: OrderCartItem) => oi.name === item.name)
                    : undefined;
                  const qtyChanged = origItem && origItem.qty !== item.qty;
                  const priceChanged = origItem && origItem.price !== item.price;
                  const resolvedImg =
                    item.image || productImageMap[(item.name || "").toLowerCase()] || "";

                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 px-2 text-slate-400 text-xs">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden relative shrink-0 flex items-center justify-center">
                            {resolvedImg ? (
                              <Image
                                src={resolvedImg}
                                alt={item.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized={!resolvedImg.includes("googleapis.com")}
                              />
                            ) : (
                              <span className="text-xs font-bold text-slate-300">
                                {item.name?.[0] || "?"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-slate-700 font-medium">{item.name}</span>
                            {(item.telugu || item.hindi) && (
                              <div className="text-xs text-slate-400">
                                {[item.telugu, item.hindi].filter(Boolean).join(" \u00B7 ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {qtyChanged && (
                          <span className="line-through text-slate-400 mr-1 text-xs">
                            {origItem.qty}
                          </span>
                        )}
                        <span className={qtyChanged ? "bg-yellow-100 rounded px-1" : "text-slate-700"}>
                          {item.qty}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center text-slate-500">{item.unit}</td>
                      <td className="py-2 px-2 text-right">
                        {priceChanged && (
                          <span className="line-through text-slate-400 mr-1 text-xs">
                            &#8377;{origItem.price}
                          </span>
                        )}
                        <span className={priceChanged ? "bg-yellow-100 rounded px-1" : "text-slate-700"}>
                          &#8377;{item.price}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-700">
                        &#8377;{amount.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-500">{o.orderSummary}</div>
        )}
      </div>

      {/* Footer: actions left + total right */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {hasPendingMod ? (
            <>
              <Button variant="destructive" size="sm" onClick={() => onCancelModification(o.id)}>
                <XCircle className="w-3.5 h-3.5" /> Cancel Changes
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onDownloadInvoice(o)}>
                <FileText className="w-3.5 h-3.5" /> Invoice
              </Button>
            </>
          ) : o.status === "Pending" || !o.status ? (
            <>
              <Button
                size="sm"
                onClick={() => onAccept(o.id)}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(o)}
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onDownloadInvoice(o)}>
                <FileText className="w-3.5 h-3.5" /> Invoice
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onReject(o.id)}>
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          ) : o.status === "Accepted" ? (
            <>
              <Button
                size="sm"
                onClick={() => onShip(o.id)}
                className="bg-indigo-500 hover:bg-indigo-600"
              >
                <Truck className="w-3.5 h-3.5" /> Ship
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onDownloadInvoice(o)}>
                <FileText className="w-3.5 h-3.5" /> Invoice
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(o)}
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            </>
          ) : o.status === "Shipped" ? (
            <>
              <Button size="sm" onClick={() => onFulfillClick(o)}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Fulfill
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onDownloadInvoice(o)}>
                <FileText className="w-3.5 h-3.5" /> Invoice
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(o)}
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            </>
          ) : o.status === "Fulfilled" ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => onDownloadInvoice(o)}>
                <FileText className="w-3.5 h-3.5" /> Invoice
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(o)}
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">{o.productCount || cart.length} items</span>
          <span className="text-lg font-extrabold text-slate-800">{o.totalValue}</span>
        </div>
      </div>
    </div>
  );
}
