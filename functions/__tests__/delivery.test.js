/**
 * Tests for sendDeliveryOTP and verifyDeliveryOTP Cloud Functions.
 *
 * The functions are wrapped with `onCall`, so we mock that wrapper to return
 * the inner handler directly — letting us invoke them as plain async fns.
 */

// ─── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("firebase-admin/app", () => ({ initializeApp: jest.fn() }));
jest.mock("firebase-admin/auth", () => ({ getAuth: jest.fn(() => ({})) }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn(() => ({})) }));

// In-memory Firestore stand-in
const fsState = {
  docs: new Map(), // key: `${col}/${id}` → data
  added: [], // every .add() call
  updates: [], // every .update() call
};

function resetFsState() {
  fsState.docs.clear();
  fsState.added.length = 0;
  fsState.updates.length = 0;
}

const mockDocRef = (col, id) => ({
  _key: `${col}/${id}`,
  collection: (sub) => mockColRef(`${col}/${id}/${sub}`),
  get: jest.fn(async () => {
    const data = fsState.docs.get(`${col}/${id}`);
    return {
      exists: data !== undefined,
      data: () => data,
    };
  }),
  set: jest.fn(async (data) => {
    fsState.docs.set(`${col}/${id}`, data);
  }),
  update: jest.fn(async (data) => {
    const existing = fsState.docs.get(`${col}/${id}`) || {};
    const merged = { ...existing };
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && v.__increment !== undefined) {
        merged[k] = (merged[k] || 0) + v.__increment;
      } else {
        merged[k] = v;
      }
    }
    fsState.docs.set(`${col}/${id}`, merged);
    fsState.updates.push({ key: `${col}/${id}`, data });
  }),
});

const mockColRef = (col) => ({
  doc: (id) => mockDocRef(col, id),
  add: jest.fn(async (data) => {
    fsState.added.push({ col, data });
    return { id: `auto_${fsState.added.length}` };
  }),
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: (col) => mockColRef(col),
  })),
  FieldValue: {
    serverTimestamp: jest.fn(() => "__serverTimestamp__"),
    increment: jest.fn((n) => ({ __increment: n })),
  },
}));

// FCM mock — must be `mock`-prefixed for jest.mock factory hoisting
const mockFcmSend = jest.fn(async () => ({ messageId: "fake" }));
jest.mock("firebase-admin/messaging", () => ({
  getMessaging: jest.fn(() => ({ send: mockFcmSend })),
}));

// onCall returns the handler directly so we can call it as a plain async fn.
jest.mock("firebase-functions/v2/https", () => ({
  onCall: (handler) => handler,
  HttpsError: class HttpsError extends Error {
    constructor(code, msg) {
      super(msg);
      this.code = code;
    }
  },
  onRequest: (handler) => handler,
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_cfg, handler) => handler,
}));

// ─── Module under test ─────────────────────────────────────────────────────────

const { sendDeliveryOTP, verifyDeliveryOTP } = require("../delivery");
const { HttpsError } = require("firebase-functions/v2/https");

// ─── Helpers ───────────────────────────────────────────────────────────────────

const adminCaller = {
  uid: "admin-uid",
  token: { admin: true, email: "admin@kkr.test" },
};
const buyerCaller = {
  uid: "buyer-uid",
  token: { email: "buyer@example.com" },
};

function seedOrder(orderId, overrides = {}, col = "orders") {
  fsState.docs.set(`${col}/${orderId}`, {
    orderId: `KKR-${orderId}`,
    customerName: "Test Customer",
    userEmail: "buyer@example.com",
    phone: "+919999999999",
    userId: "buyer-uid",
    ...overrides,
  });
}

function seedAppMode(mode) {
  fsState.docs.set(`settings/appMode`, { mode });
}

function seedFcmToken(uid, token, active = true) {
  fsState.docs.set(`users/${uid}/tokens/fcm`, { token, active });
}

beforeEach(() => {
  resetFsState();
  mockFcmSend.mockClear();
  // Default app mode = real (so colName = "orders")
  seedAppMode("real");
});

