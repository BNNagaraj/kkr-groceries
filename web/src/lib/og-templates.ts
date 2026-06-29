/** OG Banner template definitions for the admin template gallery */

export interface OgTemplate {
  id: string;
  name: string;
  description: string;
  category: "Professional" | "Bold" | "Minimal" | "Creative" | "Classic";
  thumbnail: string;
}

export const OG_TEMPLATES: OgTemplate[] = [
  { id: "dark-premium", name: "Dark Premium", description: "Navy background with orange glow accents", category: "Professional", thumbnail: "/og-templates/dark-premium.jpg" },
  { id: "clean-split", name: "Clean Split", description: "Orange left panel with diagonal cut to white", category: "Professional", thumbnail: "/og-templates/clean-split.jpg" },
  { id: "centered-hero", name: "Centered Hero", description: "Cream background with centered logo and text", category: "Minimal", thumbnail: "/og-templates/centered-hero.jpg" },
  { id: "bold-green", name: "Bold Green", description: "Dark green with orange accents", category: "Bold", thumbnail: "/og-templates/bold-green.jpg" },
  { id: "gradient-orange", name: "Gradient Orange", description: "Polished orange gradient with frosted card", category: "Professional", thumbnail: "/og-templates/gradient-orange.jpg" },
  { id: "minimal-white", name: "Minimal White", description: "Clean white with thin orange accents", category: "Minimal", thumbnail: "/og-templates/minimal-white.jpg" },
  { id: "duotone", name: "Duotone", description: "Two-color split with modern layout", category: "Creative", thumbnail: "/og-templates/duotone.jpg" },
  { id: "editorial", name: "Editorial", description: "Newspaper-style with classic typography", category: "Classic", thumbnail: "/og-templates/editorial.jpg" },
  { id: "bold-type", name: "Bold Typography", description: "Large text-dominant design with strong colors", category: "Bold", thumbnail: "/og-templates/bold-type.jpg" },
  { id: "neon-glow", name: "Neon Glow", description: "Dark background with vibrant neon effects", category: "Creative", thumbnail: "/og-templates/neon-glow.jpg" },
  { id: "geometric", name: "Geometric", description: "Orange geometric patterns with white overlay", category: "Creative", thumbnail: "/og-templates/geometric.jpg" },
  { id: "gradient-mesh", name: "Gradient Mesh", description: "Multi-color gradient with glossy finish", category: "Creative", thumbnail: "/og-templates/gradient-mesh.jpg" },
  { id: "vintage-stamp", name: "Vintage Stamp", description: "Centered badge with retro styling", category: "Classic", thumbnail: "/og-templates/vintage-stamp.jpg" },
  { id: "corporate-blue", name: "Corporate Blue", description: "Professional blue gradient with clean layout", category: "Professional", thumbnail: "/og-templates/corporate-blue.jpg" },
  { id: "fresh-market", name: "Fresh Market", description: "Green nature theme with produce colors", category: "Classic", thumbnail: "/og-templates/fresh-market.jpg" },
];

export interface OgBannerContent {
  title: string;
  subtitle: string;
  description: string;
  location: string;
  delivery: string;
  cta: string;
  ctaUrl: string;
}

export const DEFAULT_OG_CONTENT: OgBannerContent = {
  title: "KKR Groceries",
  subtitle: "B2B & B2C WHOLESALE VEGETABLES",
  description: "Fresh vegetables at APMC wholesale prices for hotels, restaurants & retailers in Hyderabad",
  location: "Hyderabad, Telangana",
  delivery: "Same-day Delivery",
  cta: "Order Now",
  ctaUrl: "kkr-groceries-02.web.app",
};

export interface OgBannerSettings {
  activeTemplateId: string;
  content: OgBannerContent;
  customLogoUrl?: string;
  generatedImageUrl?: string;
  lastGeneratedAt?: string;
}
