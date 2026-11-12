import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlreaDough",
    short_name: "AlreaDough",
    description: "Your living desire space.",
    id: "/",
    start_url: "/",
    scope: "/",
    lang: "zh-CN",
    display: "standalone",
    background_color: "#f4efea",
    theme_color: "#a65f6b",
    orientation: "portrait-primary",
    icons: [
      { src: "/already-app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/already-app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Phone launchers (including Huawei's) crop to their own icon shape; the logo's key features sit inside the safe zone.
      { src: "/already-app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/already-app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
