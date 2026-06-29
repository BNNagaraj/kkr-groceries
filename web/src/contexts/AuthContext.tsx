"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { usePresence } from "@/hooks/usePresence";

interface AuthContextType {
    currentUser: User | null;
    isAdmin: boolean;
    isDelivery: boolean;
    isAgent: boolean;
    isHoreca: boolean;
    agentStoreId: string | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    isAdmin: false,
    isDelivery: false,
    isAgent: false,
    isHoreca: false,
    agentStoreId: null,
    loading: true,
});

const FALLBACK_ADMIN_EMAILS = [
    "raju2uraju@gmail.com",
    "kanthati.chakri@gmail.com",
];

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [adminEmails, setAdminEmails] = useState<string[]>(FALLBACK_ADMIN_EMAILS);
    const [hasClaim, setHasClaim] = useState(false);
    const [hasDeliveryClaim, setHasDeliveryClaim] = useState(false);
    const [hasAgentClaim, setHasAgentClaim] = useState(false);
    const [hasHorecaClaim, setHasHorecaClaim] = useState(false);
    const [agentStoreId, setAgentStoreId] = useState<string | null>(null);

    // Listen to Firestore settings/admins for dynamic admin list
    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, "settings", "admins"),
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    if (Array.isArray(data.emails) && data.emails.length > 0) {
                        setAdminEmails(data.emails.map((e: string) => e.toLowerCase()));
                    }
                }
            },
            (err) => {
                console.warn("Could not listen to settings/admins:", err.message);
            }
        );
        return unsub;
    }, []);

    // Auth state + custom claims check
    useEffect(() => {
        const applyClaims = (claims: Record<string, unknown>) => {
            setHasClaim(claims.admin === true);
            setHasDeliveryClaim(claims.delivery === true);
            setHasAgentClaim(claims.agent === true);
            setHasHorecaClaim(claims.horeca === true);
            setAgentStoreId((claims.agentStoreId as string) || null);
        };
        const resetClaims = () => {
            setHasClaim(false);
            setHasDeliveryClaim(false);
            setHasAgentClaim(false);
            setHasHorecaClaim(false);
            setAgentStoreId(null);
        };

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                try {
                    // 1. Fast path: cached token for instant first render
                    const cached = await user.getIdTokenResult();
                    applyClaims(cached.claims);
                } catch {
                    resetClaims();
                } finally {
                    setLoading(false);
                }

                // 2. Authoritative: force-refresh so claims granted server-side
                //    after sign-in (e.g. HORECA approval) take effect without
                //    requiring sign out/in. Failures here (e.g. transient network)
                //    must NOT wipe the valid cached claims applied above.
                try {
                    const fresh = await user.getIdTokenResult(true);
                    applyClaims(fresh.claims);
                } catch {
                    /* keep cached claims */
                }
            } else {
                resetClaims();
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const isDelivery = hasDeliveryClaim;

    // Presence tracking — writes heartbeat to Firestore presence collection
    // Pass delivery role so GPS coordinates are included for delivery boys
    usePresence(currentUser, isDelivery ? "delivery" : undefined);

    const isAdmin = hasClaim || (
        currentUser?.email
            ? adminEmails.includes(currentUser.email.toLowerCase())
            : false
    );

    const isAgent = hasAgentClaim;
    const isHoreca = hasHorecaClaim;

    return (
        <AuthContext.Provider value={{ currentUser, isAdmin, isDelivery, isAgent, isHoreca, agentStoreId, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
