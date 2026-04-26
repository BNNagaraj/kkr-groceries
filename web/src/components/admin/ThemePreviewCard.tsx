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
    const { id, name, description, featured } = preset;

    return (
        <button
            onClick={onClick}
            className={`relative text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                isActive
                    ? "border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20"
                    : featured
                        ? "border-emerald-200 bg-white hover:border-emerald-400 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
            }`}
        >
            {/* NEW ribbon — diagonal flag in the upper-left corner for featured presets */}
            {featured && !isActive && (
                <div
                    className="absolute -top-2 -left-2 z-10 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-[0.2em] uppercase shadow-sm"
                    style={{
                        background: "#059669",
                        color: "white",
                        transform: "rotate(-3deg)",
                    }}
                >
                    NEW
                </div>
            )}

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

                {/* Zen Garden: 3-col warm stone minimal cards */}
                {id === "zen" && (
                    <div className="grid grid-cols-3 gap-1.5 w-full" style={{ background: "#f7f5f0" }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[56px] flex flex-col overflow-hidden rounded" style={{ background: "#faf8f5", border: "1px solid #e8e4de" }}>
                                <div className="h-[40%]" style={{ background: "#e8e4dc", filter: "saturate(0.5)" }} />
                                <div className="flex-1 p-1 space-y-1">
                                    <div className="h-1 rounded-full w-3/4" style={{ background: "#d4cfc7" }} />
                                    <div className="h-1.5 rounded-full w-full" style={{ background: "#7c8c6e" }} />
                                    <div className="h-1.5 rounded-full w-4/5" style={{ background: "#c7c1b5" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Aurora: 3-col dark cards with aurora gradient glow */}
                {id === "aurora" && (
                    <div className="grid grid-cols-3 gap-1 w-full p-1 rounded" style={{ background: "#16162a" }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[52px] flex flex-col overflow-hidden rounded" style={{ background: "#1e1e36", border: "1px solid #2a2a4a" }}>
                                <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, #7c3aed, #06b6d4, #10b981)" }} />
                                <div className="h-[40%]" style={{ background: "#2a2a4a" }} />
                                <div className="flex-1 p-0.5 space-y-0.5">
                                    <div className="h-1 rounded-full w-3/4" style={{ background: "#3a3a5a" }} />
                                    <div className="h-1 rounded-full w-1/2" style={{ background: "linear-gradient(90deg, #7c3aed, #06b6d4)" }} />
                                    <div className="h-1.5 rounded-sm w-full" style={{ background: "#10b981" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Terracotta: 3-col warm clay cards with arch */}
                {id === "terracotta" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[56px] flex flex-col overflow-hidden rounded-lg" style={{ background: "#fdf6ee", border: "1px solid #e8d5c0" }}>
                                <div className="h-[45%] relative" style={{ background: "#e8d5c0" }}>
                                    <div className="absolute bottom-0 left-0 right-0 h-2" style={{ background: "#fdf6ee", borderRadius: "50% 50% 0 0" }} />
                                </div>
                                <div className="flex-1 p-0.5 space-y-0.5 flex flex-col items-center">
                                    <div className="h-1 rounded-full w-3/4" style={{ background: "#d5b396" }} />
                                    <div className="h-1.5 rounded w-full" style={{ background: "#c2703e" }} />
                                    <div className="h-1.5 rounded w-4/5" style={{ background: "#e5cdb6" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Sapphire Night: 2-col deep navy cards with silver */}
                {id === "sapphire" && (
                    <div className="grid grid-cols-2 gap-1.5 w-full p-1 rounded" style={{ background: "#0c1220" }}>
                        {[1, 2].map(i => (
                            <div key={i} className="h-[56px] flex p-1 gap-1 rounded" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                                <div className="w-[35%] rounded-sm shrink-0" style={{ background: "#1e293b" }} />
                                <div className="flex-1 flex flex-col gap-0.5 justify-between">
                                    <div className="h-1 rounded-full w-full" style={{ background: "#334155" }} />
                                    <div className="h-1 rounded-full w-2/3" style={{ background: "linear-gradient(90deg, #f1f5f9, #94a3b8)" }} />
                                    <div className="space-y-0.5">
                                        <div className="h-1.5 rounded-sm w-full" style={{ background: "#1e293b" }} />
                                        <div className="h-1.5 rounded-sm w-full" style={{ background: "#1e40af", boxShadow: "0 0 4px rgba(30,64,175,0.4)" }} />
                                    </div>
                                    <div className="h-2 rounded-sm w-full" style={{ background: "#1e40af" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Sakura Bloom: 3-col soft pink petal cards */}
                {id === "sakura" && (
                    <div className="grid grid-cols-3 gap-1 w-full" style={{ background: "#fff5f8" }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[56px] flex flex-col overflow-hidden rounded-lg" style={{ background: "linear-gradient(180deg, #fff5f8, #ffffff)", border: "1px solid #fce7f3" }}>
                                <div className="h-[40%]" style={{ background: "linear-gradient(135deg, #fce7f3, #fdf2f8)" }} />
                                <div className="flex-1 p-0.5 space-y-0.5">
                                    <div className="h-1 rounded-full w-3/4" style={{ background: "#fbcfe8" }} />
                                    <div className="h-1.5 w-full" style={{ background: "#ec4899", borderRadius: "8px 8px 8px 3px" }} />
                                    <div className="h-1.5 w-4/5" style={{ background: "#fce7f3", borderRadius: "8px 8px 8px 3px" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Mandi Chit: cream paper, ink stamp, ledger lines, perforated bottom */}
                {id === "mandichit" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="relative h-[56px] flex flex-col overflow-hidden p-1"
                                style={{
                                    background: "#f7f1e3",
                                    boxShadow: "inset 0 0 0 1px rgba(120,90,40,0.2)",
                                    clipPath:
                                        "polygon(0 0, 100% 0, 100% 88%, 92% 100%, 84% 88%, 76% 100%, 68% 88%, 60% 100%, 52% 88%, 44% 100%, 36% 88%, 28% 100%, 20% 88%, 12% 100%, 4% 88%, 0 100%)",
                                }}
                            >
                                {/* Tiny rotated ink stamp */}
                                <div
                                    className="absolute top-0.5 right-0.5 px-0.5 text-[5px] font-bold leading-none"
                                    style={{
                                        border: "1px solid #a83b1a",
                                        color: "#a83b1a",
                                        transform: "rotate(-7deg)",
                                        opacity: 0.7,
                                    }}
                                >
                                    LEAFY
                                </div>
                                {/* Header rule */}
                                <div className="h-[1px] w-3/5" style={{ background: "#7a5a20" }} />
                                {/* Big price */}
                                <div className="mt-1 h-2 w-1/2 rounded-sm" style={{ background: "#1a1612" }} />
                                {/* Dotted ledger lines */}
                                <div className="mt-1 space-y-[1px]">
                                    <div className="h-[1px] w-full" style={{ borderTop: "1px dotted #b8a060" }} />
                                    <div className="h-[1px] w-full" style={{ borderTop: "1px dotted #b8a060" }} />
                                </div>
                                {/* Black button with red shadow */}
                                <div
                                    className="mt-auto h-2 w-full"
                                    style={{
                                        background: "#1a1612",
                                        boxShadow: "1px 1px 0 #a83b1a",
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Daily Bulletin: serif headlines, double rules, italic prices, save stamp */}
                {id === "bulletin" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="relative h-[56px] flex flex-col overflow-hidden px-1 pt-0.5"
                                style={{
                                    background: "#fbfaf6",
                                    borderTop: "2px solid #1c1a17",
                                    borderBottom: "1px solid #d8d2c2",
                                    borderLeft: "1px solid #d8d2c2",
                                    borderRight: "1px solid #d8d2c2",
                                }}
                            >
                                {/* Masthead */}
                                <div className="h-[2px] w-full mb-0.5" />
                                {/* Headline (serif feel — slab bar) */}
                                <div className="h-1.5 w-3/4 rounded-sm" style={{ background: "#1c1a17", fontFamily: "serif" }} />
                                {/* Hairline */}
                                <div className="mt-0.5 h-[1px] w-full" style={{ background: "#d8d2c2" }} />
                                {/* Two-column body */}
                                <div className="mt-0.5 flex-1 flex gap-0.5 relative">
                                    <div className="absolute top-0 bottom-0 w-px" style={{ left: "calc(50% - 0.5px)", background: "#d8d2c2" }} />
                                    <div className="flex-1 flex items-center">
                                        <div className="h-1.5 w-2/3 italic rounded-sm" style={{ background: "#1c1a17" }} />
                                    </div>
                                    <div className="flex-1 space-y-[2px] flex flex-col justify-center">
                                        <div className="h-[1px] w-full" style={{ background: "#5a564c" }} />
                                        <div className="h-[1px] w-full" style={{ background: "#5a564c" }} />
                                    </div>
                                </div>
                                {/* Footer hairline */}
                                <div className="h-[1px] w-full mt-0.5" style={{ background: "#d8d2c2" }} />
                                {/* Circular save stamp */}
                                <div
                                    className="absolute bottom-1 right-1 w-3 h-3 rounded-full flex items-center justify-center text-[5px] font-bold leading-none"
                                    style={{
                                        border: "1px solid #b22222",
                                        color: "#b22222",
                                        background: "rgba(251,250,246,0.85)",
                                        transform: "rotate(-12deg)",
                                    }}
                                >
                                    ₹
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Produce Forward: full-bleed image, dark vignette, serif overlay */}
                {id === "produceforward" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[
                            { tint: "#3a1414", image: "linear-gradient(135deg, #c2382f, #8c1d18)" },
                            { tint: "#3a2614", image: "linear-gradient(135deg, #b8814a, #6b4520)" },
                            { tint: "#0f3a2c", image: "linear-gradient(135deg, #4a8c5a, #1f5c34)" },
                        ].map((p, i) => (
                            <div
                                key={i}
                                className="relative h-[56px] flex flex-col overflow-hidden rounded-md"
                                style={{ background: p.tint }}
                            >
                                {/* Full-bleed image area (top 65%) */}
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        background: p.image,
                                        height: "65%",
                                    }}
                                />
                                {/* Tiny save pill top-left */}
                                <div
                                    className="absolute top-0.5 left-0.5 w-3 h-1 rounded-full"
                                    style={{
                                        background: "rgba(0,0,0,0.32)",
                                        border: "1px solid rgba(255,255,255,0.18)",
                                    }}
                                />
                                {/* Vignette + content band */}
                                <div className="absolute bottom-0 left-0 right-0 px-1 pb-0.5 pt-2" style={{
                                    background: `linear-gradient(180deg, transparent, ${p.tint}cc 60%, ${p.tint})`,
                                }}>
                                    <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                        <div className="h-1 w-1/2 rounded-full" style={{ background: "#f1ede5" }} />
                                        <div className="h-1 w-1/4 rounded-full italic" style={{ background: "#f1ede5", fontStyle: "italic" }} />
                                    </div>
                                    <div className="h-1.5 w-full rounded-full" style={{ background: "#f1ede5" }} />
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
