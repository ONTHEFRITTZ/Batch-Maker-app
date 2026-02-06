import Link from "next/link"

export default function Navbar() {
  return (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img
            src="/assets/icons/icon.png"
            alt="Batch Maker logo"
            className="h-9 w-9"
          />
          <span className="text-lg font-semibold text-gray-900">
            Batch Maker
          </span>
        </Link>
        {/* Navigation */}
        <nav className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <Link href="/#features" className="hover:text-gray-900 transition-colors">
              Features
            </Link>
            <Link href="/#pricing" className="hover:text-gray-900 transition-colors">
              Pricing
            </Link>
            <Link href="/support" className="hover:text-gray-900 transition-colors">
              Support
            </Link>
          </div>
          {/* Sign In Button - CHANGED FROM /dashboard TO /login */}
          <Link 
            href="/login" 
            className="bg-[#A8C5B5] hover:bg-[#8FB5A0] text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  )
}