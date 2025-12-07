export default function TermsPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="page-container">
      <h1 className="section-title">Terms of Service</h1>
      <p className="section-subtitle">Last updated: {lastUpdated}</p>

      <div className="card stack gap-4">
        <section className="stack gap-2">
          <h2 className="section-subtitle">Introduction and Acceptance of Terms</h2>
          <p>
            These Terms of Service govern your access to and use of BillyBot, an AI
            automation platform built to help tradespeople manage quoting,
            messaging, and workflow tasks. By using BillyBot, you agree to these
            terms and any additional policies referenced here.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Description of Service</h2>
          <p>
            BillyBot provides an AI-powered quoting assistant, automation tools,
            customer messaging, and related features designed to streamline your
            operations. The service may integrate with third-party platforms to
            send messages, generate quotes, and automate routine tasks.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">No Guarantee of Accuracy of AI Outputs</h2>
          <p>
            BillyBot uses AI to generate content such as quotes, responses, and
            recommendations. AI outputs may contain errors, omissions, or
            outdated information. BillyBot does not guarantee the accuracy,
            completeness, or suitability of any AI-generated content.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">User Responsibility</h2>
          <p>
            You must review and verify all AI-generated quotes, prices, job
            details, and messages before sharing them with customers or taking
            action. BillyBot is an assistive tool. You hold final responsibility
            for ensuring the accuracy of all outputs and for any decisions made
            using the service.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Liability Limitation</h2>
          <p>
            BillyBot cannot be held responsible for financial loss, lost revenue,
            reputational damage, or other harm resulting from inaccurate quotes,
            automation errors, or misuse of the service. To the fullest extent
            permitted by law, BillyBot disclaims all liability for any indirect,
            incidental, consequential, or special damages. You accept all risks
            associated with relying on AI-generated outputs and automations.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Billing and Subscription Terms</h2>
          <p>
            Access to certain features may require a paid subscription. Fees,
            billing cycles, and payment methods will be presented during checkout
            or within your account settings. By subscribing, you authorize
            recurring charges until you cancel. Applicable taxes may be added.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Cancellation and Refunds</h2>
          <p>
            You may cancel your subscription at any time through your account
            settings. Cancellations take effect at the end of the current billing
            period. Unless required by law, fees already paid are non-refundable.
            Any exceptions will be stated at the point of purchase or in your
            plan details.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Data Usage</h2>
          <p>
            To provide the service, BillyBot may process customer details,
            project information, messages, and operational data you supply. Data
            handling practices are described in our Privacy Policy. You are
            responsible for ensuring you have the right to share any data you
            submit.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Prohibited Actions</h2>
          <p>
            You agree not to misuse the service, including by attempting to
            access other users&apos; data, reverse-engineering the platform, sending
            spam or unlawful messages, or using BillyBot in violation of
            applicable laws and regulations.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Termination</h2>
          <p>
            We may suspend or terminate your access if you violate these terms or
            misuse the service. You may also terminate your account at any time
            through your settings. Upon termination, your right to use BillyBot
            ends, but any payment obligations accrued before termination remain
            due.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Governing Law</h2>
          <p>
            These terms are governed by the laws of the United Kingdom, without
            regard to conflict of law principles. Any disputes will be subject to
            the exclusive jurisdiction of the courts of the United Kingdom.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Contact Information</h2>
          <p>
            If you have questions about these terms, please contact the BillyBot
            team at support@billybot.com.
          </p>
        </section>
      </div>
    </div>
  );
}
