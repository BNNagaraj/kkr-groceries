"use client";

import React from "react";
import type { ThemePreset } from "@/lib/theme-defaults";

/**
 * Mini layout preview showing the card arrangement for each theme.
 * Uses CSS-only rectangles to illustrate the layout pattern.
 */
export function ThemePreviewCard({
    preset,
    isActive,
    onClick,
}: {
    preset: ThemePreset;
    isActive: boolean;
    onClick: () => void;
}) {
    const { id, name, description } = preset;

    return (
        <button
            onClick={onClick}
            className={`relative text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                isActive
                    ? "border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
            }`}
        >
            {/* Active check */}
            {isActive && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            )}

            {/* Layout illustration */}
            <div className="h-[80px] bg-slate-100 rounded-lg p-2 mb-3 flex items-center justify-center overflow-hidden">
                {id === "classic" && (
                    <div className="grid grid-cols-4 gap-1 w-full">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-emerald-200 rounded h-[56px] flex flex-col p-1 gap-0.5">
                                <div className="w-3 h-3 bg-emerald-400 rounded-sm shrink-0" />
                                <div className="flex-1 space-y-0.5">
                                    <div className="h-1 bg-emerald-300 rounded-full w-full" />
                                    <div className="h-1 bg-emerald-300 rounded-full w-3/4" />
                                </div>
                                <div className="h-2 bg-emerald-500 rounded-sm w-full" />
                            </div>
                        ))}
                    </div>
                )}
                {id === "premium" && (
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-emerald-200 rounded h-[56px] flex p-1 gap-1">
                                <div className="w-[40%] bg-emerald-400 rounded-sm shrink-0" />
                                <div className="flex-1 flex flex-col gap-0.5 justify-between">
                                    <div className="h-1 bg-emerald-300 rounded-full w-full" />
                                    <div className="space-y-0.5">
                                        <div className="h-1.5 bg-emerald-300 rounded-sm w-full" />
                                        <div className="h-1.5 bg-emerald-400 rounded-sm w-full" />
                                        <div className="h-1.5 bg-emerald-500 rounded-sm w-full" />
                                    </div>
                                    <div className="h-2 bg-emerald-500 rounded-sm w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {id === "catalog" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-emerald-200 rounded h-[56px] flex flex-col overflow-hidden">
                                <div className="h-[50%] bg-emerald-400" />
                                <div className="flex-1 p-0.5 space-y-0.5">
                                    <div className="h-1 bg-emerald-300 rounded-full w-3/4" />
                                    <div className="h-1 bg-emerald-300 rounded-full w-1/2" />
                                    <div className="h-1.5 bg-emerald-500 rounded-sm w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Name & Description */}
            <h4 className={`font-bold text-sm ${isActive ? "text-emerald-800" : "text-slate-800"}`}>
                {name}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {description}
            </p>
        </button>
    );
}
