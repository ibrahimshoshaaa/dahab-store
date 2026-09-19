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
      // استخدم اللوجو الأصلي نفسه كتطبيق وأيقونة Splash بدل أيقونة D المختصرة.
      { src: "/logo.png", sizes: "any", type: "image/png", purpose: "any" },
    ],
  }
}
