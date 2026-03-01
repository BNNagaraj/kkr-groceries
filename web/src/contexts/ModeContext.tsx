"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AppMode = "real" | "test";

interface ModeContextType {
    mode: AppMode;
    loading: boolean;
    /** Resolves a base collection name to the mode-specific name */
    col: (baseName: string) => string;
}

const ModeContext = createContext<ModeContextType>({
    mode: "test",
    loading: true,
    col: (name) => name,
});

export const useMode = () => useContext(ModeContext);

/** Collections that get a "test_" prefix when in test mode */
const NAMESPACED = new Set([
    "orders",
    "stockPurchases",
    "accountEntries",
    "notifications",
]);

function resolveCollection(baseName: string, mode: AppMode): string {
    if (mode === "test" && NAMESPACED.has(baseName)) {
        return `test_${baseName}`;
    }
    return baseName;
}

export function ModeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<AppMode>("test");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, "settings", "appMode"),
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    setMode(data.mode === "real" ? "real" : "test");
                } else {
                    setMode("test");
                }
                setLoading(false);
            },
            (err) => {
                console.warn("[ModeContext] Failed to listen to appMode:", err.message);
                setMode("test");
                setLoading(false);
            }
        );
        return unsub;
    }, []);

    const col = (baseName: string) => resolveCollection(baseName, mode);

    return (
        <ModeContext.Provider value={{ mode, loading, col }}>
            {children}
        </ModeContext.Provider>
    );
}
