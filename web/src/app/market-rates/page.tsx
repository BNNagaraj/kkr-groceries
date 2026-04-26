"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, BarChart3,
  WifiOff, Leaf, Activity, ArrowLeftRight, ChevronDown,
  Zap, Globe, Clock, Database, GitCompare, Star
} from "lucide-react";
import {
  generateAPMCPrices,
  fetchRealAPMCPrices,
  fetchMultiStateAPMCPrices,
  fetchPriceHistory,
  apiRecordsToPrices,
  getMarketsFromRecords,
  matchCommodityToProduct,
  computeSupplySignals,
  computeArbitrageOpportunities,
  computeTrends,
  getSeasonInfo,
  isMarketOpen,
  canonicalize,
  APMC_MARKETS,
  MARKET_LABELS,
  APMCMarket,
  APMCPrice,
  APMCApiRecord,
  PriceHistoryEntry,
  CommodityTrend,
} from "@/lib/apmc";
import { useAppStore } from "@/contexts/AppContext";
import { SupplySignals } from "@/components/market/SupplySignals";
import { ArbitrageOpportunities } from "@/components/market/ArbitrageOpportunities";
import { Sparkline } from "@/components/market/Sparkline";
import { ShareSheet } from "@/components/market/ShareSheet";
import { PriceAlertButton } from "@/components/market/PriceAlertButton";
import { CommodityDeepDive } from "@/components/market/CommodityDeepDive";
import { MarketCompare } from "@/components/market/MarketCompare";

type Tab = "prices" | "supply" | "arbitrage" | "compare";

