import { useState } from "react"
import Link from "next/link"
import Head from "next/head"

export default function Dashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Show login form if not logged in
  if (!isLoggedIn) {
    return (
      <>
        <Head>
          <title>Sign In - Batch Maker</title>
        </Head>

        <div className="min-h-screen bg-[#E8E8E8] flex items-center justify-center px-6">
          <div className="bg-white rounded-3xl shadow-lg p-12 w-full max-w-md">
            {/* Logo */}
            <div className="text-center mb-8">
              <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
                <img
                  src="/assets/icons/logo.png"
                  alt="Batch Maker logo"
                  className="h-10 w-10"
                />
                <span className="text-xl font-semibold text-gray-900">Batch Maker</span>
              </Link>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Sign In to Your Account
            </h1>

            {/* Social Sign In Buttons */}
            <div className="space-y-4">
              <button 
                onClick={() => setIsLoggedIn(true)}
                className="w-full bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-900 px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-3 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button 
                onClick={() => setIsLoggedIn(true)}
                className="w-full bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-3 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Continue with Apple
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">or</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A8C5B5] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A8C5B5] focus:border-transparent"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsLoggedIn(true)}
                className="w-full bg-[#A8C5B5] hover:bg-[#8FB5A0] text-white py-3 rounded-lg font-medium transition-colors"
              >
                Sign In
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-gray-600">
                Don't have an account?{" "}
                <Link href="/register" className="text-[#A8C5B5] hover:text-[#8FB5A0] font-medium">
                  Sign up
                </Link>
              </p>
              <Link href="/" className="block text-sm text-gray-500 hover:text-gray-700">
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Show dashboard if logged in
  return (
    <>
      <Head>
        <title>Dashboard - Batch Maker</title>
      </Head>

      <div className="min-h-screen bg-[#E8E8E8]">
        {/* Dashboard Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <img src="/assets/icons/logo.png" alt="Batch Maker" className="h-9 w-9" />
              <span className="text-lg font-semibold">Batch Maker</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link href="/account" className="text-gray-600 hover:text-gray-900">
                Account
              </Link>
              <button
                onClick={() => setIsLoggedIn(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">Welcome back! Manage your workflows and batches.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="text-sm text-gray-500 mb-1">Active Workflows</div>
              <div className="text-3xl font-bold text-gray-900">12</div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="text-sm text-gray-500 mb-1">Batches This Week</div>
              <div className="text-3xl font-bold text-gray-900">47</div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="text-sm text-gray-500 mb-1">Team Members</div>
              <div className="text-3xl font-bold text-gray-900">5</div>
            </div>
          </div>

          {/* Premium Features */}
          <div className="bg-white rounded-3xl shadow-lg p-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Premium Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-[#A8C5B5]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#A8C5B5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Unlimited Workflows</h3>
                  <p className="text-sm text-gray-600">Create and manage unlimited recipes and SOPs</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-[#A8C5B5]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#A8C5B5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Team Collaboration</h3>
                  <p className="text-sm text-gray-600">Share workflows with your team members</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-[#A8C5B5]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#A8C5B5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Analytics & Reports</h3>
                  <p className="text-sm text-gray-600">Track productivity and batch performance</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-[#A8C5B5]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#A8C5B5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Cloud Sync</h3>
                  <p className="text-sm text-gray-600">Access your data from any device</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <Link 
                href="/account"
                className="inline-flex items-center gap-2 text-[#2f5ee9] hover:text-[#2e7eeece] font-medium"
              >
                Manage Subscription
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}