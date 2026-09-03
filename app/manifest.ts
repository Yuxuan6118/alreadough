import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlreaDough",
    short_name: "AlreaDough",
    description: "Your living desire space.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efea",
    theme_color: "#a65f6b",
    orientation: "portrait-primary",
    icons: [
      { src: "/already-app-icon.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
      { src: "/already-app-icon.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
    ],
  };
}
