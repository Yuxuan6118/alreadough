import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeColorSync from "./components/ThemeColorSync";
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
  title: "AlreaDough", // short on purpose: Huawei and other browsers use the page title as the home-screen shortcut name
  description: "A bilingual AI space for one deeply desired life, with conversation, storytelling, sound practice, revision, and vision boards.",
  applicationName: "AlreaDough",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // see-through: the page paints the strip itself (already.css, installed-app block), so it always matches the page and the phone-following theme
    title: "AlreaDough",
  },
  manifest: "/manifest.webmanifest",
  // Domestic Android browsers (UC, QQ/Tencent X5 kernel, Baidu, ...) predate the Web App
  // Manifest spec and ignore `display: "standalone"` from it. "Add to home screen" on them
  // just makes a bookmark shortcut that reopens with the full browser chrome, unless these
  // legacy vendor meta tags tell the browser itself to launch in app/fullscreen mode.
  other: {
    "full-screen": "yes", // UC Browser
    browsermode: "application", // UC Browser
    "x5-fullscreen": "true", // Tencent X5 kernel: QQ Browser, in-WeChat browser
    "x5-page-mode": "app", // Tencent X5 kernel app mode
    "mobile-web-app-capable": "yes", // generic / older Chromium-based browsers
  },
  icons: {
    // Small files on purpose: a 1.4MB favicon often times out on phones, and the system then draws a letter instead of the logo.
    icon: [
      { url: "/already-app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/already-app-icon-192.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
  viewportFit: "cover",
  colorScheme: "light", // light only; stops phone browsers force-darkening it
  themeColor: "#f4efea",
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
        <script dangerouslySetInnerHTML={{ __html: "try{var s=localStorage.getItem('already-font-size-v1');if(s==='small'||s==='large')document.documentElement.dataset.fontSize=s}catch(e){}document.documentElement.dataset.theme='light';" }} />
        <ThemeColorSync />
        {children}
      </body>
    </html>
  );
}
