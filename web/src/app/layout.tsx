import type { Metadata, Viewport } from "next";
import { Outfit, Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "600", "700", "800"],
});

const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  variable: "--font-noto-telugu",
  weight: ["400", "700"],
});

export const viewport: Viewport = {
  themeColor: "#064e3b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "KKR Groceries | Hyderabad B2B Vegetable Wholesale",
    template: "%s | KKR Groceries",
  },
  description:
    "Fresh vegetables at APMC wholesale prices for hotels, restaurants & retailers in Hyderabad. Daily market rates from Bowenpally Yard.",
  keywords: [
    "wholesale vegetables Hyderabad",
    "B2B groceries",
    "APMC prices",
    "Bowenpally market yard",
    "bulk vegetable order",
    "restaurant supplies Hyderabad",
    "hotel groceries wholesale",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥬</text></svg>",
    apple:
      "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥬</text></svg>",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://kkrgroceries.com",
    siteName: "KKR Groceries",
    title: "KKR Groceries | Hyderabad B2B Vegetable Wholesale",
    description:
      "Fresh vegetables at APMC wholesale prices for hotels, restaurants & retailers in Hyderabad.",
  },
  twitter: {
    card: "summary",
    title: "KKR Groceries | B2B Vegetable Wholesale",
    description:
      "Fresh vegetables at APMC wholesale prices for hotels, restaurants & retailers in Hyderabad.",
  },
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL("https://kkrgroceries.com"),
};

import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "KKR Groceries",
  description:
    "B2B wholesale vegetable supplier in Hyderabad with live APMC market prices.",
  url: "https://kkrgroceries.com",
  telephone: "+91-XXXXXXXXXX",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Hyderabad",
    addressRegion: "Telangana",
    addressCountry: "IN",
  },
  priceRange: "$$",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${outfit.variable} ${notoSansTelugu.variable} font-sans antialiased bg-gray-50 text-slate-800`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-emerald-700 focus:font-bold"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <AppProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </AppProvider>
        </AuthProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
