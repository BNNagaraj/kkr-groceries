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
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "KKR Groceries | Hyderabad B2B Vegetable Wholesale",
  description: "Fresh vegetables at APMC wholesale prices for hotels, restaurants & retailers in Hyderabad.",
  manifest: "/manifest.json",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥬</text></svg>",
  },
};

import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${notoSansTelugu.variable} font-sans antialiased bg-gray-50 text-slate-800`}
      >
        <AuthProvider>
          <AppProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
