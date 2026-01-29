import PageContainer from "../components/PageContainer"

export default function Support() {
  return (
    <PageContainer title="SUPPORT">
      <div className="space-y-12">
        <p className="text-gray-600 text-center">
          We're here to help get the most out of Batch Maker
        </p>

        {/* Support Options */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-sm">FAQ</h3>
          </div>

          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Tutorials</h3>
          </div>

          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Trainings</h3>
          </div>

          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Contact Us</h3>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-gray-50 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Contact Support
          </h2>
          
          <form className="space-y-6 max-w-2xl mx-auto">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A8C5B5] focus:border-transparent outline-none transition-all"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A8C5B5] focus:border-transparent outline-none transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                id="message"
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A8C5B5] focus:border-transparent outline-none transition-all resize-none"
                placeholder="How can we help?"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#A8C5B5] hover:bg-[#8FB5A0] text-white font-medium py-3 rounded-lg transition-colors"
            >
              SUBMIT
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Or email us directly at{" "}
            <a href="mailto:batch.maker.app@gmail.com" className="text-[#A8C5B5] hover:text-[#8FB5A0] font-medium">
              batch.maker.app@gmail.com
            </a>
          </p>
        </div>

        {/* Additional Info */}
        <div className="prose prose-gray max-w-none">
          <h2>Need Help or Have a Question?</h2>
          <p>
            We're happy to help. Email us anytime at{" "}
            <a href="mailto:batch.maker.app@gmail.com" className="text-[#2f5ee9] hover:text-[#2e7eeece]">
              batch.maker.app@gmail.com
            </a>.
            We do our best to respond as quickly as possible.
          </p>

          <h2>Feedback & Feature Requests</h2>
          <p>
            Batch Maker is built for real kitchens. If something feels clunky or
            missing, let us know — your feedback genuinely helps shape the product.
          </p>

          <h2>Account & Billing</h2>
          <p>
            Questions about trials, subscriptions, or billing? Reach out and we'll
            get you sorted.
          </p>
        </div>
      </div>
    </PageContainer>
  )
}