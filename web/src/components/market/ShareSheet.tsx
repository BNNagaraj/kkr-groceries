"use client";

import React, { useState, useCallback } from "react";
import { Share2, MessageCircle, Download, Check, Volume2 } from "lucide-react";
import { APMCPrice, SupplySignal, generateWhatsAppMessage, exportPricesToCSV } from "@/lib/apmc";

interface Props {
  prices: APMCPrice[];
  supplySignals: SupplySignal[];
  market: string;
  date: string;
  onReadAloud?: () => void;
}

export function ShareSheet({ prices, supplySignals, market, date, onReadAloud }: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleWhatsApp = useCallback(() => {
    const message = generateWhatsAppMessage(prices, supplySignals, market, date);
    const encoded = encodeURIComponent(message);

    // Try native share on mobile, else wa.me deep link, else clipboard fallback
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ text: message }).catch(() => {
        window.open(`https://wa.me/?text=${encoded}`, "_blank");
      });
    } else if (typeof window !== "undefined") {
      // Desktop: try clipboard copy + open WhatsApp web
      if (navigator.clipboard) {
        navigator.clipboard.writeText(message).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }
      window.open(`https://wa.me/?text=${encoded}`, "_blank");
    }
  }, [prices, supplySignals, market, date]);

  const handleCSV = useCallback(() => {
    setDownloading(true);
    try {
      const csv = exportPricesToCSV(prices, market, date);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `market-rates-${market.toLowerCase().replace(/\s+/g, "-")}-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  }, [prices, market, date]);

  const handleVoice = useCallback(() => {
    onReadAloud?.();
  }, [onReadAloud]);

  return (
    <div className="fixed bottom-6 right-4 z-40 flex items-center gap-1.5 bg-[#0a2f1f] rounded-full px-2 py-1.5 shadow-lg shadow-emerald-900/20 border border-emerald-800/40">
      {/* WhatsApp */}
      <button
        onClick={handleWhatsApp}
        className="relative w-10 h-10 rounded-full flex items-center justify-center text-emerald-300 hover:bg-emerald-900/50 active:scale-95 transition-all"
        title="Share on WhatsApp"
      >
        {copied ? (
          <Check className="w-4.5 h-4.5 text-emerald-400" />
        ) : (
          <MessageCircle className="w-4.5 h-4.5" />
        )}
        {copied && (
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-400 bg-[#0a2f1f] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
            Copied!
          </span>
        )}
      </button>

      {/* CSV Export */}
      <button
        onClick={handleCSV}
        disabled={downloading}
        className="relative w-10 h-10 rounded-full flex items-center justify-center text-emerald-300 hover:bg-emerald-900/50 active:scale-95 transition-all disabled:opacity-50"
        title="Download CSV"
      >
        {downloading ? (
          <Download className="w-4.5 h-4.5 animate-bounce" />
        ) : (
          <Download className="w-4.5 h-4.5" />
        )}
        {downloading && (
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-400 bg-[#0a2f1f] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
            Downloading...
          </span>
        )}
      </button>

      {/* Voice readout */}
      {onReadAloud && (
        <button
          onClick={handleVoice}
          className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-300 hover:bg-emerald-900/50 active:scale-95 transition-all"
          title="Read aloud"
        >
          <Volume2 className="w-4.5 h-4.5" />
        </button>
      )}

      {/* Separator dot */}
      <div className="w-0.5 h-5 bg-emerald-700/40 rounded-full mx-0.5" />

      {/* Share label */}
      <div className="flex items-center gap-1 pr-2 text-emerald-400/70">
        <Share2 className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">Share</span>
      </div>
    </div>
  );
}
