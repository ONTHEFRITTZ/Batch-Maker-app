import PageContainer from "../components/PageContainer"

export default function PrivacyPolicy() {
  return (
    <PageContainer title="PRIVACY POLICY">
      <div className="space-y-8">
        <p className="text-gray-600 text-center">
          Last updated January 2026
        </p>

        <div className="prose prose-gray max-w-none">
          <p>
            Batch Maker respects your privacy. This policy explains how we collect,
            use, and protect your information.
          </p>

          <h2>Information We Collect</h2>
          <p>
            We collect only the information necessary to provide and improve the
            service, such as your email address and basic usage data.
          </p>

          <h2>How We Use Your Information</h2>
          <p>
            Your information is used solely to operate Batch Maker, provide support,
            and improve the product. We do not sell your data.
          </p>

          <h2>Data Storage</h2>
          <p>
            Your data is stored securely using industry-standard infrastructure.
            Reasonable measures are taken to protect it from unauthorized access.
          </p>

          <h2>Account Deletion</h2>
          <p>
            You may delete your account and all associated data at any time from
            within your account settings or by contacting support. Account deletion
            is permanent and cannot be undone.
          </p>

          <h2>Contact</h2>
          <p>
            If you have questions about this policy, please contact us at{" "}
            <a href="mailto:batch.maker.app@gmail.com" className="text-[#2f5ee9] hover:text-[#2e7eeece]">
              batch.maker.app@gmail.com
            </a>.
          </p>
        </div>
      </div>
    </PageContainer>
  )
}