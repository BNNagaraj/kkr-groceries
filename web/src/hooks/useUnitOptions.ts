"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UNIT_OPTIONS } from "@/lib/constants";

/**
 * Merges the built-in UNIT_OPTIONS with any custom units stored
 * in Firestore `settings/units`.  Returns a deduplicated, sorted list
 * plus helpers to add / remove custom entries.
 */
export function useUnitOptions() {
    const [customUnits, setCustomUnits] = useState<string[]>([]);

    // Real-time listener on settings/units
    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, "settings", "units"),
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    setCustomUnits(Array.isArray(data.custom) ? data.custom : []);
                }
            },
            (err) => console.warn("[useUnitOptions] listener error:", err.message),
        );
        return unsub;
    }, []);

    // Merged & deduplicated list
    const allUnits = useMemo(() => {
        const set = new Set([...UNIT_OPTIONS, ...customUnits]);
        return Array.from(set);
    }, [customUnits]);

    /** Persist a new custom unit to Firestore */
    const addUnit = useCallback(async (unit: string) => {
        const trimmed = unit.trim();
        if (!trimmed) return;
        const updated = Array.from(new Set([...customUnits, trimmed]));
        await setDoc(doc(db, "settings", "units"), { custom: updated }, { merge: true });
    }, [customUnits]);

    /** Remove a custom unit (built-in units cannot be removed) */
    const removeUnit = useCallback(async (unit: string) => {
        if (UNIT_OPTIONS.includes(unit)) return; // can't remove built-in
        const updated = customUnits.filter((u) => u !== unit);
        await setDoc(doc(db, "settings", "units"), { custom: updated }, { merge: true });
    }, [customUnits]);

    return { units: allUnits, customUnits, addUnit, removeUnit };
}
