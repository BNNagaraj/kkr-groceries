"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Download, X, Share2 } from "lucide-react";

/**
 * PWA Install Banner — prompts mobile users to install the web app
 * to their home screen, eliminating the need for APK distribution.
 *
 * Uses the `beforeinstallprompt` event on Chrome/Android and
 * shows Safari-specific instructions on iOS.
 */

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    prompt(): Promise<void>;
}

export function InstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if already installed as PWA
        const standalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        setIsStandalone(standalone);
        if (standalone) return;

        // Check if user dismissed recently (24-hour cooldown)
        const lastDismissed = localStorage.getItem("kkr_install_dismissed");
        if (lastDismissed && Date.now() - Number(lastDismissed) < 24 * 60 * 60 * 1000) {
            setDismissed(true);
            return;
        }

        // Detect iOS
        const ua = navigator.userAgent;
        const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        setIsIOS(isiOS);

        // On iOS, show the banner after a short delay
        if (isiOS) {
            const timer = setTimeout(() => setShowBanner(true), 3000);
            return () => clearTimeout(timer);
        }

        // Chrome/Android: listen for the beforeinstallprompt event
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Show banner after a short delay so page loads first
            setTimeout(() => setShowBanner(true), 2000);
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            setShowBanner(false);
        }
        setDeferredPrompt(null);
    }, [deferredPrompt]);

    const handleDismiss = useCallback(() => {
        setShowBanner(false);
        setDismissed(true);
        localStorage.setItem("kkr_install_dismissed", String(Date.now()));
    }, []);

    // Don't render if: already installed, user dismissed, or banner not triggered
    if (isStandalone || dismissed || !showBanner) return null;

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 animate-slide-up"
        >
            <div
                className="max-w-lg mx-auto rounded-2xl shadow-2xl border overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #fff8ef 0%, #ffffff 100%)",
                    borderColor: "#e0b06a",
                    boxShadow: "0 -4px 30px rgba(180,120,40,0.15), 0 8px 30px rgba(0,0,0,0.12)",
                }}
            >
                {/* Close button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="px-5 py-4 flex items-center gap-4">
                    {/* App icon */}
                    <img
                        src="/icon-192.png"
                        alt="KKR Groceries"
                        className="w-14 h-14 rounded-xl shadow-md shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-slate-800 text-[15px] leading-tight">
                            Install KKR Groceries
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                            {isIOS
                                ? "Tap the share button below, then \"Add to Home Screen\""
                                : "Add to home screen for quick access — no app store needed!"
                            }
                        </p>
                    </div>

                    {/* Action button */}
                    {isIOS ? (
                        <div className="shrink-0 flex flex-col items-center gap-1">
                            <Share2 className="w-6 h-6 text-[#007AFF]" />
                            <span className="text-[10px] text-[#007AFF] font-semibold">Share</span>
                        </div>
                    ) : (
                        <button
                            onClick={handleInstall}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all"
                            style={{
                                background: "linear-gradient(135deg, #F7941D 0%, #E88A15 100%)",
                                boxShadow: "0 4px 12px rgba(247,148,29,0.35)",
                            }}
                        >
                            <Download className="w-4 h-4" />
                            Install
                        </button>
                    )}
                </div>
            </div>

        </div>
    );
}