// ─── sendDeliveryOTP ───────────────────────────────────────────────────────────

describe("sendDeliveryOTP", () => {
  test("rejects unauthenticated callers", async () => {
    await expect(
      sendDeliveryOTP({ data: { orderId: "o1" }, auth: null })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("rejects non-admin callers", async () => {
    seedOrder("o1");
    await expect(
      sendDeliveryOTP({ data: { orderId: "o1" }, auth: buyerCaller })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects when orderId missing", async () => {
    await expect(
      sendDeliveryOTP({ data: {}, auth: adminCaller })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("rejects when no channels selected", async () => {
    seedOrder("o1");
    await expect(
      sendDeliveryOTP({
        data: { orderId: "o1", channels: { email: false, app: false } },
        auth: adminCaller,
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("rejects when order not found", async () => {
    await expect(
      sendDeliveryOTP({ data: { orderId: "missing" }, auth: adminCaller })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("rejects email channel when buyer has no email", async () => {
    seedOrder("o1", { userEmail: null });
    await expect(
      sendDeliveryOTP({
        data: { orderId: "o1", channels: { email: true } },
        auth: adminCaller,
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rejects app channel when buyer has no UID", async () => {
    seedOrder("o1", { userId: null });
    await expect(
      sendDeliveryOTP({
        data: { orderId: "o1", channels: { app: true, email: false } },
        auth: adminCaller,
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("email-only: writes 6-digit OTP to delivery_otps and queues mail", async () => {
    seedOrder("o1");
    const result = await sendDeliveryOTP({
      data: { orderId: "o1", channels: { email: true } },
      auth: adminCaller,
    });

    expect(result.success).toBe(true);
    expect(result.sentTo).toContain("email:buyer@example.com");

    const otpDoc = fsState.docs.get("delivery_otps/o1");
    expect(otpDoc).toBeDefined();
    expect(otpDoc.otp).toMatch(/^\d{6}$/);
    expect(otpDoc.channels).toEqual({ email: true, app: false });
    expect(otpDoc.verified).toBe(false);
    expect(otpDoc.attempts).toBe(0);

    // Mail enqueued
    const mail = fsState.added.find((a) => a.col === "mail");
    expect(mail).toBeDefined();
    expect(mail.data.to).toEqual(["buyer@example.com"]);
    expect(mail.data.message.html).toContain(otpDoc.otp);
  });

  test("app-only: creates notification doc and attempts FCM push", async () => {
    seedOrder("o1");
    seedFcmToken("buyer-uid", "fcm-token-abc");

    const result = await sendDeliveryOTP({
      data: { orderId: "o1", channels: { app: true, email: false } },
      auth: adminCaller,
    });

    expect(result.success).toBe(true);
    expect(result.sentTo).toContain("app:push+bell+banner");

    // Notification doc written
    const notif = fsState.added.find((a) => a.col === "notifications");
    expect(notif).toBeDefined();
    expect(notif.data.userId).toBe("buyer-uid");
    expect(notif.data.type).toBe("delivery_otp");

    // FCM send invoked
    expect(mockFcmSend).toHaveBeenCalledTimes(1);
    expect(mockFcmSend.mock.calls[0][0].token).toBe("fcm-token-abc");
  });

  test("app channel without FCM token: still writes notification, push skipped", async () => {
    seedOrder("o1");
    // No FCM token seeded

    const result = await sendDeliveryOTP({
      data: { orderId: "o1", channels: { app: true, email: false } },
      auth: adminCaller,
    });

    expect(result.success).toBe(true);
    expect(result.sentTo).toContain("app:bell+banner");
    expect(mockFcmSend).not.toHaveBeenCalled();
  });

  test("email + app combined: both channels dispatched", async () => {
    seedOrder("o1");
    seedFcmToken("buyer-uid", "fcm-token-xyz");

    const result = await sendDeliveryOTP({
      data: { orderId: "o1", channels: { email: true, app: true } },
      auth: adminCaller,
    });

    expect(result.sentTo).toHaveLength(2);
    expect(result.sentTo).toContain("email:buyer@example.com");
    expect(result.sentTo).toContain("app:push+bell+banner");

    expect(fsState.added.find((a) => a.col === "mail")).toBeDefined();
    expect(fsState.added.find((a) => a.col === "notifications")).toBeDefined();
    expect(mockFcmSend).toHaveBeenCalledTimes(1);
  });

  test("inactive FCM token: notification still written, push skipped", async () => {
    seedOrder("o1");
    seedFcmToken("buyer-uid", "stale-token", false);

    const result = await sendDeliveryOTP({
      data: { orderId: "o1", channels: { app: true, email: false } },
      auth: adminCaller,
    });

    expect(result.sentTo).toContain("app:bell+banner");
    expect(mockFcmSend).not.toHaveBeenCalled();
  });

  test("default channels (no channels arg) = email only — preserves legacy contract", async () => {
    seedOrder("o1");
    const result = await sendDeliveryOTP({
      data: { orderId: "o1" },
      auth: adminCaller,
    });

    expect(result.sentTo).toEqual(["email:buyer@example.com"]);
    const otpDoc = fsState.docs.get("delivery_otps/o1");
    expect(otpDoc.channels).toEqual({ email: true, app: false });
  });

  test("custom orderCollection overrides mode-resolved default", async () => {
    seedOrder("o1", {}, "test_orders");

    await sendDeliveryOTP({
      data: { orderId: "o1", orderCollection: "test_orders" },
      auth: adminCaller,
    });

    const otpDoc = fsState.docs.get("delivery_otps/o1");
    expect(otpDoc.orderCollection).toBe("test_orders");
  });
});

// ─── verifyDeliveryOTP ─────────────────────────────────────────────────────────

describe("verifyDeliveryOTP", () => {
  function seedOtp(orderId, overrides = {}) {
    fsState.docs.set(`delivery_otps/${orderId}`, {
      otp: "123456",
      orderId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verified: false,
      attempts: 0,
      ...overrides,
    });
  }

  test("rejects non-admin", async () => {
    await expect(
      verifyDeliveryOTP({ data: { orderId: "o1", otp: "123456" }, auth: buyerCaller })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rejects missing args", async () => {
    await expect(
      verifyDeliveryOTP({ data: { orderId: "o1" }, auth: adminCaller })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("rejects when no OTP record exists", async () => {
    await expect(
      verifyDeliveryOTP({ data: { orderId: "o1", otp: "123456" }, auth: adminCaller })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("rejects expired OTP", async () => {
    seedOtp("o1", { expiresAt: new Date(Date.now() - 1000).toISOString() });
    await expect(
      verifyDeliveryOTP({ data: { orderId: "o1", otp: "123456" }, auth: adminCaller })
    ).rejects.toMatchObject({ code: "deadline-exceeded" });
  });

  test("rejects after 5 attempts", async () => {
    seedOtp("o1", { attempts: 5 });
    await expect(
      verifyDeliveryOTP({ data: { orderId: "o1", otp: "123456" }, auth: adminCaller })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  test("incorrect OTP increments attempts and returns remaining count", async () => {
    seedOtp("o1");
    await expect(
      verifyDeliveryOTP({ data: { orderId: "o1", otp: "999999" }, auth: adminCaller })
    ).rejects.toMatchObject({ code: "permission-denied" });

    const stored = fsState.docs.get("delivery_otps/o1");
    expect(stored.attempts).toBe(1);
    expect(stored.verified).toBe(false);
  });

  test("correct OTP marks verified", async () => {
    seedOtp("o1");
    const result = await verifyDeliveryOTP({
      data: { orderId: "o1", otp: "123456" },
      auth: adminCaller,
    });

    expect(result.success).toBe(true);
    const stored = fsState.docs.get("delivery_otps/o1");
    expect(stored.verified).toBe(true);
  });

  test("trims whitespace before comparing OTP", async () => {
    seedOtp("o1");
    const result = await verifyDeliveryOTP({
      data: { orderId: "o1", otp: "  123456 " },
      auth: adminCaller,
    });
    expect(result.success).toBe(true);
  });
});
