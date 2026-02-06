import Link from "next/link"

export default function AuthContainer({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-bakery-bg">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-soft">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <img
              src="/assets/icons/icon.png"
              alt="Batch Maker logo"
              className="h-8 w-8"
            />
            <span className="font-semibold">Batch Maker</span>
          </Link>

          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>

        {children}
      </div>
    </main>
  )
}
