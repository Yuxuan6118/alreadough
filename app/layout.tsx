import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NativeShell from "./components/NativeShell";
import "./globals.css";
import "./already.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Already | Your living desire space",
  description: "A bilingual AI space for one deeply desired life, with conversation, storytelling, sound practice, revision, and vision boards.",
  applicationName: "Already",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Already",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/already-app-icon.png",
    shortcut: "/already-app-icon.png",
    apple: "/already-app-icon.png",
  },
  openGraph: {
    title: "Already | Your living desire space",
    description: "One desire. Deep belief. A steady return.",
    images: [{ url: "/already-social.png", width: 1200, height: 630, alt: "Already living dough universe" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Already | Your living desire space",
    description: "One desire. Deep belief. A steady return.",
    images: ["/already-social.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efea" },
    { media: "(prefers-color-scheme: dark)", color: "#211d1d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NativeShell />
        {children}
      </body>
    </html>
  );
}
