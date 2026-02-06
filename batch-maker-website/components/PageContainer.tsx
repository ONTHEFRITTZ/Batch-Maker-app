import Navbar from "./Navbar"
import Footer from "./Footer"
import Head from "next/head"

export default function PageContainer({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <Head>
        <title>{title} - Batch Maker</title>
      </Head>

      <div className="min-h-screen bg-[#E8E8E8]">
        <Navbar />

        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="bg-white/90 rounded-3xl shadow-lg p-8 md:p-12">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {title}
              </h1>
            </div>

            <div className="max-w-4xl mx-auto">
              {children}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}