export default function MarketRatesPage() {
  const { products } = useAppStore();
  const [selectedMarket, setSelectedMarket] = useState<string>("Bowenpally");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("prices");
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Real API data (single-state)
  const [apiRecords, setApiRecords] = useState<APMCApiRecord[] | null>(null);
  const [apiMarkets, setApiMarkets] = useState<string[]>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [fromCache, setFromCache] = useState(false);

  // Multi-state data (for arbitrage)
  const [multiRecords, setMultiRecords] = useState<APMCApiRecord[] | null>(null);
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiLoaded, setMultiLoaded] = useState(false);
  const [stateBreakdown, setStateBreakdown] = useState<Record<string, number>>({});

  // Price history (for sparklines + trends)
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Deep-dive modal
  const [deepDiveCommodity, setDeepDiveCommodity] = useState<string | null>(null);

  // Voice readout
  const [isReading, setIsReading] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMarketDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch Telangana data on mount / refresh
  const loadRealData = useCallback(async () => {
    setApiLoading(true);
    setApiError(false);
    try {
      const result = await fetchRealAPMCPrices();
      if (result && result.records.length > 0) {
        setApiRecords(result.records);
        setApiMarkets(getMarketsFromRecords(result.records));
        setFetchedAt(result.fetchedAt);
        setFromCache(result.fromCache);
        const markets = getMarketsFromRecords(result.records);
        if (markets.length > 0 && !markets.some(m => m.toLowerCase().includes(selectedMarket.toLowerCase()))) {
          setSelectedMarket(markets[0]);
        }
      } else {
        setApiRecords(null);
        setApiError(true);
      }
    } catch {
      setApiRecords(null);
      setApiError(true);
    } finally {
      setApiLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadRealData();
  }, [loadRealData]);

  // Load price history on mount
  useEffect(() => {
    if (historyLoaded) return;
    fetchPriceHistory(7).then(h => {
      setPriceHistory(h);
      setHistoryLoaded(true);
    });
  }, [historyLoaded]);

  // Lazy-load multi-state data when arbitrage tab is clicked
  const loadMultiStateData = useCallback(async () => {
    if (multiLoaded || multiLoading) return;
    setMultiLoading(true);
    try {
      const result = await fetchMultiStateAPMCPrices();
      if (result && result.records.length > 0) {
        setMultiRecords(result.records);
        if (result.stateBreakdown) setStateBreakdown(result.stateBreakdown);
      }
    } catch (e) {
      console.warn("[APMC] Multi-state fetch failed:", e);
    } finally {
      setMultiLoading(false);
      setMultiLoaded(true);
    }
  }, [multiLoaded, multiLoading]);

  useEffect(() => {
    if (activeTab === "arbitrage") {
      loadMultiStateData();
    }
  }, [activeTab, loadMultiStateData]);

  // Derived data
  const isRealData = apiRecords !== null && apiRecords.length > 0;

  const prices: APMCPrice[] = useMemo(() => {
    if (isRealData) {
      return apiRecordsToPrices(apiRecords!, selectedMarket);
    }
    const simMarket = APMC_MARKETS.includes(selectedMarket as APMCMarket)
      ? (selectedMarket as APMCMarket)
      : "Bowenpally";
    return generateAPMCPrices(simMarket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealData, apiRecords, selectedMarket, refreshKey]);

  const supplySignals = useMemo(() => computeSupplySignals(prices), [prices]);

  const arbitrageOpportunities = useMemo(() => {
    if (!multiRecords) return [];
    return computeArbitrageOpportunities(prices, multiRecords, selectedMarket);
  }, [prices, multiRecords, selectedMarket]);

  // Compute trends from history
  const trends = useMemo(() => {
    if (priceHistory.length === 0) return new Map<string, CommodityTrend>();
    const trendList = computeTrends(prices, priceHistory);
    const map = new Map<string, CommodityTrend>();
    for (const t of trendList) map.set(t.commodity, t);
    return map;
  }, [prices, priceHistory]);

  // Product image map
  const imageMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of prices) {
      const img = matchCommodityToProduct(p.commodity, products);
      if (img) map[p.commodity] = img;
    }
    return map;
  }, [prices, products]);

  // "Best Buy" — top 3 surplus items
  const bestBuys = useMemo(() => {
    return new Set(
      supplySignals
        .filter(s => s.signal === "surplus")
        .sort((a, b) => b.signalStrength - a.signalStrength)
        .slice(0, 3)
        .map(s => canonicalize(s.commodity))
    );
  }, [supplySignals]);

  const marketOptions: readonly string[] = isRealData ? apiMarkets : APMC_MARKETS;

  const date = prices[0]?.date || new Date().toISOString().split("T")[0];

  // Summary stats
  const avgPrice = prices.length > 0 ? Math.round(prices.reduce((s, p) => s + p.modalPrice, 0) / prices.length) : 0;
  const maxPriceItem = prices.length > 0 ? prices.reduce((a, b) => a.modalPrice > b.modalPrice ? a : b) : null;
  const minPriceItem = prices.length > 0 ? prices.reduce((a, b) => a.modalPrice < b.modalPrice ? a : b) : null;
  const shortageCount = supplySignals.filter(s => s.signal === "shortage").length;
  const surplusCount = supplySignals.filter(s => s.signal === "surplus").length;

  // Market open status
  const marketOpen = isMarketOpen(selectedMarket);

  const TABS: { id: Tab; label: string; sublabel: string; icon: React.ReactNode; count?: number }[] = [
    { id: "prices", label: "Live Prices", sublabel: `${prices.length} items`, icon: <BarChart3 className="w-[18px] h-[18px]" /> },
    { id: "supply", label: "Supply Intel", sublabel: `${shortageCount} alerts`, icon: <Activity className="w-[18px] h-[18px]" />, count: shortageCount },
    { id: "compare", label: "Compare", sublabel: "Multi-market", icon: <GitCompare className="w-[18px] h-[18px]" /> },
    { id: "arbitrage", label: "Arbitrage", sublabel: "Cross-state", icon: <ArrowLeftRight className="w-[18px] h-[18px]" /> },
  ];

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    loadRealData();
    setHistoryLoaded(false);
    if (multiLoaded) {
      setMultiLoaded(false);
      setMultiRecords(null);
    }
  };

  // Voice readout
  const handleReadAloud = useCallback(() => {
    if (isReading || !window.speechSynthesis) return;
    setIsReading(true);
    const top10 = prices.slice(0, 10);
    const text = `Today's market rates at ${selectedMarket}. ` +
      top10.map(p => `${p.commodity}: ${p.modalPrice} rupees per kg`).join(". ") +
      `. That's the top ${top10.length} prices for today.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.9;
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);
    window.speechSynthesis.speak(utterance);
  }, [prices, selectedMarket, isReading]);

  // Deep-dive data
  const deepDivePrice = useMemo(() => {
    if (!deepDiveCommodity) return null;
    return prices.find(p => p.commodity === deepDiveCommodity) || null;
  }, [deepDiveCommodity, prices]);

  const deepDiveHistory = useMemo(() => {
    if (!deepDiveCommodity) return [];
    const key = canonicalize(deepDiveCommodity);
    const sorted = [...priceHistory].sort((a, b) => a.date.localeCompare(b.date));
    const entries: Array<{ date: string; minPrice: number; modalPrice: number; maxPrice: number }> = [];
    for (const entry of sorted) {
      for (const rec of entry.records) {
        if (canonicalize(rec.commodity) === key) {
          entries.push({ date: entry.date, minPrice: rec.minPrice, modalPrice: rec.modalPrice, maxPrice: rec.maxPrice });
          break;
        }
      }
    }
    return entries;
  }, [deepDiveCommodity, priceHistory]);

  const deepDiveAllMarkets = useMemo(() => {
    if (!deepDiveCommodity || !apiRecords) return [];
    const key = canonicalize(deepDiveCommodity);
    const seen = new Set<string>();
    const results: APMCPrice[] = [];
    for (const r of apiRecords) {
      if (canonicalize(r.commodity) !== key || seen.has(r.market)) continue;
      seen.add(r.market);
      results.push({
        commodity: r.commodity,
        variety: r.variety,
        minPrice: r.minPrice,
        modalPrice: r.modalPrice,
        maxPrice: r.maxPrice,
        date: r.arrivalDate,
        market: r.market,
        isReal: true,
      });
    }
    return results.sort((a, b) => a.modalPrice - b.modalPrice);
  }, [deepDiveCommodity, apiRecords]);

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="relative" style={{ zIndex: 20 }}>
        {/* Gradient background with texture */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a2f1f] via-[#0d3b28] to-[#062019]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        <div className="relative max-w-5xl mx-auto px-4 pt-4 pb-5">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-emerald-200 hover:text-white transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Store</span>
            </Link>

            <div className="flex items-center gap-2">
              {/* Market hours badge */}
              <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold backdrop-blur-sm border ${
                marketOpen
                  ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
                  : "bg-slate-500/20 text-slate-300 border-slate-400/30"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? "bg-emerald-400" : "bg-red-400"}`} />
                {marketOpen ? "Market Open" : "Market Closed"}
              </div>

              {/* Data source badge */}
              <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold backdrop-blur-sm border ${
                isRealData
                  ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
                  : "bg-amber-500/20 text-amber-200 border-amber-400/30"
              }`}>
                {isRealData ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    {fromCache ? "Cached" : "LIVE"}
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    Simulated
                  </>
                )}
              </div>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={apiLoading}
                className="p-2 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${apiLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Title row */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <BarChart3 className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Market Intelligence
                </h1>
              </div>
              <p className="text-emerald-200/80 text-sm ml-10">
                APMC wholesale rates · {date}
                {isRealData && <span className="ml-1.5 text-emerald-300/60">via data.gov.in</span>}
              </p>
            </div>

            {/* Market selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
                className="flex items-center gap-2 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] backdrop-blur-sm rounded-xl px-3.5 py-2.5 transition-all group"
              >
                <MapPinIcon className="w-3.5 h-3.5 text-emerald-300" />
                <span className="text-sm font-semibold text-white max-w-[140px] truncate">
                  {selectedMarket}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/60 transition-transform ${marketDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {marketDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#0d2b1f] border border-emerald-500/20 rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden py-1">
                  {marketOptions.map((m) => {
                    const mOpen = isMarketOpen(m);
                    return (
                      <button
                        key={m}
                        onClick={() => { setSelectedMarket(m); setMarketDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                          selectedMarket === m
                            ? "bg-emerald-500/15 text-emerald-300 font-semibold"
                            : "text-white/70 hover:bg-white/[0.06] hover:text-white/90"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${mOpen ? "bg-emerald-400" : "bg-red-400"}`} />
                        {isRealData ? m : MARKET_LABELS[m as APMCMarket] || m}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 -mt-1 pb-24">
        {/* ═══════════════ KPI RIBBON ═══════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          <KpiCard
            label="Avg Price"
            value={`₹${avgPrice}`}
            sub="per kg"
            icon={<BarChart3 className="w-4 h-4" />}
            color="emerald"
          />
          <KpiCard
            label="Most Expensive"
            value={maxPriceItem ? `₹${maxPriceItem.modalPrice}` : "—"}
            sub={maxPriceItem?.commodity || ""}
            icon={<TrendingUp className="w-4 h-4" />}
            color="red"
          />
          <KpiCard
            label="Cheapest"
            value={minPriceItem ? `₹${minPriceItem.modalPrice}` : "—"}
            sub={minPriceItem?.commodity || ""}
            icon={<TrendingDown className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="Supply Alerts"
            value={`${shortageCount}`}
            sub={`${surplusCount} surplus`}
            icon={<Zap className="w-4 h-4" />}
            color="amber"
            badge={shortageCount > 0 ? `${shortageCount}` : undefined}
          />
        </div>

        {/* ═══════════════ TAB NAVIGATION ═══════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 p-1.5 mb-5">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 relative flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all shrink-0 ${
                  activeTab === tab.id
                    ? "bg-[#0a2f1f] text-white shadow-lg shadow-emerald-900/20"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className={activeTab === tab.id ? "text-emerald-400" : ""}>{tab.icon}</span>
                <span className="hidden sm:inline text-xs">{tab.label}</span>
                <span className="sm:hidden text-xs">{tab.label.split(" ")[0]}</span>
                {tab.count && tab.count > 0 && activeTab !== tab.id && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════ PRICES TAB ═══════════════ */}
        {activeTab === "prices" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Loading state */}
            {apiLoading && prices.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                </div>
                <p className="text-slate-700 font-bold mb-1">Fetching Market Data</p>
                <p className="text-slate-400 text-sm">Connecting to APMC price feeds...</p>
              </div>
            )}

            {/* Price table */}
            {prices.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
                {/* Table header */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {prices.length} Commodities
                    </span>
                    {priceHistory.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        · {priceHistory.length}-day history
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-blue-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400" /> Min
                    </span>
                    <span className="text-emerald-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Modal
                    </span>
                    <span className="text-red-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400" /> Max
                    </span>
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-100/80">
                  {prices.map((p, idx) => {
                    const img = imageMap[p.commodity];
                    const range = p.maxPrice - p.minPrice;
                    const modalPos = range > 0 ? ((p.modalPrice - p.minPrice) / range) * 100 : 50;
                    const trend = trends.get(canonicalize(p.commodity));
                    const isBestBuy = bestBuys.has(canonicalize(p.commodity));
                    const season = getSeasonInfo(p.commodity);

                    // Find Telugu name
                    const matched = products.find(pr => {
                      const pn = pr.name.toLowerCase();
                      const cn = p.commodity.toLowerCase();
                      return pn.includes(cn) || cn.includes(pn);
                    });

                    return (
                      <div
                        key={`${p.commodity}-${idx}`}
                        className="group flex items-center px-4 py-3 hover:bg-emerald-50/30 transition-colors cursor-pointer"
                        onClick={() => setDeepDiveCommodity(p.commodity)}
                      >
                        {/* Index */}
                        <span className="w-7 text-[11px] text-slate-300 font-mono tabular-nums shrink-0">
                          {String(idx + 1).padStart(2, "0")}
                        </span>

                        {/* Image + Name */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {img ? (
                            <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200/80 shrink-0 bg-slate-50 shadow-sm">
                              <Image src={img} alt={p.commodity} width={36} height={36} className="w-full h-full object-cover" unoptimized={img.startsWith("data:")} />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 flex items-center justify-center shrink-0">
                              <Leaf className="w-4 h-4 text-emerald-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800 text-[13px] truncate">{p.commodity}</span>
                              {isBestBuy && (
                                <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                              )}
                              {!season.inSeason && (
                                <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-50 text-red-500 shrink-0">OFF</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {matched?.telugu && (
                                <span className="text-[10px] text-slate-400 truncate">{matched.telugu}</span>
                              )}
                              {p.variety && p.variety !== "Other" && p.variety !== p.commodity && !matched?.telugu && (
                                <span className="text-[10px] text-slate-400 truncate">{p.variety}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Sparkline + Yesterday's change */}
                        <div className="hidden sm:flex items-center gap-2 shrink-0 mx-2">
                          {trend && trend.sparklinePath && (
                            <Sparkline path={trend.sparklinePath} direction={trend.direction} width={50} height={18} />
                          )}
                          {trend && trend.change !== 0 && trend.prices.length >= 2 && (
                            <span className={`text-[10px] font-bold tabular-nums ${
                              trend.change > 0 ? "text-red-500" : "text-emerald-500"
                            }`}>
                              {trend.change > 0 ? "▲" : "▼"}₹{Math.abs(trend.change)}
                            </span>
                          )}
                        </div>

                        {/* Price range visualization */}
                        <div className="hidden lg:flex items-center gap-0 w-[100px] shrink-0 mx-2">
                          <div className="relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="absolute h-full bg-gradient-to-r from-blue-300 via-emerald-400 to-red-300 rounded-full opacity-60"
                              style={{ left: "0%", width: "100%" }}
                            />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                              style={{ left: `calc(${Math.max(5, Math.min(95, modalPos))}% - 5px)` }}
                            />
                          </div>
                        </div>

                        {/* Prices */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          <span className="text-blue-600/80 font-semibold text-xs tabular-nums w-10 text-right hidden sm:block">
                            ₹{p.minPrice}
                          </span>
                          <span className="text-emerald-700 font-extrabold text-sm tabular-nums w-14 text-right bg-emerald-50 px-2 py-0.5 rounded-lg">
                            ₹{p.modalPrice}
                          </span>
                          <span className="text-red-600/80 font-semibold text-xs tabular-nums w-10 text-right hidden sm:block">
                            ₹{p.maxPrice}
                          </span>
                        </div>

                        {/* Alert button */}
                        <div className="ml-2 shrink-0" onClick={e => e.stopPropagation()}>
                          <PriceAlertButton
                            commodity={p.commodity}
                            currentPrice={p.modalPrice}
                            market={selectedMarket}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!apiLoading && prices.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-600 font-bold mb-1">No Data Available</p>
                <p className="text-slate-400 text-sm">Try selecting a different market or refresh</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ SUPPLY SIGNALS TAB ═══════════════ */}
        {activeTab === "supply" && (
          <div className="animate-in fade-in duration-300">
            <SupplySignals signals={supplySignals} products={products} />
          </div>
        )}

        {/* ═══════════════ COMPARE TAB ═══════════════ */}
        {activeTab === "compare" && (
          <div className="animate-in fade-in duration-300">
            <MarketCompare
              apiRecords={apiRecords}
              markets={marketOptions}
              products={products}
            />
          </div>
        )}

        {/* ═══════════════ ARBITRAGE TAB ═══════════════ */}
        {activeTab === "arbitrage" && (
          <div className="animate-in fade-in duration-300">
            <ArbitrageOpportunities
              opportunities={arbitrageOpportunities}
              products={products}
              loading={multiLoading}
              selectedMarket={selectedMarket}
              stateBreakdown={stateBreakdown}
            />
          </div>
        )}

        {/* ═══════════════ FOOTER ═══════════════ */}
        <div className="mt-6 pt-4 border-t border-slate-200/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {isRealData ? `${selectedMarket} · Telangana` : "Simulated Data"}
              </span>
              {fetchedAt && (
                <span className="flex items-center gap-1 text-slate-300">
                  <Clock className="w-3 h-3" />
                  {new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <span>
              {isRealData
                ? "Source: data.gov.in · Ministry of Agriculture & Farmers Welfare"
                : "Indicative prices · APMC Market Committee, Hyderabad"}
            </span>
          </div>
        </div>
      </main>

      {/* ═══════════════ SHARE SHEET (floating) ═══════════════ */}
      {prices.length > 0 && (
        <ShareSheet
          prices={prices}
          supplySignals={supplySignals}
          market={selectedMarket}
          date={date}
          onReadAloud={handleReadAloud}
        />
      )}

      {/* ═══════════════ DEEP-DIVE MODAL ═══════════════ */}
      {deepDiveCommodity && deepDivePrice && (
        <CommodityDeepDive
          commodity={deepDiveCommodity}
          currentPrice={deepDivePrice}
          history={deepDiveHistory}
          allMarketPrices={deepDiveAllMarkets}
          products={products}
          onClose={() => setDeepDiveCommodity(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════ KPI Card Component ═══════════════ */
function KpiCard({ label, value, sub, icon, color, badge }: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: "emerald" | "red" | "blue" | "amber";
  badge?: string;
}) {
  const colorMap = {
    emerald: {
      bg: "bg-emerald-50/80",
      border: "border-emerald-100",
      icon: "text-emerald-500 bg-emerald-100",
      value: "text-emerald-800",
      badge: "bg-emerald-500",
    },
    red: {
      bg: "bg-red-50/80",
      border: "border-red-100",
      icon: "text-red-500 bg-red-100",
      value: "text-red-800",
      badge: "bg-red-500",
    },
    blue: {
      bg: "bg-blue-50/80",
      border: "border-blue-100",
      icon: "text-blue-500 bg-blue-100",
      value: "text-blue-800",
      badge: "bg-blue-500",
    },
    amber: {
      bg: "bg-amber-50/80",
      border: "border-amber-100",
      icon: "text-amber-600 bg-amber-100",
      value: "text-amber-800",
      badge: "bg-amber-500",
    },
  };
  const c = colorMap[color];

  return (
    <div className={`relative ${c.bg} border ${c.border} rounded-2xl p-3 sm:p-3.5 overflow-hidden`}>
      {badge && (
        <span className={`absolute top-2 right-2 w-5 h-5 ${c.badge} text-white text-[10px] font-bold rounded-full flex items-center justify-center`}>
          {badge}
        </span>
      )}
      <div className={`w-7 h-7 rounded-lg ${c.icon} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <div className={`text-lg sm:text-xl font-extrabold ${c.value} tabular-nums leading-none mb-0.5`}>
        {value}
      </div>
      <div className="text-[10px] text-slate-500 font-medium truncate">{sub}</div>
      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

/* ═══════════════ MapPin Icon (inline) ═══════════════ */
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
