import PageContainer from "../components/PageContainer"

export default function TermsOfService() {
  return (
    <PageContainer title="TERMS OF SERVICE">
      <div className="space-y-8">
        <p className="text-gray-600 text-center">
          Last updated January 2026
        </p>

        {/* Three columns layout for key points */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 uppercase text-sm tracking-wide">Digital SOP Creation</h3>
            <p className="text-sm text-gray-600">
              Create and manage standard operating procedures digitally.
            </p>
          </div>

          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 uppercase text-sm tracking-wide">Realtime Checking</h3>
            <p className="text-sm text-gray-600">
              Track batch progress with real-time updates and notifications.
            </p>
          </div>

          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 uppercase text-sm tracking-wide">Custom Pricing</h3>
            <p className="text-sm text-gray-600">
              Flexible subscription plans to fit your kitchen's needs.
            </p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none">
          <p>
            By using Batch Maker, you agree to the following terms. Please read them
            carefully.
          </p>

          <h2>Use of the Service</h2>
          <p>
            Batch Maker is provided to help organize recipes, batches, and production
            workflows. You agree to use the service responsibly and only for lawful
            purposes.
          </p>

          <h2>Accounts</h2>
          <p>
            You are responsible for maintaining the security of your account and for
            any activity that occurs under it. You must provide accurate information
            when creating an account.
          </p>

          <h2>Subscriptions & Billing</h2>
          <p>
            Batch Maker offers a 30-day free trial. After the trial, a paid
            subscription is required to continue using premium features. Prices,
            billing cycles, and renewal terms are clearly presented at the time of
            purchase.
          </p>

          <p>
            Subscriptions automatically renew unless canceled at least 24 hours
            before the end of the current billing period.
          </p>

          <h2>Account Deletion</h2>
          <p>
            You may delete your account and all associated data at any time from
            within your account settings or by contacting support. Account deletion
            is permanent and cannot be undone.
          </p>

          <h2>Availability</h2>
          <p>
            We aim to keep Batch Maker available and reliable, but the service is
            provided "as is" without guarantees of uninterrupted access.
          </p>

          <h2>Changes to These Terms</h2>
          <p>
            These terms may be updated from time to time. Continued use of the
            service after changes take effect constitutes acceptance of the updated
            terms.
          </p>

          <h2>Contact</h2>
          <p>
            If you have questions about these terms, contact us at{" "}
            <a href="mailto:batch.maker.app@gmail.com" className="text-[#2f5ee9] hover:text-[#2e7eeece]">
              batch.maker.app@gmail.com
            </a>.
          </p>
        </div>
      </div>
    </PageContainer>
  )
}