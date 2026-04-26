import type { Metadata, Viewport } from "next";
import {
  Outfit,
  Noto_Sans_Telugu,
  Special_Elite,
  Fraunces,
  Cormorant_Garamond,
  JetBrains_Mono,
  Caveat,
  Bebas_Neue,
  EB_Garamond,
  Kalam,
  IBM_Plex_Sans,
  Space_Grotesk,
  DM_Serif_Display,
} from "next/font/google";
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

// Typewriter face for the Mandi Chit aesthetic — feels like an auction-yard slip
const specialElite = Special_Elite({
  subsets: ["latin"],
  variable: "--font-special-elite",
  weight: ["400"],
  display: "swap",
});

// Editorial serif for the Bulletin card — broadsheet headlines.
// Use variable axes so the headline gets opsz=144 large-size optical sizing.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

// Refined display serif for the Produce Forward card
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Monospace numerals — ledger pricing across all three new cards
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
  display: "swap",
});

// Hand-lettered chalk for the Chalkboard card
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["400", "600", "700"],
  display: "swap",
});

// Indian-script-friendly handwriting for MemoSticky (also covers Devanagari)
const kalam = Kalam({
  subsets: ["latin", "devanagari"],
  variable: "--font-kalam",
  weight: ["400", "700"],
  display: "swap",
});

// Condensed slab for the BrutalistSlab headline
const bebas = Bebas_Neue({
  subsets: ["latin"],
  variable: "--font-bebas",
  weight: ["400"],
  display: "swap",
});

// Old-pharmacy serif for the Apothecary label
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// Disciplined modern sans for the HairlineModern card
const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// Geometric grotesk for Risograph (works well at heavy weights with overprint feel)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "700"],
  display: "swap",
});

// Display serif for the BazaarPoster headline
const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-dm-serif",
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
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
import { ModeProvider } from "@/contexts/ModeContext";
import { AppProvider } from "@/contexts/AppContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
        className={`${outfit.variable} ${notoSansTelugu.variable} ${specialElite.variable} ${fraunces.variable} ${cormorant.variable} ${jetbrainsMono.variable} ${caveat.variable} ${kalam.variable} ${bebas.variable} ${ebGaramond.variable} ${ibmPlex.variable} ${spaceGrotesk.variable} ${dmSerifDisplay.variable} font-sans antialiased bg-gray-50 text-slate-800`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-emerald-700 focus:font-bold"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <ModeProvider>
            <AppProvider>
              <ThemeProvider>
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </ThemeProvider>
            </AppProvider>
          </ModeProvider>
        </AuthProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
