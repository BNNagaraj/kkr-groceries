/**
 * KKR Groceries — Cloud Functions Entry Point
 *
 * All functions are organized into modules:
 *   utils.js     — Shared helpers, DB, caches, auth, email templates
 *   orders.js    — submitOrder, assignOrderToStore, notifyOrderStatusChange
 *   inventory.js — recordStockTransaction
 *   auth.js      — setAdminClaim, setDeliveryClaim, setAgentClaim, setHorecaClaim, listRegisteredUsers, getUserClaims, updateUserStatus
 *   horeca.js    — onHorecaRequestCreated, approveHorecaRequest, syncHorecaClaims, onUserRegisteredGrantHoreca
 *   email.js     — processMailQueue, testSmtpConfig, getEmailStats, getEmailLogs, retryFailedEmail
 *   delivery.js  — sendDeliveryOTP, verifyDeliveryOTP, autoAssignDeliveryBoy, generateTrackingLink, cleanupExpiredTracking
 *   gstin.js     — verifyGSTIN
 *   storage.js   — uploadProductImage, uploadLogoImage
 *   og-banner.js — generateOgBanner, serveOgBanner
 */

// Initialize Firebase Admin (must happen before any module imports that use db)
require("./utils"); // This calls initializeApp() and exports db

// Re-export all Cloud Functions from modules
const orders = require("./orders");
const inventory = require("./inventory");
const auth = require("./auth");
const email = require("./email");
const delivery = require("./delivery");
const gstin = require("./gstin");
const storage = require("./storage");
const apmc = require("./apmc");
const alerts = require("./alerts");
const ogBanner = require("./og-banner");
const horeca = require("./horeca");
const payments = require("./payments");

module.exports = {
  ...orders,
  ...inventory,
  ...auth,
  ...email,
  ...delivery,
  ...gstin,
  ...storage,
  ...apmc,
  ...alerts,
  ...ogBanner,
  ...horeca,
  ...payments,
};
