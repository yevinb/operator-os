import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
  title: "OperatorOS — Your AI Chief Operating Officer",
  description:
    "Type 'Increase sales.' Your AI COO executes — ads, customers, hiring, reports. Autonomous business operations.",
  keywords: ["AI COO", "business automation", "autonomous AI", "OperatorOS"],
  metadataBase: new URL("https://yevinb.github.io"),
  alternates: {
    canonical: "/operator-os/",
  },
  openGraph: {
    title: "OperatorOS — Your AI Chief Operating Officer",
    description:
      "Say what you need. OperatorOS runs your business. Not a chatbot. An autonomous employee.",
    url: "https://yevinb.github.io/operator-os/",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
