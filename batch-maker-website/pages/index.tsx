import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import Navbar from "../components/Navbar"
import Features from "../components/Features"
import Footer from "../components/Footer"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      } else {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      alert('Error signing in: ' + error.message)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <section className="text-center mb-16">
          <h1 className="text-5xl font-semibold mb-4">
            <span className="bg-gradient-to-br from-bakery-ink to-bakery-muted bg-clip-text text-transparent">
              Batch Maker
            </span>
          </h1>
          <p className="text-xl text-bakery-muted mb-8">
            Simple batch planning for makers, kitchens, and small operations.
          </p>
          
          {/* Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            className="bg-bakery-accent text-white px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition shadow-lg"
          >
            Sign in with Google
          </button>
          
          <p className="text-sm text-bakery-muted mt-4">
            Start your 30-day free trial
          </p>
        </section>

        {/* Description */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 mb-12 shadow-soft">
          <p className="text-lg leading-relaxed">
            Batch Maker helps you organize recipes, plan batches, and keep
            production sane — without bloated features or complexity.
          </p>
        </section>

        {/* Features */}
        <Features />

        {/* Pricing */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-soft">
          <h2 className="text-2xl font-semibold mb-4">Pricing</h2>

          <p className="mb-6">
            Includes a <strong>30-day free trial</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div className="relative border-2 border-bakery-ink rounded-xl p-6 text-center">
              <div className="text-sm uppercase tracking-wide text-bakery-muted font-semibold mb-2">
                Monthly
              </div>
              <div className="text-4xl font-bold">
                $5
                <span className="text-base text-bakery-muted">/mo</span>
              </div>
            </div>

            <div className="relative border-2 border-bakery-ink rounded-xl p-6 text-center">
              <div className="text-sm uppercase tracking-wide text-bakery-muted font-semibold mb-2">
                Yearly
              </div>
              <div className="text-4xl font-bold">
                $50
                <span className="text-base text-bakery-muted">/yr</span>
              </div>

              <span className="absolute -top-3 -right-3 bg-bakery-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                Save 17%
              </span>
            </div>
          </div>

          <p className="text-sm text-bakery-muted italic">
            Subscriptions automatically renew unless canceled at least 24 hours
            before the end of the current period.
          </p>
        </section>

        <Footer />
      </main>
    </>
  )
}