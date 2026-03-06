export interface DeliverySettings {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  zoneName: string;
}

export interface BusinessSettings {
  storeName: string;
  contactPhone: string;
  contactEmail: string;
  deliveryCharges: number;
  minOrderValue: number;
  gstNumber?: string;
  address: string;
}

export type OtpChannel = "email" | "sms" | "both";

export interface CheckoutFormSettings {
  requireShopName: boolean;
  requirePincode: boolean;
  showMapPicker: boolean;
  requireDeliveryOTP: boolean;
  otpChannels: OtpChannel;
  customFields: CustomField[];
}

/* ─── SMS Gateway (MSG91 — future use) ─── */

export interface SmsGatewaySettings {
  provider: "msg91";
  apiKey: string;
  senderId: string;       // 6-char DLT sender ID
  templateId: string;     // DLT template ID
  enabled: boolean;
}

export const DEFAULT_SMS_GATEWAY: SmsGatewaySettings = {
  provider: "msg91",
  apiKey: "",
  senderId: "",
  templateId: "",
  enabled: false,
};

export interface CustomField {
  label: string;
  key: string;
  type: "text" | "number" | "select";
  required: boolean;
  options?: string[];
}

export const DEFAULT_DELIVERY: DeliverySettings = {
  centerLat: 17.385,
  centerLng: 78.4867,
  radiusKm: 50,
  zoneName: "Hyderabad",
};

export const DEFAULT_BUSINESS: BusinessSettings = {
  storeName: "KKR Groceries",
  contactPhone: "",
  contactEmail: "",
  deliveryCharges: 0,
  minOrderValue: 0,
  gstNumber: "",
  address: "",
};

export const DEFAULT_CHECKOUT: CheckoutFormSettings = {
  requireShopName: true,
  requirePincode: true,
  showMapPicker: true,
  requireDeliveryOTP: false,
  otpChannels: "email",
  customFields: [],
};

/* ─── Theme System ─── */

export type ThemeId = "classic" | "premium" | "catalog";

export interface GridConfig {
  mobile: number;
  tablet: number;
  desktop: number;
  wide: number;
}

export interface CardStyleOverrides {
  borderRadius: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

export type ImagePosition = "left" | "right" | "top";

export interface CardLayoutConfig {
  /** Percentage width of image area (20-50). Only applies to left/right positions. */
  imageWidth: number;
  /** Where the product image is placed in the card */
  imagePosition: ImagePosition;
}

export interface ThemeSettings {
  activeTheme: ThemeId;
  primaryColor: string;
  accentColor: string;
  grid: GridConfig;
  cardStyle: CardStyleOverrides;
  cardLayout: CardLayoutConfig;
}

export const DEFAULT_THEME: ThemeSettings = {
  activeTheme: "classic",
  primaryColor: "#059669",
  accentColor: "#f97316",
  grid: { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
  cardStyle: { borderRadius: "2xl" },
  cardLayout: { imageWidth: 35, imagePosition: "left" },
};
