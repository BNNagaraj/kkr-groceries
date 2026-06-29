import { Timestamp } from "firebase/firestore";

export type EntryCategory = "rent" | "salary" | "transport" | "misc" | "other";

export interface AccountEntry {
  id: string;
  date: Timestamp;
  description: string;
  category: EntryCategory;
  type: "credit" | "debit";
  amount: number;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface LedgerRow {
  id: string;
  date: Date;
  description: string;
  category: string;
  credit: number;
  debit: number;
  balance: number;
  source: "auto-sale" | "auto-purchase" | "manual";
  refId?: string;
  /** Payment info for auto-sale rows (lets the ledger show paid/unpaid). */
  payment?: { status?: string; method?: string; ref?: string; collectedAmount?: number };
}

export interface PnLData {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: Record<string, number>;
  totalExpenses: number;
  netProfit: number;
}
