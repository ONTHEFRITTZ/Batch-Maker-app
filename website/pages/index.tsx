import Navbar from "../components/Navbar"
import Features from "../components/Features"
import Footer from "../components/Footer"
import Head from "next/head"

export default function Home() {
  return (
    <>
      <Head>
        <title>Batch Maker - Streamline Your Kitchen's Success</title>
        <meta name="description" content="Effortless SOP Management for Food Service" />
      </Head>

      <div className="min-h-screen bg-[#E8E8E8]">
        <Navbar />

        <main>
          {/* Hero Section */}
          <section className="max-w-7xl mx-auto px-6 py-16">
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center p-12 lg:p-16">
                {/* Left Content */}
                <div className="space-y-6">
                  <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                    BATCH MAKER:
                  </h1>
                  <h2 className="text-4xl font-light text-gray-700 leading-tight">
                    Streamline Your Kitchen's Success
                  </h2>
                  
                  <p className="text-lg text-gray-600">
                    Effortless SOP Management for Food Service
                  </p>

                  {/* App Store Badges */}
                  <div className="flex gap-4 pt-4">
                    <button className="bg-black text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-colors">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      <span className="text-sm font-medium">App Store</span>
                    </button>
                    
                    <button className="bg-black text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-colors">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                      </svg>
                      <span className="text-sm font-medium">Google Play</span>
                    </button>
                  </div>
                </div>

                {/* Right Content - Phone Mockup */}
                <div className="relative flex justify-center">
                  <div className="relative w-full max-w-md">
                    <img
                      src="/assets/images/batchmaker-app.png"
                      alt="Batch Maker App"
                      className="w-full h-auto drop-shadow-2xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section - ADD ID HERE */}
          <section id="features" className="max-w-7xl mx-auto px-6 py-12">
            <div className="bg-white rounded-3xl shadow-lg p-12">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">
                  Designed for Real Kitchens
                </h2>
                <p className="text-gray-600">
                  Everything you need to organize recipes and workflows
                </p>
              </div>
              
              <Features />
            </div>
          </section>

          {/* Pricing Section */}
<section id="pricing" className="max-w-7xl mx-auto px-6 py-12">
  <div className="bg-white rounded-3xl shadow-lg p-12">
    <div className="text-center mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-3">
        Simple, Transparent Pricing
      </h2>
      <p className="text-gray-600">
        Free for individuals. Pay only for team collaboration.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {/* Free Tier */}
      <div className="border-2 border-gray-200 rounded-2xl p-8 hover:border-gray-300 transition-colors">
        <div className="space-y-6">
          <div>
            <div className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-2">
              Individual
            </div>
            <div className="space-y-1">
              <div className="text-5xl font-bold text-gray-900">Free</div>
            </div>
          </div>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#2f5ee9] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Unlimited workflows & batches</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#a8b7c5] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Solo use only</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#A8C5B5] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Local device storage</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#A8C5B5] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Core features included</span>
            </li>
          </ul>

          <button className="w-full py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors">
            Get Started Free
          </button>
        </div>
      </div>

      {/* Team Tier */}
      <div className="relative border-2 border-[#A8C5B5] bg-[#A8C5B5]/5 rounded-2xl p-8 hover:border-[#8FB5A0] transition-colors">
        <div className="absolute -top-3 -right-3 bg-[#D4AF37] text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
          POPULAR
        </div>
        <div className="space-y-6">
          <div>
            <div className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-2">
              Team
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <div className="text-5xl font-bold text-gray-900">$10</div>
                <div className="text-gray-500">/month</div>
              </div>
              <div className="text-sm text-gray-600">Up to 5 active users</div>
            </div>
          </div>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#A8C5B5] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Everything in Free</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#A8C5B5] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700"><strong>Team sync & collaboration</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#A8C5B5] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Cloud storage & backup</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#A8C5B5] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Priority support</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-gray-600 text-sm">
                <strong>$1/month</strong> per additional active user
              </span>
            </li>
          </ul>

          <button className="w-full py-3 px-6 bg-[#A8C5B5] hover:bg-[#8FB5A0] text-white font-medium rounded-lg transition-colors">
            Start Team Trial
          </button>
        </div>
      </div>
    </div>

    {/* Pricing FAQ */}
    <div className="mt-12 pt-8 border-t border-gray-200">
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">
            💡 What's an "active user"?
          </h3>
          <p className="text-gray-600 text-sm">
            An active user is anyone syncing workflows or collaborating with your team through a premium account. Free users working solo don't count as active users.
          </p>
        </div>
        
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">
            📊 Example: A bakery with 8 team members
          </h3>
          <p className="text-gray-600 text-sm">
            Base plan: $10/month (includes 5 users)<br />
            Additional users: 3 × $1 = $3/month<br />
            <strong className="text-gray-900">Total: $13/month</strong>
          </p>
        </div>
      </div>
    </div>

    <p className="text-center text-sm text-gray-500 mt-8 italic">
      Cancel anytime. No long-term contracts or commitments.
    </p>
  </div>
</section>
        </main>

        <Footer />
      </div>
    </>
  )
}