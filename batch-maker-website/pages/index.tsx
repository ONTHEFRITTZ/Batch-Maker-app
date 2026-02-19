import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Nav, Footer } from '../components/MarketingLayout'
import { getSupabaseClient } from '../lib/supabase'

const supabase = getSupabaseClient()

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // Check role and redirect appropriately
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        const isPremium = profile?.role === 'premium' || profile?.role === 'admin'
        router.replace(isPremium ? '/dashboard' : '/account')
      } else {
        setLoading(false)
      }
    }
    checkUser()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#A8C5B5] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <section
        className="relative py-24 px-6"
        style={{
          backgroundImage: 'url("/assets/images/1920x1080-horizontal-bg.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-white/70" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-block bg-[#A8C5B5]/20 text-[#5a8a74] text-sm font-medium px-4 py-2 rounded-full mb-6">
            30-day free trial — no credit card required
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Run your batches.<br />Not your spreadsheets.
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Batch Maker helps food producers track workflows, manage inventory, and schedule production — all in one place.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register" className="bg-[#A8C5B5] hover:bg-[#8FB5A0] text-white px-8 py-3 rounded-xl font-semibold text-lg transition-colors">
              Start Free Trial
            </Link>
            <Link href="/login" className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-xl font-semibold text-lg transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Everything you need to run production</h2>
          <p className="text-center text-gray-500 mb-14 max-w-xl mx-auto">
            Built for bakeries, kitchens, and food manufacturers who need more than a recipe binder.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '📋', title: 'Workflow Tracking', desc: 'Create and manage production workflows. Assign steps, track progress, and keep your team aligned.' },
              { icon: '📦', title: 'Inventory Management', desc: 'Monitor stock levels, log transactions, and get automatic shopping list suggestions.' },
              { icon: '📅', title: 'Production Scheduling', desc: 'Plan your batches ahead of time with a visual calendar and schedule view.' },
              { icon: '📊', title: 'Analytics', desc: 'Understand your output, track batch history, and identify trends over time.' },
              { icon: '🏢', title: 'Multi-Location', desc: 'Manage workflows and inventory across multiple production locations.' },
              { icon: '👥', title: 'Team Management', desc: 'Invite team members, manage access, and keep everyone on the same page.' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-500 mb-8">Start with a 30-day free trial. Then just $25/month — cancel anytime.</p>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 mb-8">
            <div className="text-5xl font-bold text-gray-900 mb-1">$25</div>
            <div className="text-gray-500 mb-6">per month</div>
            <ul className="text-left space-y-3 mb-8 max-w-xs mx-auto">
              {['30-day free trial', 'Unlimited workflows', 'Inventory & scheduling', 'Analytics dashboard', 'Multi-location support', 'Cancel anytime'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-700 text-sm">
                  <span className="text-[#A8C5B5] font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/register" className="inline-block bg-[#A8C5B5] hover:bg-[#8FB5A0] text-white px-8 py-3 rounded-xl font-semibold transition-colors">
              Start Free Trial
            </Link>
          </div>
          <p className="text-sm text-gray-400">Subscriptions managed via Apple App Store or Google Play</p>
        </div>
      </section>

      <Footer />
    </div>
  )
}