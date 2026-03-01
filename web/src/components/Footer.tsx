"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Phone, Mail, MapPin } from "lucide-react";
import { BusinessSettings, DEFAULT_BUSINESS } from "@/types/settings";

export function Footer() {
  const [biz, setBiz] = useState<BusinessSettings>(DEFAULT_BUSINESS);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "business"));
        if (snap.exists()) setBiz({ ...DEFAULT_BUSINESS, ...(snap.data() as Partial<BusinessSettings>) });
      } catch (e) {
        console.warn("[Footer] Failed to load business settings:", e);
      }
    })();
  }, []);

  return (
    <footer className="bg-[#064e3b] text-white mt-12">
      <div className="max-w-[1400px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-3xl">🥬</span>
              <div>
                <div className="font-bold text-xl">{biz.storeName || "KKR Groceries"}</div>
                <div className="text-emerald-300 text-xs uppercase tracking-widest font-semibold">B2B Wholesale</div>
              </div>
            </div>
            <p className="text-emerald-200/70 text-sm leading-relaxed">
              Fresh vegetables at APMC wholesale prices for hotels, restaurants &amp; retailers in Hyderabad.
            </p>
            {biz.gstNumber && (
              <div className="text-emerald-300/60 text-xs mt-3">GST: {biz.gstNumber}</div>
            )}
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-emerald-300 mb-4">Contact</h3>
            <div className="space-y-3">
              {biz.contactPhone && (
                <a href={`tel:${biz.contactPhone}`} className="flex items-center gap-2 text-sm text-emerald-100 hover:text-white transition-colors">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  {biz.contactPhone}
                </a>
              )}
              {biz.contactEmail && (
                <a href={`mailto:${biz.contactEmail}`} className="flex items-center gap-2 text-sm text-emerald-100 hover:text-white transition-colors">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  {biz.contactEmail}
                </a>
              )}
              {biz.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(biz.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-sm text-emerald-100 hover:text-white transition-colors"
                >
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  {biz.address}
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-emerald-300 mb-4">Quick Links</h3>
            <div className="space-y-2 text-sm">
              <a href="/" className="block text-emerald-100 hover:text-white transition-colors">Home</a>
              <a href="/dashboard/buyer" className="block text-emerald-100 hover:text-white transition-colors">My Orders</a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-emerald-800/50 mt-8 pt-6 text-center text-emerald-300/60 text-xs">
          &copy; {new Date().getFullYear()} {biz.storeName || "KKR Groceries"}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
