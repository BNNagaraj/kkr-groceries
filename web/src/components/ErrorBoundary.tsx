"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    errorMessage: string;
}

/** Detect chunk-load / lazy-import failures (stale deployment cache) */
function isChunkLoadError(error: Error): boolean {
    const msg = error.message || "";
    return (
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        (error.name === "ChunkLoadError")
    );
}

const RELOAD_KEY = "kkr_chunk_reload";

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, errorMessage: "" };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, errorMessage: error.message || "" };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("ErrorBoundary caught:", error, errorInfo);

        // Auto-reload once for stale chunk errors (new deployment, old cached HTML)
        if (isChunkLoadError(error)) {
            const lastReload = sessionStorage.getItem(RELOAD_KEY);
            const now = Date.now();
            // Only auto-reload if we haven't done so in the last 30 seconds
            // (prevents infinite reload loops)
            if (!lastReload || now - Number(lastReload) > 30_000) {
                sessionStorage.setItem(RELOAD_KEY, String(now));
                window.location.reload();
                return;
            }
        }
    }

    render() {
        if (this.state.hasError) {
            const isChunk = this.state.errorMessage.includes("Loading chunk") ||
                this.state.errorMessage.includes("dynamically imported module");

            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
                    <div className="text-center max-w-md">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-slate-500 mb-6">
                            {isChunk
                                ? this.state.errorMessage
                                : "We encountered an unexpected error. Please try refreshing the page."}
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, errorMessage: "" });
                                window.location.reload();
                            }}
                            className="bg-[#064e3b] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#065f46] transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
