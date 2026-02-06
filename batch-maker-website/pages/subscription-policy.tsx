import PageContainer from "../components/PageContainer"

export default function SubscriptionPolicy() {
  return (
    <PageContainer title="SUBSCRIPTION POLICY">
      <div className="space-y-8">
        <p className="text-gray-600 text-center">
          Last updated January 2026
        </p>

        <div className="prose prose-gray max-w-none">
          <h2>Pricing</h2>
          <ul>
            <li>30-day free trial</li>
            <li>$5 USD per month</li>
            <li>$50 USD per year (save 17%)</li>
          </ul>

          <h2>Auto-Renewal</h2>
          <p>
            Subscriptions renew automatically unless canceled at least 24 hours
            before the end of the current period.
          </p>

          <h2>Management</h2>
          <p>
            Billing and cancellations are handled by Apple App Store or Google Play.
            Manage your subscription in your account settings or through your device's
            subscription management system.
          </p>

          <h2>Free Trial</h2>
          <p>
            Your free trial is for 30 days. You can cancel at any time during the trial
            period without being charged. If you don't cancel, your subscription will
            automatically begin at the end of the trial period.
          </p>

          <h2>Cancellation</h2>
          <p>
            You can cancel your subscription at any time. When you cancel, you'll continue
            to have access until the end of your current billing period. No refunds are
            provided for partial periods.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about your subscription? Contact us at{" "}
            <a href="mailto:batch.maker.app@gmail.com" className="text-[#2f5ee9] hover:text-[#2e7eeece]">
              batch.maker.app@gmail.com
            </a>.
          </p>
        </div>
      </div>
    </PageContainer>
  )
}