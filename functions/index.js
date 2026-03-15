/**
 * KKR Groceries — Cloud Functions Entry Point
 *
 * All functions are organized into modules:
 *   utils.js     — Shared helpers, DB, caches, auth, email templates
 *   orders.js    — submitOrder, assignOrderToStore, notifyOrderStatusChange
 *   inventory.js — recordStockTransaction
 *   auth.js      — setAdminClaim, setDeliveryClaim, setAgentClaim, listRegisteredUsers, getUserClaims, updateUserStatus
 *   email.js     — processMailQueue, testSmtpConfig, getEmailStats, getEmailLogs, retryFailedEmail
 *   delivery.js  — sendDeliveryOTP, verifyDeliveryOTP, autoAssignDeliveryBoy, generateTrackingLink, cleanupExpiredTracking
 *   gstin.js     — verifyGSTIN
 *   storage.js   — uploadProductImage
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

module.exports = {
  ...orders,
  ...inventory,
  ...auth,
  ...email,
  ...delivery,
  ...gstin,
  ...storage,
  ...apmc,
};
