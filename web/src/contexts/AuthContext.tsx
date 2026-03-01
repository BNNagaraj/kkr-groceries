"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { usePresence } from "@/hooks/usePresence";

interface AuthContextType {
    currentUser: User | null;
    isAdmin: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    isAdmin: false,
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
                } catch {
                    setHasClaim(false);
                }
            } else {
                setHasClaim(false);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Presence tracking — writes heartbeat to Firestore presence collection
    usePresence(currentUser);

    const isAdmin = hasClaim || (
        currentUser?.email
            ? adminEmails.includes(currentUser.email.toLowerCase())
            : false
    );

    return (
        <AuthContext.Provider value={{ currentUser, isAdmin, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
