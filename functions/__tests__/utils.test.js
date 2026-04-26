// Mock firebase-admin and firebase-functions BEFORE requiring utils.js
// (utils.js calls initializeApp() and getFirestore() at import time)
jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
}));
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  FieldValue: {
    serverTimestamp: jest.fn(),
    increment: jest.fn(),
  },
}));
jest.mock("firebase-admin/auth", () => ({
  getAuth: jest.fn(() => ({})),
}));
jest.mock("firebase-admin/storage", () => ({
  getStorage: jest.fn(() => ({})),
}));
jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    constructor(code, msg) {
      super(msg);
      this.code = code;
    }
  },
}));

const {
  haversineKm,
  scoreStoresForOrder,
  resolveSlabPrice,
  resolveCol,
} = require("../utils");

// ─── haversineKm ───────────────────────────────────────────────────────────────

describe("haversineKm", () => {
  test("known distance: Hyderabad to Bachupally is roughly 16 km", () => {
    const dist = haversineKm(17.385, 78.4867, 17.4935, 78.3639);
    expect(dist).toBeGreaterThan(14);
    expect(dist).toBeLessThan(18);
  });

  test("same point returns 0 km", () => {
    expect(haversineKm(17.385, 78.4867, 17.385, 78.4867)).toBe(0);
  });

  test("antipodal points return roughly 20,000 km", () => {
    // North pole (90,0) to South pole (-90,0)
    const dist = haversineKm(90, 0, -90, 0);
    expect(dist).toBeGreaterThan(19_900);
    expect(dist).toBeLessThan(20_100);
  });
});

// ─── scoreStoresForOrder ────────────────────────────────────────────────────────

describe("scoreStoresForOrder", () => {
  // Helper to build a minimal store
  const mkStore = (id, lat, lng) => ({ id, name: `Store ${id}`, lat, lng });

  // Order location: central Hyderabad
  const ORDER_LAT = 17.385;
  const ORDER_LNG = 78.4867;

  test("2km hyper-local rule: nearest store wins even with worse inventory", () => {
    const nearStore = mkStore("near", 17.386, 78.487); // ~0.15 km away
    const farStore = mkStore("far", 17.42, 78.45);     // ~5 km away

    const cart = [
      { id: "p1", name: "Tomato", qty: 10, unit: "kg" },
      { id: "p2", name: "Onion", qty: 5, unit: "kg" },
    ];

    // Far store has full inventory, near store has only 1 of 2 items
    const invMap = {
      near: { p1: { currentQty: 10 } },
      far: { p1: { currentQty: 10 }, p2: { currentQty: 5 } },
    };

    const results = scoreStoresForOrder({
      stores: [nearStore, farStore],
      invMap,
      nameToProductId: {},
      cart,
      orderLat: ORDER_LAT,
      orderLng: ORDER_LNG,
    });

    expect(results[0].storeId).toBe("near");
  });

  test("tier bucketing: closer tier wins regardless of inventory", () => {
    // Tier 0: <= 5 km, Tier 1: <= 10 km
    const tier0Store = mkStore("t0", 17.40, 78.47);  // ~3 km
    const tier1Store = mkStore("t1", 17.45, 78.55);   // ~10 km

    const cart = [{ id: "p1", name: "Tomato", qty: 10, unit: "kg" }];

    // tier1 has full inventory, tier0 has none
    const invMap = {
      t0: {},
      t1: { p1: { currentQty: 10 } },
    };

    const results = scoreStoresForOrder({
      stores: [tier1Store, tier0Store],
      invMap,
      nameToProductId: {},
      cart,
      orderLat: ORDER_LAT,
      orderLng: ORDER_LNG,
    });

    expect(results[0].storeId).toBe("t0");
  });

  test("within same tier: better inventory wins", () => {
    // Both stores roughly 3 km away (same tier)
    const storeA = mkStore("a", 17.40, 78.47);
    const storeB = mkStore("b", 17.41, 78.48);

    const cart = [
      { id: "p1", name: "Tomato", qty: 10, unit: "kg" },
      { id: "p2", name: "Onion", qty: 5, unit: "kg" },
    ];

    const invMap = {
      a: { p1: { currentQty: 10 } },                           // 50% fulfillment
      b: { p1: { currentQty: 10 }, p2: { currentQty: 5 } },   // 100% fulfillment
    };

    const results = scoreStoresForOrder({
      stores: [storeA, storeB],
      invMap,
      nameToProductId: {},
      cart,
      orderLat: ORDER_LAT,
      orderLng: ORDER_LNG,
    });

    expect(results[0].storeId).toBe("b");
  });

  test("no GPS on order: stores returned in input order (no distance sorting)", () => {
    const storeA = mkStore("a", 17.40, 78.47);
    const storeB = mkStore("b", 17.41, 78.48);

    const cart = [{ id: "p1", name: "Tomato", qty: 10, unit: "kg" }];
    const invMap = {
      a: { p1: { currentQty: 10 } },
      b: { p1: { currentQty: 10 } },
    };

    const results = scoreStoresForOrder({
      stores: [storeA, storeB],
      invMap,
      nameToProductId: {},
      cart,
      orderLat: null,
      orderLng: null,
    });

    // Both have same fulfillment and no distance, so no re-ordering
    // All stores get the same highest tier (no-GPS tier), same fulfillment
    expect(results[0].storeId).toBe("a");
    expect(results[1].storeId).toBe("b");
    // Distance should be null for both
    expect(results[0].distanceKm).toBeNull();
    expect(results[1].distanceKm).toBeNull();
  });

  test("empty cart: all stores get 0 fulfillment (0/0)", () => {
    const storeA = mkStore("a", 17.40, 78.47);

    const results = scoreStoresForOrder({
      stores: [storeA],
      invMap: { a: {} },
      nameToProductId: {},
      cart: [],
      orderLat: ORDER_LAT,
      orderLng: ORDER_LNG,
    });

    // cart.length === 0 → fulfillmentPercent = 0 (the ternary returns 0)
    expect(results[0].fulfillmentPercent).toBe(0);
    expect(results[0].availableItems).toHaveLength(0);
    expect(results[0].missingItems).toHaveLength(0);
  });
});

