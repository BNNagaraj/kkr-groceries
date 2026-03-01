"use client";

import React, { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useMode, AppMode } from "@/contexts/ModeContext";
import { FlaskConical, Globe, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ModeToggle() {
    const { mode } = useMode();
    const { currentUser } = useAuth();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [switching, setSwitching] = useState(false);

    const targetMode: AppMode = mode === "test" ? "real" : "test";
    const requiredPhrase = `start ${targetMode} mode`;

    const handleSwitch = async () => {
        if (confirmText.trim().toLowerCase() !== requiredPhrase) return;

        setSwitching(true);
        try {
            await setDoc(doc(db, "settings", "appMode"), {
                mode: targetMode,
                switchedAt: serverTimestamp(),
                switchedBy: currentUser?.email || "unknown",
            });
            toast.success(
                targetMode === "real"
                    ? "Switched to REAL MODE — you are now viewing production data."
                    : "Switched to TEST MODE — you are now viewing test data."
            );
            setDialogOpen(false);
            setConfirmText("");
        } catch (err) {
            console.error("[ModeToggle] Failed to switch:", err);
            toast.error("Failed to switch mode. Please try again.");
        } finally {
            setSwitching(false);
        }
    };

    return (
        <>
            <button
                onClick={() => { setDialogOpen(true); setConfirmText(""); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                    mode === "test"
                        ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                        : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                }`}
            >
                {mode === "test" ? (
                    <FlaskConical className="w-5 h-5" />
                ) : (
                    <Globe className="w-5 h-5" />
                )}
                <span className="text-sm font-bold uppercase tracking-wider">
                    {mode === "test" ? "Test Mode" : "Real Mode"}
                </span>
                <span className={`ml-auto w-2.5 h-2.5 rounded-full ${
                    mode === "test" ? "bg-amber-400" : "bg-emerald-400"
                }`} />
            </button>

            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className={`w-5 h-5 ${
                                targetMode === "real" ? "text-emerald-600" : "text-amber-600"
                            }`} />
                            Switch to {targetMode === "real" ? "Real" : "Test"} Mode
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 text-sm">
                                {targetMode === "real" ? (
                                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg">
                                        <p className="font-semibold mb-1">Switching to REAL MODE</p>
                                        <ul className="list-disc list-inside space-y-1 text-xs">
                                            <li>All orders, stock purchases, and accounts will show <strong>production data</strong></li>
                                            <li>New customer orders will be recorded as <strong>real orders</strong></li>
                                            <li>Test data will be preserved and accessible when you switch back</li>
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg">
                                        <p className="font-semibold mb-1">Switching to TEST MODE</p>
                                        <ul className="list-disc list-inside space-y-1 text-xs">
                                            <li>All orders, stock purchases, and accounts will show <strong>test data</strong></li>
                                            <li>New customer orders will be recorded as <strong>test orders</strong></li>
                                            <li>Real data will be preserved and accessible when you switch back</li>
                                        </ul>
                                    </div>
                                )}
                                <div>
                                    <p className="text-slate-600 mb-2">
                                        To confirm, type <strong className="text-slate-800 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{requiredPhrase}</strong> below:
                                    </p>
                                    <Input
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder={requiredPhrase}
                                        className="font-mono text-sm"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && confirmText.trim().toLowerCase() === requiredPhrase) {
                                                handleSwitch();
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button
                            onClick={handleSwitch}
                            disabled={confirmText.trim().toLowerCase() !== requiredPhrase || switching}
                            className={
                                targetMode === "real"
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-amber-600 hover:bg-amber-700"
                            }
                        >
                            {switching ? "Switching..." : `Switch to ${targetMode === "real" ? "Real" : "Test"} Mode`}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
