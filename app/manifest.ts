import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DAHAB | دهب",
    short_name: "DAHAB",
    description: "عبايات مصرية وإكسسوارات مختارة بعناية.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f4",
    theme_color: "#171512",
    lang: "ar",
    dir: "rtl",
    categories: ["shopping", "lifestyle"],
    icons: [
      // نستخدم اللوجو الأصلي في المقاسين المطلوبين للـ PWA.
      { src: "/logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }
}
