import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import InstallTip from "./components/InstallTip";
import AccessGate from "./components/AccessGate";
import NativeShell from "./components/NativeShell";
import ViewportKeyboardFix from "./components/ViewportKeyboardFix";
import NoPinchZoom from "./components/NoPinchZoom";
import ViewportDebug from "./components/ViewportDebug";
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
  title: "AlreaDough | Your living desire space",
  description: "A bilingual AI space for one deeply desired life, with conversation, storytelling, sound practice, revision, and vision boards.",
  applicationName: "AlreaDough",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AlreaDough",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/already-app-icon.png",
    shortcut: "/already-app-icon.png",
    apple: "/already-app-icon.png",
  },
  openGraph: {
    title: "AlreaDough | Your living desire space",
    description: "One desire. Deep belief. A steady return.",
    images: [{ url: "/already-social.png", width: 1200, height: 630, alt: "AlreaDough living dough universe" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AlreaDough | Your living desire space",
    description: "One desire. Deep belief. A steady return.",
    images: ["/already-social.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "light dark", // the app draws both themes itself; stops phone browsers force-darkening it
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
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: "try{var s=localStorage.getItem('already-font-size-v1');if(s==='small'||s==='large')document.documentElement.dataset.fontSize=s}catch(e){}" }} />
        <NativeShell />
        <ViewportKeyboardFix />
        <NoPinchZoom />
        <ViewportDebug />
        <AccessGate>{children}<InstallTip /></AccessGate>
      </body>
    </html>
  );
}
