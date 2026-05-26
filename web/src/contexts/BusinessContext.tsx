"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BusinessSettings, DEFAULT_BUSINESS } from "@/types/settings";

interface BusinessContextType {
  biz: BusinessSettings;
  loading: boolean;
}

const BusinessContext = createContext<BusinessContextType>({
  biz: DEFAULT_BUSINESS,
  loading: true,
});

export const useBusiness = () => useContext(BusinessContext);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [biz, setBiz] = useState<BusinessSettings>(DEFAULT_BUSINESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "business"),
      (snap) => {
        if (snap.exists()) {
          setBiz({ ...DEFAULT_BUSINESS, ...(snap.data() as Partial<BusinessSettings>) });
        }
        setLoading(false);
      },
      (err) => {
        console.warn("[BusinessContext] listen error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Sync favicon + apple-touch-icon + PWA manifest with uploaded logo
  useEffect(() => {
    if (!biz.logoUrl) return;

    // Update favicon & apple-touch-icon
    const setLink = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };
    setLink("icon", biz.logoUrl);
    setLink("apple-touch-icon", biz.logoUrl);

    // Update PWA manifest so "Add to Home Screen" uses the uploaded logo
    try {
      const manifest = {
        name: `${biz.storeName || "KKR Groceries"} - B2B Wholesale`,
        short_name: biz.storeName || "KKR Groceries",
        description: "Fresh vegetables at APMC wholesale prices for hotels, restaurants & retailers in Hyderabad.",
        start_url: "/",
        display: "standalone",
        theme_color: "#064e3b",
        background_color: "#f8fafc",
        orientation: "portrait-primary",
        icons: [
          { src: biz.logoUrl, sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: biz.logoUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        categories: ["food", "shopping", "business"],
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      setLink("manifest", url);
    } catch (e) {
      console.warn("[BusinessContext] manifest update failed:", e);
    }
  }, [biz.logoUrl, biz.storeName]);

  return (
    <BusinessContext.Provider value={{ biz, loading }}>
      {children}
    </BusinessContext.Provider>
  );
}
