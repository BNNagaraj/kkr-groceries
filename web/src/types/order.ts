import { Timestamp } from "firebase/firestore";

export interface OrderCartItem {
  id?: string;        // product document ID (for inventory matching)
  name: string;
  qty: number;
  price: number;
  unit: string;
  image?: string;
  telugu?: string;
  hindi?: string;
  basePrice?: number;
  appliedTier?: string;
}

/** Routing result from assignOrderToStore Cloud Function */
export interface StoreRoutingResult {
  storeId: string;
  storeName: string;
  distanceKm: number;
  fulfillmentPercent: number;
  score: number;
  availableItems: Array<{ productName: string; productId: string; requestedQty: number; availableQty: number; unit: string }>;
  missingItems: Array<{ productName: string; productId: string; requestedQty: number; availableQty: number; shortfall: number; unit: string }>;
}

export interface SuggestedTransfer {
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  productId: string;
  productName: string;
  qty: number;
  unit: string;
}

export interface OrderRoutingResponse {
  stores: StoreRoutingResult[];
  bestStoreId: string;
  bestStoreName: string;
  bestFulfillmentPercent: number;
  suggestedTransfers: SuggestedTransfer[];
}

export interface PendingModification {
  proposedCart: OrderCartItem[];
  proposedSummary: string;
  proposedTotalValue: string;
  proposedCount: number;
  changes: string[];
  modifiedAt: string;
  modifiedBy: string;
  status: "PendingBuyerApproval";
}

/**
 * AwaitingPayment: UPI order created but NOT yet placed — the buyer must
 * complete payment (or switch to COD) before it enters the fulfilment pipeline.
 * COD orders skip this state and start at "Pending".
 */
export type OrderStatus = "AwaitingPayment" | "Pending" | "Accepted" | "Shipped" | "Fulfilled" | "Rejected";

/** Human-friendly labels for statuses whose raw value reads poorly in the UI. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  AwaitingPayment: "Awaiting Payment",
};

export interface Order {
  id: string;
  orderId: string;
  userId: string;
  customerName: string;
  phone: string;
  shopName: string;
  location: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  userEmail?: string;
  cart: OrderCartItem[];
  orderSummary: string;
  productCount: number;
  totalValue: string;
  timestamp: string;
  createdAt: Timestamp;
  status: OrderStatus;
  placedAt?: Timestamp;
  acceptedAt?: Timestamp;
  shippedAt?: Timestamp;
  deliveredAt?: Timestamp;
  rejectedAt?: Timestamp;
  originalCart?: OrderCartItem[];
  revisedAcceptedCart?: OrderCartItem[];
  revisedFulfilledCart?: OrderCartItem[];
  pendingModification?: PendingModification;
  modificationStatus?: string;
  // GSTIN / billing details (attached at order submission if buyer has verified GSTIN)
  buyerGstin?: string;
  billingAddress?: string;
  buyerLegalName?: string;
  // Delivery assignment
  assignedTo?: string;         // delivery boy UID
  assignedToName?: string;     // delivery boy display name (denormalized)
  assignedStoreId?: string;    // store document ID
  assignedStoreName?: string;  // store name (denormalized)
  assignedAt?: Timestamp;
  // Swiggy/Zomato-style live delivery progress (within the Shipped status)
  deliveryStage?: "reached_store" | "picked_up" | "on_the_way";
  deliveryStageAt?: Timestamp;
  deliveredBy?: string;        // agent UID who completed the delivery
  // Agent acceptance of the assignment
  assignmentStatus?: "pending" | "accepted" | "rejected";
  rejectedBy?: string[];       // agent UIDs who rejected — excluded on auto-reassign
  // Smart-batch dispatch (autoBatchAssign): a multi-stop, route-sequenced trip
  batchId?: string;            // shared id for all stops in one rider's trip
  batchSize?: number;          // total stops in the trip
  batchStopIndex?: number;     // 0-based optimised sequence position of this stop
  // Payment
  paymentStatus?: "unpaid" | "submitted" | "paid" | "partial" | "refunded";
  paymentMethod?: string;      // "upi" | "razorpay" | "cash" | "cod"
  paymentRef?: string;         // UPI UTR or gateway payment id
  paymentSubmittedAt?: Timestamp;
  paidAt?: Timestamp;
  collectedBy?: string;        // agent UID who collected cash (COD)
  collectedAmount?: number;    // cash actually collected (for full/partial)
  // Cash settlement (agent → business handover)
  cashSettled?: boolean;
  settledAt?: Timestamp;
  settledBy?: string;          // admin UID who confirmed the cash handover
}

export const STATUS_TIMESTAMP_FIELDS: Record<OrderStatus, string> = {
  AwaitingPayment: "createdAt",
  Pending: "placedAt",
  Accepted: "acceptedAt",
  Shipped: "shippedAt",
  Fulfilled: "deliveredAt",
  Rejected: "rejectedAt",
};
