"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit, Timestamp } from "firebase/firestore";
import { useMode } from "@/contexts/ModeContext";
import { Bell } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  orderId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string | Timestamp;
  /** Present on type === "delivery_otp" notifications */
  otp?: string;
  expiresAt?: string;
}

/** Convert createdAt (string | Timestamp | undefined) to epoch ms for sorting */
function toEpoch(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "string") return new Date(v).getTime() || 0;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "object" && v !== null && "toMillis" in v) return (v as Timestamp).toMillis();
  return 0;
}

export function NotificationBell() {
  const { currentUser } = useAuth();
  const { col } = useMode();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fallbackUnsub = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, col("notifications")),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification)
        );
      },
      (err) => {
        // Fallback: query without orderBy if index is missing
        console.warn("[Notifications] Primary query failed, trying fallback:", err.message);
        const fallbackQ = query(
          collection(db, col("notifications")),
          where("userId", "==", currentUser.uid),
          limit(20)
        );
        fallbackUnsub.current = onSnapshot(
          fallbackQ,
          (snap) => {
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification);
            data.sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt));
            setNotifications(data);
          },
          (fallbackErr) => {
            console.warn("[Notifications] Fallback query also failed:", fallbackErr.message);
          }
        );
      }
    );

    return () => {
      unsub();
      fallbackUnsub.current?.();
      fallbackUnsub.current = null;
    };
  }, [currentUser, col]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, col("notifications"), notifId), { read: true });
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
    setIsOpen(false);
  };

  if (!currentUser) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-[#064e3b]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-[120%] right-0 w-80 bg-white rounded-xl shadow-xl border border-slate-100 text-slate-800 animate-in fade-in slide-in-from-top-2 z-50 max-h-[400px] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => {
                const isOtp = notif.type === "delivery_otp" && !!notif.otp;
                const otpExpired =
                  isOtp && notif.expiresAt
                    ? new Date(notif.expiresAt).getTime() < Date.now()
                    : false;
                return (
                  <Link
                    key={notif.id}
                    href={`/dashboard/buyer/orders/detail?id=${notif.orderId}`}
                    onClick={() => handleNotificationClick(notif)}
                    className={`block px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      !notif.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {notif.title}
                        </div>
                        {isOtp ? (
                          <div className="mt-1.5">
                            <div
                              className={`inline-block rounded-md px-2.5 py-1 font-mono text-base font-bold tracking-[0.35em] ${
                                otpExpired
                                  ? "bg-slate-100 text-slate-400 line-through"
                                  : "bg-emerald-50 text-emerald-800"
                              }`}
                            >
                              {notif.otp}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {otpExpired ? "Expired" : "Show this to delivery person"}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {notif.message}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 mt-1">
                          {new Date(toEpoch(notif.createdAt)).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
