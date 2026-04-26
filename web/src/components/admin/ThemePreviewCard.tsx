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
                                <div className="absolute inset-0" style={{ background: p.image, height: "65%" }} />
                                <div className="absolute top-0.5 left-0.5 w-3 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.32)", border: "1px solid rgba(255,255,255,0.18)" }} />
                                <div className="absolute bottom-0 left-0 right-0 px-1 pb-0.5 pt-2" style={{ background: `linear-gradient(180deg, transparent, ${p.tint}cc 60%, ${p.tint})` }}>
                                    <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                        <div className="h-1 w-1/2 rounded-full" style={{ background: "#f1ede5" }} />
                                        <div className="h-1 w-1/4 rounded-full italic" style={{ background: "#f1ede5" }} />
                                    </div>
                                    <div className="h-1.5 w-full rounded-full" style={{ background: "#f1ede5" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Chalkboard: black slate, chalked price circle, drawn arrow, yellow CTA */}
                {id === "chalkboard" && (
                    <div className="grid grid-cols-2 gap-1 w-full">
                        {[1, 2].map(i => (
                            <div key={i} className="relative h-[56px] flex flex-col p-1" style={{ background: "#1c1f1c", border: "2px solid #5e3a1f" }}>
                                <div className="text-[5px] uppercase tracking-widest font-bold mb-0.5" style={{ color: "#ffd166" }}>Today</div>
                                <div className="flex items-center gap-1 mb-0.5">
                                    <div className="w-3 h-3 rounded-full border" style={{ borderColor: "#f5f1e8", borderStyle: "dashed" }} />
                                    <div className="h-1 flex-1 rounded-full" style={{ background: "#f5f1e8" }} />
                                </div>
                                <div className="space-y-[1px]">
                                    <div className="h-[1px] w-full" style={{ borderTop: "1px dashed rgba(245,241,232,0.4)" }} />
                                    <div className="h-[1px] w-full" style={{ borderTop: "1px dashed rgba(245,241,232,0.4)" }} />
                                </div>
                                <div className="mt-auto h-2 w-full rounded-sm" style={{ background: "#ffd166", border: "1px solid #f5f1e8" }} />
                            </div>
                        ))}
                    </div>
                )}

                {/* Risograph: 2-color overprint with halftone, blocky split header */}
                {id === "risograph" && (
                    <div className="grid grid-cols-2 gap-1 w-full">
                        {[1, 2].map(i => (
                            <div key={i} className="relative h-[56px] flex flex-col" style={{ background: "#f5efe0", border: "2px solid #1d4e89", boxShadow: "2px 2px 0 #ff48b0" }}>
                                <div className="flex h-2 border-b-2" style={{ borderColor: "#1d4e89" }}>
                                    <div className="w-1/3" style={{ background: "#1d4e89" }} />
                                    <div className="flex-1" />
                                </div>
                                <div className="flex gap-1 px-1 pt-1 flex-1">
                                    <div className="w-3 h-3 rounded-sm" style={{ background: "#ff48b0", border: "1px solid #1d4e89" }} />
                                    <div className="flex-1 space-y-[1.5px]">
                                        <div className="h-1 w-3/4 rounded-sm" style={{ background: "#1d4e89" }} />
                                        <div className="h-1 w-1/2 rounded-sm" style={{ background: "#ff48b0" }} />
                                    </div>
                                </div>
                                <div className="px-1 pb-0.5">
                                    <div className="h-1.5 w-2/3" style={{ background: "#1d4e89" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Trading Card: holographic conic border, dark stat block */}
                {id === "tradingcard" && (
                    <div className="grid grid-cols-2 gap-1 w-full">
                        {[1, 2].map(i => (
                            <div key={i} className="relative h-[56px] p-[1.5px] rounded"
                                style={{ background: "conic-gradient(from 0deg, #ff48b0, #06b6d4, #facc15, #22c55e, #ff48b0)" }}>
                                <div className="h-full flex flex-col rounded-[2px] overflow-hidden" style={{ background: "linear-gradient(160deg, #0f172a, #1e293b)" }}>
                                    <div className="h-[8px]" style={{ background: "linear-gradient(90deg, #22c55e, #22c55e99)" }} />
                                    <div className="flex-1 grid grid-cols-2">
                                        <div style={{ background: "#1e293b" }} />
                                        <div className="p-0.5 flex flex-col justify-center space-y-[1.5px]">
                                            <div className="h-[2px] w-3/4 rounded-full" style={{ background: "#22c55e" }} />
                                            <div className="h-[1px] w-1/2 rounded-full" style={{ background: "#cbd5e1" }} />
                                        </div>
                                    </div>
                                    <div className="h-2 mx-1 mb-0.5 rounded-sm" style={{ background: "#22c55e" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* BrutalistSlab: concrete grey, monolith with massive bottom black slab */}
                {id === "brutalistslab" && (
                    <div className="grid grid-cols-2 gap-1 w-full">
                        {[1, 2].map(i => (
                            <div key={i} className="relative h-[56px] flex flex-col" style={{ background: "#c8c2b6" }}>
                                <div className="h-2 px-1 flex items-center" style={{ background: "#0a0a0a" }}>
                                    <div className="h-[1px] w-2/3 rounded-full" style={{ background: "#c8c2b6" }} />
                                </div>
                                <div className="flex flex-1 px-1 pt-1 gap-1">
                                    <div className="w-4" style={{ background: "#0a0a0a" }} />
                                    <div className="flex-1 flex flex-col justify-end space-y-[1.5px] pb-0.5">
                                        <div className="h-2 w-full" style={{ background: "#0a0a0a" }} />
                                        <div className="h-1 w-2/3" style={{ background: "#3a3a3a" }} />
                                    </div>
                                </div>
                                <div style={{ height: 2, background: "#0a0a0a" }} />
                                <div className="h-3 px-1 flex items-center justify-between" style={{ background: "#0a0a0a" }}>
                                    <div className="h-2 w-1/3" style={{ background: "#c8c2b6" }} />
                                    <div className="h-1 w-1/4" style={{ background: "#c8c2b6", opacity: 0.5 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* BazaarPoster: saturated yellow with red scalloped banner + circular photo */}
                {id === "bazaarposter" && (
                    <div className="grid grid-cols-2 gap-1 w-full">
                        {[1, 2].map(i => (
                            <div key={i} className="relative h-[56px] flex flex-col p-1" style={{ background: "#fef3c7", border: "2px solid #7f1d1d", boxShadow: "2px 2px 0 #dc2626" }}>
                                <div className="h-2 -mx-1 -mt-1 mb-0.5 px-1 flex items-center justify-center"
                                    style={{ background: "#dc2626", color: "#fef3c7", fontSize: "5px", fontWeight: 700, letterSpacing: "0.15em" }}>
                                    ★ FRESH ★
                                </div>
                                <div className="flex gap-1 items-center mt-0.5">
                                    <div className="w-4 h-4 rounded-full" style={{ background: "#dc2626", border: "1px solid #7f1d1d" }} />
                                    <div className="flex-1 h-2 italic rounded-sm" style={{ background: "#7f1d1d" }} />
                                </div>
                                <div className="mt-auto self-center px-1 py-0.5 mb-0.5"
                                    style={{ background: "#fef3c7", border: "1px dashed #7f1d1d", transform: "rotate(-2deg)" }}>
                                    <div className="h-1.5 w-6 italic rounded-sm" style={{ background: "#dc2626" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Apothecary: cream linen with ornate frame, italic Latin name */}
                {id === "apothecary" && (
                    <div className="grid grid-cols-2 gap-1 w-full">
                        {[1, 2].map(i => (
                            <div key={i} className="relative h-[56px] flex flex-col p-1" style={{
                                background: "#f5ecd6",
                                border: "1px solid #c9a978",
                                boxShadow: "inset 0 0 0 2px #f5ecd6, inset 0 0 0 3px #8b6f3a, inset 0 0 0 5px #f5ecd6",
                            }}>
                                <div className="text-center text-[5px] uppercase tracking-widest font-bold mt-0.5" style={{ color: "#8b6f3a" }}>
                                    ❦ Dispensary ❦
                                </div>
                                <div className="my-0.5 mx-1 h-px relative" style={{ background: "#8b6f3a" }}>
                                    <span className="absolute left-1/2 -translate-x-1/2 -translate-y-[2px] text-[4px]" style={{ color: "#8b6f3a" }}>◆</span>
                                </div>
                                <div className="flex-1 px-1 italic" style={{ color: "#3a2818", fontFamily: "serif" }}>
                                    <div className="h-1.5 w-3/4 rounded-sm" style={{ background: "#3a2818" }} />
                                    <div className="h-[3px] w-1/2 rounded-sm mt-0.5" style={{ background: "#5a3e22" }} />
                                </div>
                                <div className="px-1 pb-0.5 flex items-baseline justify-between">
                                    <div className="text-[4px] uppercase tracking-widest" style={{ color: "#8b6f3a" }}>℞</div>
                                    <div className="h-1.5 w-1/3 italic rounded-sm" style={{ background: "#3a2818" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* PostalStamp: perforated edge, denomination block, postmark */}
                {id === "postalstamp" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="relative h-[56px] flex flex-col p-1.5" style={{
                                background: "#f3ead4",
                                border: "1px dashed #3d281733",
                                outline: "1px solid #3d2817",
                                outlineOffset: "-3px",
                            }}>
                                <div className="text-[5px] uppercase tracking-widest font-bold mb-0.5" style={{ color: "#3d2817" }}>
                                    BHARAT · POST
                                </div>
                                <div className="absolute top-1 right-1 px-1 py-0.5 text-[5px] font-bold" style={{ background: "#3d2817", color: "#f3ead4" }}>
                                    ₹20
                                </div>
                                <div className="flex-1 relative" style={{ background: "#ddd0aa", border: "1px solid #3d2817" }}>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-5 h-5 rounded-full opacity-60"
                                            style={{ border: "1.5px solid #7a3015", transform: "rotate(-22deg)" }} />
                                    </div>
                                </div>
                                <div className="text-center mt-0.5">
                                    <div className="h-1 w-3/4 mx-auto rounded-sm" style={{ background: "#3d2817" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* MemoSticky: yellow sticky note, tilted, with curl shadow corner */}
                {id === "memosticky" && (
                    <div className="grid grid-cols-3 gap-2 w-full">
                        {[-1, 0.5, -0.5].map((tilt, i) => (
                            <div key={i} className="relative h-[56px] flex flex-col p-1" style={{
                                background: "#fff48d",
                                color: "#0b3a7a",
                                transform: `rotate(${tilt}deg)`,
                                boxShadow: "1px 2px 4px rgba(60,40,0,0.18)",
                                clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
                            }}>
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5"
                                    style={{ background: "linear-gradient(135deg, transparent 50%, rgba(60,40,0,0.18) 50%)" }} />
                                <div className="text-[5px] mb-0.5 italic" style={{ color: "#0b3a7a", borderBottom: "1px solid #0b3a7a55" }}>
                                    for cart →
                                </div>
                                <div className="flex gap-1 mt-0.5">
                                    <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(11,58,122,0.08)", border: "1.5px solid #0b3a7a" }} />
                                    <div className="flex-1 h-1.5 rounded-sm" style={{ background: "#0b3a7a" }} />
                                </div>
                                <div className="mt-auto self-start relative">
                                    <div className="absolute -inset-x-0.5 -inset-y-0.5 rounded-sm" style={{ background: "#ffe356" }} />
                                    <div className="relative h-1.5 w-5 rounded-sm" style={{ background: "#0b3a7a" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* PeriodicElement: atomic cell with big symbol, gridded sub-cells */}
                {id === "periodicelement" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[
                            { tint: "#16a34a", sym: "Lf" },
                            { tint: "#dc2626", sym: "Fr" },
                            { tint: "#a16207", sym: "Rt" },
                        ].map((p, i) => (
                            <div key={i} className="relative h-[56px] flex flex-col p-1" style={{
                                background: "#fafaf7",
                                border: `1.5px solid ${p.tint}`,
                                fontFamily: "monospace",
                            }}>
                                <div className="flex items-start justify-between text-[5px]">
                                    <span style={{ color: "#0a0a0a", opacity: 0.5 }}>0{i + 1}</span>
                                    <span className="px-0.5" style={{ background: p.tint, color: "#fafaf7", fontWeight: 700 }}>{p.sym}</span>
                                </div>
                                <div className="text-center text-[18px] leading-none font-bold tabular-nums mt-0.5"
                                    style={{ color: p.tint, fontFamily: "monospace" }}>
                                    {p.sym}
                                </div>
                                <div className="text-center text-[5px] uppercase tracking-widest font-bold mt-0.5" style={{ color: "#0a0a0a" }}>
                                    Item
                                </div>
                                <div className="mt-auto grid grid-cols-2 gap-px" style={{ background: `${p.tint}33`, padding: 0.5 }}>
                                    <div className="h-1.5" style={{ background: p.tint }} />
                                    <div className="h-1.5" style={{ background: "#fafaf7" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* HairlineModern: pure white, 1px border, generous whitespace, restraint */}
                {id === "hairlinemodern" && (
                    <div className="grid grid-cols-3 gap-1.5 w-full">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="relative h-[56px] flex flex-col" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
                                <div style={{ height: "55%", background: "#f8fafc" }} />
                                <div className="flex-1 px-1.5 pt-1 flex flex-col justify-between">
                                    <div className="h-[2px] w-2/3 rounded-full" style={{ background: "#0f172a" }} />
                                    <div className="flex items-baseline gap-0.5">
                                        <div className="h-2 w-1/3 rounded-sm" style={{ background: "#0f172a" }} />
                                        <div className="h-[2px] w-1/4 rounded-full" style={{ background: "#94a3b8" }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* TruckArt Tailgate: marigold panel with red+blue+yellow chevron header, mirror medallion */}
                {id === "truckarttailgate" && (
                    <div className="grid grid-cols-2 gap-1 w-full">
                        {[1, 2].map(i => (
                            <div
                                key={i}
                                className="relative h-[56px] flex flex-col overflow-hidden"
                                style={{
                                    background: "#fbbf24",
                                    border: "2px solid #7f1d1d",
                                    boxShadow: "inset 0 0 0 1px #fbbf24, inset 0 0 0 2px #1e40af",
                                }}
                            >
                                {/* Chevron header */}
                                <div
                                    className="h-2 w-full"
                                    style={{
                                        backgroundImage: `repeating-linear-gradient(90deg, #dc2626 0 4px, #fbbf24 4px 8px, #1e40af 8px 12px, #fbbf24 12px 16px)`,
                                    }}
                                />
                                <div className="flex flex-1 px-1 pt-1 gap-1">
                                    <div className="relative w-4 h-full" style={{ background: "#1e40af", border: "1px solid #7f1d1d" }}>
                                        {/* Mirror medallion */}
                                        <div
                                            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full"
                                            style={{
                                                background: "radial-gradient(circle at 30% 30%, #fef3c7, #fbbf24 60%, #b45309)",
                                                border: "1px solid #7f1d1d",
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center gap-0.5">
                                        <div className="h-1 w-3/4 italic rounded-sm" style={{ background: "#7f1d1d" }} />
                                        <div className="h-[1px] w-1/2" style={{ background: "#1e40af" }} />
                                    </div>
                                </div>
                                {/* Tier ledger panel */}
                                <div className="mx-1 mb-0.5 px-0.5 py-0.5" style={{ background: "#fef3c7", border: "1px dashed #7f1d1d" }}>
                                    <div className="h-[1px] w-full" style={{ background: "#7f1d1d" }} />
                                </div>
                                {/* Striped CTA */}
                                <div
                                    className="h-2 w-full"
                                    style={{
                                        backgroundImage: `repeating-linear-gradient(90deg, #1e40af 0 4px, #15803d 4px 8px)`,
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Thermal Receipt: off-white roll, dashed cut lines, barcode strip, red stamp */}
                {id === "thermalreceipt" && (
                    <div className="grid grid-cols-3 gap-1 w-full">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="relative h-[56px] flex flex-col px-1 pt-0.5 pb-0.5 overflow-hidden"
                                style={{
                                    background: "#fafaf6",
                                    backgroundImage: "linear-gradient(180deg, #f3f0e8 0%, #fafaf6 12%, #fafaf6 88%, #f3f0e8 100%)",
                                    boxShadow: "0 1px 2px rgba(60,40,20,0.12)",
                                    fontFamily: "monospace",
                                }}
                            >
                                {/* Header */}
                                <div className="h-[1px] w-full mt-0.5" style={{ background: "#1a1a1a" }} />
                                <div className="text-[4px] tracking-[0.3em] text-center font-bold mt-0.5" style={{ color: "#1a1a1a" }}>
                                    KKR · WHOLESALE
                                </div>
                                {/* Dashed cut */}
                                <div className="h-[1px] my-0.5" style={{ borderTop: "1px dashed #5a554c" }} />
                                {/* Photo with stamp */}
                                <div className="relative h-3 w-full mb-0.5" style={{ background: "#e8e4dc", border: "1px solid #1a1a1a" }}>
                                    <div
                                        className="absolute inset-0 flex items-center justify-center"
                                    >
                                        <span
                                            className="text-[4px] font-bold"
                                            style={{
                                                color: "#b91c1c",
                                                border: "1px solid #b91c1c",
                                                padding: "0 1px",
                                                transform: "rotate(-12deg)",
                                                background: "rgba(250,250,246,0.6)",
                                            }}
                                        >
                                            DISPATCH
                                        </span>
                                    </div>
                                </div>
                                {/* Rate rows */}
                                <div className="space-y-[1px]">
                                    <div className="h-[1px] w-full" style={{ background: "#3a3a3a" }} />
                                    <div className="h-[1px] w-full" style={{ background: "#3a3a3a" }} />
                                    <div className="h-[2px] w-full" style={{ background: "#1a1a1a" }} />
                                </div>
                                {/* Barcode strip */}
                                <div className="mt-auto flex items-end gap-px h-2">
                                    {Array.from({ length: 22 }).map((_, j) => {
                                        const w = ((i * 11 + j * 5) % 4) === 0 ? 1.5 : 1;
                                        const black = ((i + j) % 4) !== 0;
                                        return <span key={j} style={{ width: w, height: "100%", background: black ? "#1a1a1a" : "transparent", flexShrink: 0 }} />;
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* FreightManifest: paperboard with ink-bar manifest, corner brackets, barcode strip, burnt-orange CTA */}
                {id === "freightmanifest" && (
                    <div className="grid grid-cols-2 gap-1 w-full">
                        {[1, 2].map(i => (
                            <div
                                key={i}
                                className="relative h-[56px] flex flex-col overflow-hidden rounded-md"
                                style={{ background: "#f8f6f1", border: "1px solid #2a2f36" }}
                            >
                                {/* Manifest ink bar */}
                                <div className="h-2 px-1 flex items-center justify-between" style={{ background: "#2a2f36" }}>
                                    <div className="h-[1px] w-1/4" style={{ background: "#f8f6f1" }} />
                                    <div className="h-[1px] w-1/3" style={{ background: "#f8f6f1", opacity: 0.7 }} />
                                </div>
                                {/* Photo with corner brackets */}
                                <div className="relative mx-1 mt-1 h-3" style={{ background: "#e8e4dd", border: "1px solid #7a828c" }}>
                                    <span className="absolute top-0 left-0 w-1 h-1" style={{ borderTop: "1px solid #2a2f36", borderLeft: "1px solid #2a2f36" }} />
                                    <span className="absolute top-0 right-0 w-1 h-1" style={{ borderTop: "1px solid #2a2f36", borderRight: "1px solid #2a2f36" }} />
                                    <span className="absolute bottom-0 left-0 w-1 h-1" style={{ borderBottom: "1px solid #2a2f36", borderLeft: "1px solid #2a2f36" }} />
                                    <span className="absolute bottom-0 right-0 w-1 h-1" style={{ borderBottom: "1px solid #2a2f36", borderRight: "1px solid #2a2f36" }} />
                                </div>
                                {/* Name + Rate strip */}
                                <div className="px-1 pt-0.5 flex-1 flex flex-col justify-between">
                                    <div className="h-1.5 w-3/4 rounded-sm" style={{ background: "#2a2f36" }} />
                                    <div className="flex items-stretch h-2">
                                        <div className="px-0.5" style={{ background: "#2a2f36", width: 10 }} />
                                        <div className="flex-1 flex items-center px-0.5" style={{ border: "1px solid #2a2f36" }}>
                                            <div className="h-1 w-2/3 rounded-sm" style={{ background: "#2a2f36" }} />
                                        </div>
                                    </div>
                                </div>
                                {/* Barcode strip */}
                                <div className="mx-1 mt-0.5 mb-0.5 flex items-center gap-px" style={{ height: 4 }}>
                                    {Array.from({ length: 18 }).map((_, j) => {
                                        const w = ((i * 31 + j * 7) % 5) === 0 ? 2 : 1;
                                        const black = ((i + j) % 3) !== 0;
                                        return <span key={j} style={{ width: w, height: "100%", background: black ? "#2a2f36" : "transparent" }} />;
                                    })}
                                </div>
                                {/* Burnt-orange CTA strip */}
                                <div className="h-2" style={{ background: "#c84c00" }} />
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
