"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  commodity: string;
  currentPrice: number;
  market: string;
}

interface AlertConfig {
  belowEnabled: boolean;
  belowPrice: number;
  aboveEnabled: boolean;
  abovePrice: number;
  market: string;
  createdAt: string;
}

function commodityKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function PriceAlertButton({ commodity, currentPrice, market }: Props) {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [hasAlert, setHasAlert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [belowEnabled, setBelowEnabled] = useState(true);
  const [belowPrice, setBelowPrice] = useState(Math.max(0, currentPrice - 5));
  const [aboveEnabled, setAboveEnabled] = useState(true);
  const [abovePrice, setAbovePrice] = useState(currentPrice + 10);
  const popoverRef = useRef<HTMLDivElement>(null);

  const key = commodityKey(commodity);

  // Load existing alert on mount
  useEffect(() => {
    if (!currentUser) return;
    const ref = doc(db, `user_alerts/${currentUser.uid}/commodities/${key}`);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as AlertConfig;
        setHasAlert(true);
        setBelowEnabled(data.belowEnabled);
        setBelowPrice(data.belowPrice);
        setAboveEnabled(data.aboveEnabled);
        setAbovePrice(data.abovePrice);
      }
    }).catch(() => {
      // Silently fail — user may not have permissions yet
    });
  }, [currentUser, key]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const ref = doc(db, `user_alerts/${currentUser.uid}/commodities/${key}`);
      if (!belowEnabled && !aboveEnabled) {
        // Remove alert entirely
        await deleteDoc(ref);
        setHasAlert(false);
      } else {
        const config: AlertConfig = {
          belowEnabled,
          belowPrice,
          aboveEnabled,
          abovePrice,
          market,
          createdAt: new Date().toISOString(),
        };
        await setDoc(ref, config);
        setHasAlert(true);
      }
      setOpen(false);
    } catch (err) {
      console.error("[PriceAlert] Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [currentUser, key, belowEnabled, belowPrice, aboveEnabled, abovePrice, market]);

  const handleRemove = useCallback(async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const ref = doc(db, `user_alerts/${currentUser.uid}/commodities/${key}`);
      await deleteDoc(ref);
      setHasAlert(false);
      setBelowEnabled(true);
      setBelowPrice(Math.max(0, currentPrice - 5));
      setAboveEnabled(true);
      setAbovePrice(currentPrice + 10);
      setOpen(false);
    } catch (err) {
      console.error("[PriceAlert] Remove failed:", err);
    } finally {
      setSaving(false);
    }
  }, [currentUser, key, currentPrice]);

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell icon button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95 ${
          hasAlert
            ? "bg-amber-50 text-amber-500 border border-amber-200/80 hover:bg-amber-100"
            : "bg-slate-50 text-slate-300 border border-slate-200/60 hover:bg-slate-100 hover:text-slate-400"
        }`}
        title={hasAlert ? `Alert active for ${commodity}` : `Set price alert for ${commodity}`}
      >
        {hasAlert ? (
          <BellRing className="w-3.5 h-3.5" />
        ) : (
          <Bell className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-200/50 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-700">Price Alert</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">{commodity} · ₹{currentPrice}/kg now</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {!currentUser ? (
            /* Not logged in */
            <div className="p-4 text-center">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-1">Login Required</p>
              <p className="text-[11px] text-slate-400">Sign in to set price alerts for {commodity}</p>
            </div>
          ) : (
            /* Alert config form */
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-slate-500 font-medium">
                Alert me when <span className="font-bold text-slate-700">{commodity}</span> goes...
              </p>

              {/* Below threshold */}
              <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${
                belowEnabled
                  ? "bg-emerald-50/60 border-emerald-100/80"
                  : "bg-slate-50/50 border-slate-100"
              }`}>
                <button
                  onClick={() => setBelowEnabled(!belowEnabled)}
                  className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
                    belowEnabled ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    belowEnabled ? "left-3.5" : "left-0.5"
                  }`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${
                    belowEnabled ? "text-emerald-600" : "text-slate-400"
                  }`}>
                    Below
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-slate-500">₹</span>
                    <input
                      type="number"
                      value={belowPrice}
                      onChange={(e) => setBelowPrice(Math.max(0, Number(e.target.value)))}
                      disabled={!belowEnabled}
                      className="w-16 text-sm font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-emerald-400 outline-none tabular-nums disabled:opacity-40"
                    />
                    <span className="text-[10px] text-slate-400">/kg</span>
                  </div>
                </div>
              </div>

              {/* Above threshold */}
              <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${
                aboveEnabled
                  ? "bg-red-50/60 border-red-100/80"
                  : "bg-slate-50/50 border-slate-100"
              }`}>
                <button
                  onClick={() => setAboveEnabled(!aboveEnabled)}
                  className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
                    aboveEnabled ? "bg-red-500" : "bg-slate-300"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    aboveEnabled ? "left-3.5" : "left-0.5"
                  }`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${
                    aboveEnabled ? "text-red-600" : "text-slate-400"
                  }`}>
                    Above
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-slate-500">₹</span>
                    <input
                      type="number"
                      value={abovePrice}
                      onChange={(e) => setAbovePrice(Math.max(0, Number(e.target.value)))}
                      disabled={!aboveEnabled}
                      className="w-16 text-sm font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-red-400 outline-none tabular-nums disabled:opacity-40"
                    />
                    <span className="text-[10px] text-slate-400">/kg</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving || (!belowEnabled && !aboveEnabled)}
                  className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-[#0a2f1f] text-white hover:bg-[#0d3a27] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : hasAlert ? "Update Alert" : "Set Alert"}
                </button>
                {hasAlert && (
                  <button
                    onClick={handleRemove}
                    disabled={saving}
                    className="text-xs font-bold py-2.5 px-3 rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-40"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
