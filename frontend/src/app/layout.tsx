import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ApiBootstrap } from "@/components/ApiBootstrap";
import { PwaRegister } from "@/components/PwaRegister";
import { assetPath } from "@/lib/asset-path";
import "./globals.css";

const inter = Inter({
  variable: "--font-display",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const LOGO = assetPath("/nexa-logo.png");
const MANIFEST = assetPath("/manifest.webmanifest");
const ICON_192 = assetPath("/icons/icon-192x192.png");
const APPLE_ICON = assetPath("/icons/apple-touch-icon.png");

export const metadata: Metadata = {
  title: "Nexa v3 — Your AI Operating System",
  description:
    "One outcome. Nexa runs your business — niche modes, marketing plans, dice ideas, daily check-ins. Not a chatbot.",
  keywords: ["AI COO", "business automation", "autonomous AI", "Nexa"],
  metadataBase: new URL("https://yevinb.github.io/operator-os/"),
  alternates: {
    canonical: "/",
  },
  manifest: MANIFEST,
  appleWebApp: {
    capable: true,
    title: "Nexa",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Nexa — Your AI Operating System",
    description:
      "Say what you need. Nexa runs your business. Not a chatbot. An autonomous employee.",
    url: "https://yevinb.github.io/operator-os/",
    type: "website",
    images: [{ url: LOGO, width: 1024, height: 1024, alt: "Nexa" }],
  },
  icons: {
    icon: [{ url: ICON_192, sizes: "192x192", type: "image/png" }],
    apple: APPLE_ICON,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen antialiased">
        <PwaRegister />
        <ApiBootstrap>{children}</ApiBootstrap>
      </body>
    </html>
  );
}
