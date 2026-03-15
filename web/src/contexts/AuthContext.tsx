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
    agentStoreId: string | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    isAdmin: false,
    isDelivery: false,
    isAgent: false,
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
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                try {
                    const result = await user.getIdTokenResult();
                    setHasClaim(result.claims.admin === true);
                    setHasDeliveryClaim(result.claims.delivery === true);
                    setHasAgentClaim(result.claims.agent === true);
                    setAgentStoreId((result.claims.agentStoreId as string) || null);
                } catch {
                    setHasClaim(false);
                    setHasDeliveryClaim(false);
                    setHasAgentClaim(false);
                    setAgentStoreId(null);
                }
            } else {
                setHasClaim(false);
                setHasDeliveryClaim(false);
                setHasAgentClaim(false);
                setAgentStoreId(null);
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

    return (
        <AuthContext.Provider value={{ currentUser, isAdmin, isDelivery, isAgent, agentStoreId, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
