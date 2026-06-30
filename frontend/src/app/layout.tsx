import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ApiBootstrap } from "@/components/ApiBootstrap";
import "./globals.css";

const inter = Inter({
  variable: "--font-display",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexa — Your AI Operating System",
  description:
    "Type 'Increase sales.' Your AI COO executes — ads, customers, hiring, reports. Autonomous business operations.",
  keywords: ["AI COO", "business automation", "autonomous AI", "Nexa"],
  metadataBase: new URL("https://yevinb.github.io"),
  alternates: {
    canonical: "/operator-os/",
  },
  openGraph: {
    title: "Nexa — Your AI Operating System",
    description:
      "Say what you need. Nexa runs your business. Not a chatbot. An autonomous employee.",
    url: "https://yevinb.github.io/operator-os/",
    type: "website",
    images: [{ url: "/nexa-logo.png", width: 512, height: 512, alt: "Nexa" }],
  },
  icons: {
    icon: "/nexa-logo.png",
    apple: "/nexa-logo.png",
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
