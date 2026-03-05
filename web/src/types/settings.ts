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

export interface CheckoutFormSettings {
  requireShopName: boolean;
  requirePincode: boolean;
  showMapPicker: boolean;
  requireDeliveryOTP: boolean;
  customFields: CustomField[];
}

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
  customFields: [],
};
