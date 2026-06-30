import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ApiBootstrap } from "@/components/ApiBootstrap";
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

export const metadata: Metadata = {
  title: "Nexa — Your AI Operating System",
  description:
    "Type 'Increase sales.' Your AI COO executes — ads, customers, hiring, reports. Autonomous business operations.",
  keywords: ["AI COO", "business automation", "autonomous AI", "Nexa"],
  metadataBase: new URL("https://yevinb.github.io/operator-os/"),
  alternates: {
    canonical: "/",
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
    icon: LOGO,
    apple: LOGO,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen antialiased">
        <ApiBootstrap>{children}</ApiBootstrap>
      </body>
    </html>
  );
}
