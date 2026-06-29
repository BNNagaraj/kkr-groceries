"use client";

import React from "react";
import { Phone, Mail, MapPin } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";

export function Footer() {
  const { biz } = useBusiness();
  const logoSrc = biz.logoUrl || "/icon-192.png";

  return (
    <footer className="text-white mt-12" style={{ background: "var(--color-primary-dark)" }}>
      <div className="max-w-[1400px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src={logoSrc} alt={biz.storeName || "KKR Groceries"} width={40} height={40} className="rounded-md" />
              <div>
                <div className="font-bold text-xl">{biz.storeName || "KKR Groceries"}</div>
                <div className="text-white/60 text-xs uppercase tracking-widest font-semibold">{biz.tagline || "Hyderabad B2B & B2C Wholesale"}</div>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              Fresh vegetables at APMC wholesale prices for hotels, restaurants &amp; retailers in Hyderabad.
            </p>
            {biz.gstNumber && (
              <div className="text-white/40 text-xs mt-3">GST: {biz.gstNumber}</div>
            )}
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-white/70 mb-4">Contact</h3>
            <div className="space-y-3">
              {(biz.contactPhone || !biz.contactEmail) && (
                <a href={`tel:${biz.contactPhone || "+91-9876543210"}`} className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors">
                  <Phone className="w-4 h-4 text-white/50" />
                  {biz.contactPhone || "+91-9876543210"}
                </a>
              )}
              {(biz.contactEmail || !biz.contactPhone) && (
                <a href={`mailto:${biz.contactEmail || "orders@kkrgroceries.com"}`} className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors">
                  <Mail className="w-4 h-4 text-white/50" />
                  {biz.contactEmail || "orders@kkrgroceries.com"}
                </a>
              )}
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(biz.address || "Bowenpally, Hyderabad, Telangana")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-sm text-white/80 hover:text-white transition-colors"
              >
                <MapPin className="w-4 h-4 text-white/50 shrink-0 mt-0.5" />
                {biz.address || "Bowenpally, Hyderabad, Telangana"}
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-white/70 mb-4">Quick Links</h3>
            <div className="space-y-2 text-sm">
              <a href="/" className="block text-white/80 hover:text-white transition-colors">Home</a>
              <a href="/dashboard/buyer" className="block text-white/80 hover:text-white transition-colors">My Orders</a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 mt-8 pt-6 text-center text-white/40 text-xs">
          &copy; {new Date().getFullYear()} {biz.storeName || "KKR Groceries"}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
