export default function Footer() {
  return (
    <footer className="bg-white/90 backdrop-blur-sm mt-12 relative z-10">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2 text-gray-900 flex-shrink-0">
            <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">B</span>
            </div>
            <span className="text-sm font-semibold">BATCH MAKER</span>
          </div>

          {/* Links - Now with better spacing and no wrapping on desktop */}
          <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-6 text-sm text-gray-600">
            <a href="/privacy-policy" className="hover:text-gray-900 transition-colors whitespace-nowrap">
              Privacy Policy
            </a>
            <a href="/terms-of-service" className="hover:text-gray-900 transition-colors whitespace-nowrap">
              Terms of Service
            </a>
            <a href="/subscription-policy" className="hover:text-gray-900 transition-colors whitespace-nowrap">
              Subscription
            </a>
            <a href="/support" className="hover:text-gray-900 transition-colors whitespace-nowrap">
              Support
            </a>
          </div>

          {/* Copyright */}
          <div className="text-sm text-gray-500 flex-shrink-0">
            © {new Date().getFullYear()} BATCH MAKER INC
          </div>
        </div>
      </div>
    </footer>
  )
}