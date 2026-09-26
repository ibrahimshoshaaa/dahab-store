import { createClient } from "@libsql/client"
import { createSchema } from "../app/lib/server/schema.mjs"

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url) throw new Error("TURSO_DATABASE_URL is required")
if (!authToken) throw new Error("TURSO_AUTH_TOKEN is required")

const db = createClient({ url, authToken })

await createSchema(db)

const defaults = {
  hero_image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=2000&q=90",
  hero_image_1: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=2000&q=90",
  hero_image_2: "", hero_image_3: "", hero_image_4: "", hero_image_5: "", hero_image_6: "", hero_image_7: "", hero_image_8: "",
  hero_interval_seconds: "3", hero_label: "DAHAB COLLECTION", hero_title_line1: "أناقتك...", hero_title_line2: "بطابع دهب",
  hero_subtitle: "عبايات مصرية بتصميمات راقية تجمع بين الاحتشام والأناقة وتناسب كل لحظة.",
  hero_button_text: "اكتشفي المجموعة",
  collection_abaya_image: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=1200&q=90",
  collection_accessories_image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=90",
  accessories_item1_title: "حقائب", accessories_item1_image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=700&q=85",
  accessories_item2_title: "إكسسوارات", accessories_item2_image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=700&q=85",
  accessories_item3_title: "طرح", accessories_item3_image: "https://images.unsplash.com/photo-1601924928378-6bda4b8c3f1d?auto=format&fit=crop&w=700&q=85",
  accessories_item4_title: "لمسات دهب", accessories_item4_image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=700&q=85",
  footer_description: "عبايات مصرية وإكسسوارات مختارة بعناية، لأن أناقتك تستحق الأفضل.",
  announcement_bar: "✦ شحن لجميع المحافظات | الدفع عند الاستلام متاح",
}
for (const [key, value] of Object.entries(defaults)) {
  await db.execute({ sql: "INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", args: [key, value] })
}
await db.execute({ sql: "DELETE FROM settings WHERE key IN (?,?,?,?)", args: ["story_title_line1", "story_title_line2", "story_body", "story_image"] })
const legacyHero = await db.execute({ sql: "SELECT value FROM settings WHERE key=?", args: ["hero_image"] })
await db.execute({ sql: "INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", args: ["hero_image_1", String(legacyHero.rows[0]?.value || defaults.hero_image)] })

console.log("Turso migration completed successfully. Demo products are never seeded automatically.")
