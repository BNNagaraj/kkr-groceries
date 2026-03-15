import { Timestamp } from "firebase/firestore";

export interface StoreInventoryItem {
  /** Document ID: `{storeId}_{productId}` */
  id: string;
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  currentQty: number;
  unit: string;
  reorderLevel: number;
  costPrice: number;
  lastUpdated: Timestamp;
  lastAlertSentAt?: Timestamp;
}

export type TransactionType =
  | "receipt"
  | "dispatch"
  | "sale"
  | "transfer_in"
  | "transfer_out"
  | "adjustment";

export interface StockTransaction {
  id: string;
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  type: TransactionType;
  qty: number;
  unit: string;
  buyerName?: string;
  buyerPhone?: string;
  counterpartStoreId?: string;
  counterpartStoreName?: string;
  supplier?: string;
  costPrice?: number;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  createdByName: string;
}
