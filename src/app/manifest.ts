import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TradeLog — Trading Journal",
    short_name: "TradeLog",
    description: "Log, review and analyze your NQ and ES futures trades.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0c0f",
    theme_color: "#0b0c0f",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log trade", url: "/journal/new", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Journal", url: "/journal", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Calendar", url: "/calendar", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
