import { Timestamp } from "firebase/firestore";

export interface OrderCartItem {
  name: string;
  qty: number;
  price: number;
  unit: string;
  image?: string;
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

export type OrderStatus = "Pending" | "Accepted" | "Fulfilled" | "Rejected";

export interface Order {
  id: string;
  orderId: string;
  userId: string;
  customerName: string;
  phone: string;
  shopName: string;
  location: string;
  pincode?: string;
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
}

export const STATUS_TIMESTAMP_FIELDS: Record<OrderStatus, string> = {
  Pending: "placedAt",
  Accepted: "acceptedAt",
  Fulfilled: "deliveredAt",
  Rejected: "rejectedAt",
};
