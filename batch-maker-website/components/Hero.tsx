export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight mb-6">
            Calm, clear workflows for busy bakeries
          </h1>

          <p className="text-lg text-bakery-muted mb-8">
            Batch Maker helps small bakeries organize recipes, prep steps,
            and daily workflows — so nothing gets missed during the morning rush.
          </p>

          <div className="flex flex-wrap gap-4">
            <button className="bg-bakery-accent text-white px-6 py-3 rounded-xl shadow-soft">
              App coming soon
            </button>
            <button className="bg-bakery-accentSoft text-bakery-ink px-6 py-3 rounded-xl">
              Learn more
            </button>
          </div>
        </div>

        <div className="relative">
          <img
            src="/assets/images/hero-phone.png"
            alt="Batch Maker app preview"
            className="w-full max-w-md mx-auto drop-shadow-xl"
          />
        </div>
      </div>
    </section>
  )
}
