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

  return (
    <BusinessContext.Provider value={{ biz, loading }}>
      {children}
    </BusinessContext.Provider>
  );
}
