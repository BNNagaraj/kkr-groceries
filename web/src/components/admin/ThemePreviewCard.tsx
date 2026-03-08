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
                {/* Classic: 4-col compact horizontal cards */}
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

                {/* Premium: 2-col horizontal with tier rows */}
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

                {/* Catalog: 3-col image-on-top */}
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

                {/* Elegant: 3-col padded image with floating badge */}
                {id === "elegant" && (
                    <div className="grid grid-cols-3 gap-1.5 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded shadow-sm h-[56px] flex flex-col overflow-hidden p-1">
                                <div className="relative flex-1 bg-emerald-100 rounded">
                                    <div className="absolute bottom-0.5 right-0.5 w-3 h-1.5 bg-white/80 rounded-sm border border-emerald-200" />
                                </div>
                                <div className="mt-0.5 space-y-0.5">
                                    <div className="h-1 bg-slate-200 rounded-full w-3/4" />
                                    <div className="h-1.5 bg-emerald-400 rounded-sm w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Storefront: 2-col horizontal with left accent strip */}
                {id === "storefront" && (
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-white rounded h-[56px] flex overflow-hidden shadow-sm">
                                <div className="w-1 bg-orange-400 shrink-0" />
                                <div className="w-[30%] bg-emerald-200 shrink-0" />
                                <div className="flex-1 p-1 flex flex-col justify-between">
                                    <div className="h-1 bg-slate-200 rounded-full w-3/4" />
                                    <div className="h-3 bg-emerald-500 rounded-sm w-2/3 self-start" />
                                    <div className="h-2 bg-emerald-600 rounded-sm w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Magazine: 3-col full-bleed image with gradient overlay */}
                {id === "magazine" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rounded h-[56px] flex flex-col overflow-hidden relative">
                                <div className="h-[65%] bg-emerald-400" />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-800 to-transparent h-[50%]" />
                                <div className="absolute bottom-1 left-1 right-1 space-y-0.5">
                                    <div className="h-1 bg-white/80 rounded-full w-2/3" />
                                    <div className="h-1 bg-white/50 rounded-full w-1/3" />
                                </div>
                                <div className="flex-1 bg-emerald-200 p-0.5">
                                    <div className="h-1.5 bg-emerald-500 rounded-sm w-full mt-0.5" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ListPro: single-column compact rows */}
                {id === "listpro" && (
                    <div className="w-full space-y-0.5">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-white h-[12px] flex items-center gap-1 px-1 border-b border-slate-200">
                                <div className="w-2 h-2 bg-emerald-300 rounded-sm shrink-0" />
                                <div className="h-1 bg-slate-200 rounded-full flex-1" />
                                <div className="h-1 bg-emerald-400 rounded-full w-4 shrink-0" />
                                <div className="h-1.5 bg-emerald-500 rounded-sm w-5 shrink-0" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Metro: 3-col tiles with color header band */}
                {id === "metro" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white border border-slate-200 h-[56px] flex flex-col overflow-hidden">
                                <div className="h-2.5 bg-emerald-500 px-0.5 flex items-center">
                                    <div className="h-0.5 bg-white/60 rounded-full w-2/3" />
                                </div>
                                <div className="h-[40%] bg-emerald-100" />
                                <div className="flex-1 p-0.5 space-y-0.5">
                                    <div className="h-1 bg-slate-200 rounded-full w-1/2" />
                                    <div className="h-1.5 bg-emerald-400 rounded-sm w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Polaroid: 3-col tilted photo cards with thick white border */}
                {id === "polaroid" && (
                    <div className="grid grid-cols-3 gap-2 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white shadow-md h-[56px] flex flex-col p-1 pb-2" style={{ transform: `rotate(${i === 2 ? -2 : i === 1 ? 1 : -1}deg)` }}>
                                <div className="flex-1 bg-emerald-200 relative">
                                    <div className="absolute bottom-0 right-0 w-4 h-2 bg-amber-100 border border-amber-200 text-[4px] flex items-center justify-center font-bold">₹</div>
                                </div>
                                <div className="mt-0.5 space-y-0.5">
                                    <div className="h-0.5 bg-slate-200 rounded-full w-3/4" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Glass: 3-col frosted glass cards */}
                {id === "glass" && (
                    <div className="grid grid-cols-3 gap-1 w-full" style={{ background: "linear-gradient(135deg, #e0e7ff 0%, #dbeafe 50%, #ede9fe 100%)" }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[56px] flex flex-col overflow-hidden rounded p-0.5" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.6)" }}>
                                <div className="flex-1 rounded-sm bg-white/30" />
                                <div className="mt-0.5 space-y-0.5 px-0.5">
                                    <div className="h-1 bg-white/50 rounded-full w-3/4" />
                                    <div className="h-1.5 bg-emerald-400/60 rounded-full w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* DarkLuxe: 3-col dark cards with gold accent */}
                {id === "darkluxe" && (
                    <div className="grid grid-cols-3 gap-1 w-full bg-slate-800 p-1 rounded">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-slate-900 rounded h-[52px] flex flex-col overflow-hidden">
                                <div className="h-[45%] bg-slate-700" />
                                <div className="flex-1 p-0.5 space-y-0.5">
                                    <div className="h-1 bg-slate-600 rounded-full w-3/4" />
                                    <div className="h-1 bg-amber-400 rounded-full w-1/2" />
                                    <div className="h-1.5 bg-emerald-500 rounded-sm w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Editorial: 3-col dashed border newspaper cards */}
                {id === "editorial" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-amber-50/50 border border-dashed border-slate-300 h-[56px] flex flex-col overflow-hidden">
                                <div className="px-0.5 pt-0.5">
                                    <div className="h-0.5 bg-red-400 rounded-full w-1/3" />
                                </div>
                                <div className="h-[40%] bg-slate-200 mx-0.5 mt-0.5 grayscale" />
                                <div className="flex-1 p-0.5 space-y-0.5 border-t border-dotted border-slate-300 mt-0.5">
                                    <div className="h-1 bg-slate-400 rounded-full w-3/4" />
                                    <div className="h-1 bg-slate-800 rounded-full w-1/2 font-serif" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* NeonPop: 3-col gradient-bordered vibrant cards */}
                {id === "neonpop" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[56px] rounded p-[1.5px]" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)" }}>
                                <div className="bg-white rounded-[calc(0.25rem-1.5px)] h-full flex flex-col overflow-hidden">
                                    <div className="h-[45%] bg-gradient-to-br from-purple-100 to-pink-100" />
                                    <div className="flex-1 p-0.5 space-y-0.5">
                                        <div className="h-1 bg-slate-200 rounded-full w-3/4" />
                                        <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full w-1/2" />
                                    </div>
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
