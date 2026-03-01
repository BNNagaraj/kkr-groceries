import { Timestamp } from "firebase/firestore";

export interface StockPurchase {
  id: string;
  productName: string;
  productId?: number;
  qty: number;
  unit: string;
  pricePerUnit: number;
  totalCost: number;
  supplier?: string;
  notes?: string;
  purchaseDate: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
}

export interface StockAnalyticsData {
  productName: string;
  qtyBought: number;
  qtySold: number;
  difference: number;
  wastagePercent: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
}
