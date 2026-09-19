import HomeClient from "./components/HomeClient"
import { fetchProducts, fetchSettings } from "./lib/api"

export default async function HomePage() {
  const [products, settings] = await Promise.all([
    fetchProducts(),
    fetchSettings(),
  ])

  return <HomeClient initialProducts={products} initialSettings={settings} />
}