// ─── resolveSlabPrice ──────────────────────────────────────────────────────────

describe("resolveSlabPrice", () => {
  test("no tiers returns base price", () => {
    expect(resolveSlabPrice(10, 50, null)).toBe(50);
    expect(resolveSlabPrice(10, 50, [])).toBe(50);
    expect(resolveSlabPrice(10, 50, undefined)).toBe(50);
  });

  test("qty matches a tier exactly returns tier price", () => {
    const tiers = [
      { minQty: 1, maxQty: 9, price: 50 },
      { minQty: 10, maxQty: 49, price: 45 },
      { minQty: 50, maxQty: 0, price: 40 }, // maxQty 0 = Infinity
    ];

    expect(resolveSlabPrice(10, 60, tiers)).toBe(45);
    expect(resolveSlabPrice(50, 60, tiers)).toBe(40);
    expect(resolveSlabPrice(1, 60, tiers)).toBe(50);
  });

  test("qty between tiers returns best matching tier", () => {
    const tiers = [
      { minQty: 1, maxQty: 9, price: 50 },
      { minQty: 10, maxQty: 49, price: 45 },
      { minQty: 50, maxQty: 0, price: 40 },
    ];

    expect(resolveSlabPrice(25, 60, tiers)).toBe(45);
    expect(resolveSlabPrice(100, 60, tiers)).toBe(40);
    expect(resolveSlabPrice(5, 60, tiers)).toBe(50);
  });

  test("qty below all tiers returns base price", () => {
    const tiers = [
      { minQty: 10, maxQty: 49, price: 45 },
      { minQty: 50, maxQty: 0, price: 40 },
    ];

    expect(resolveSlabPrice(5, 60, tiers)).toBe(60);
  });
});

// ─── resolveCol ────────────────────────────────────────────────────────────────

describe("resolveCol", () => {
  test("test mode + namespaced collection returns prefixed name", () => {
    expect(resolveCol("orders", "test")).toBe("test_orders");
    expect(resolveCol("stockPurchases", "test")).toBe("test_stockPurchases");
    expect(resolveCol("stores", "test")).toBe("test_stores");
  });

  test("test mode + non-namespaced collection returns base name", () => {
    expect(resolveCol("products", "test")).toBe("products");
    expect(resolveCol("settings", "test")).toBe("settings");
    expect(resolveCol("users", "test")).toBe("users");
  });

  test("real mode always returns base name", () => {
    expect(resolveCol("orders", "real")).toBe("orders");
    expect(resolveCol("stockPurchases", "real")).toBe("stockPurchases");
    expect(resolveCol("products", "real")).toBe("products");
  });
});
