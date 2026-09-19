import SiteLogo from "./components/SiteLogo"

function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[var(--bg)]/95 backdrop-blur-xl">
      <div className="mx-auto grid h-20 max-w-7xl grid-cols-3 items-center px-5">
        <div className="flex items-center gap-4">
          <span className="h-6 w-6 rounded-md dahab-shimmer lg:hidden" />
          <div className="hidden gap-7 lg:flex">
            {[1, 2, 3, 4, 5].map((item) => <span key={item} className="h-3 w-14 rounded dahab-shimmer" />)}
          </div>
        </div>
        <div className="flex justify-center"><SiteLogo className="h-11 w-auto opacity-70" /></div>
        <div className="flex justify-end gap-4">
          {[1, 2, 3].map((item) => <span key={item} className="h-5 w-5 rounded dahab-shimmer" />)}
        </div>
      </div>
    </header>
  )
}

export default function PageLoading() {
  return (
    <main dir="rtl" className="min-h-screen bg-[var(--bg)]">
      <HeaderSkeleton />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="h-3 w-28 rounded dahab-shimmer" />
        <div className="mt-5 h-12 w-72 max-w-full rounded-xl dahab-shimmer" />
        <div className="mt-3 h-4 w-96 max-w-full rounded dahab-shimmer" />
        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map((item) => (
            <div key={item} className="overflow-hidden rounded-3xl bg-white">
              <div className="aspect-[3/4] dahab-shimmer" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-2/3 rounded dahab-shimmer" />
                <div className="h-3 w-1/3 rounded dahab-shimmer" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
