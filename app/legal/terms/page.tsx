export default function TermsOfServicePage() {
  return (
    <main className="page-container standard">
      <div className="card prose prose-invert">
        <h1>Terms of Service</h1>
        <p>
          These Terms of Service ("Terms") govern your access to and use of BillyBot, an
          AI-enabled quoting and communications assistant for trades. By accessing or using
          BillyBot you agree to these Terms. If you use BillyBot on behalf of a business,
          you confirm you are authorised to bind that business.
        </p>

        <h2>Service description</h2>
        <p>
          BillyBot provides tooling to generate, refine and send quotes, automate follow-ups,
          store customer and job information, create material lists, and send SMS or email
          updates. The service relies on artificial intelligence to draft outputs and is
          integrated with third-party providers including Supabase for storage and messaging,
          Stripe for billing, and OpenAI for AI-generated content. BillyBot does not perform
          on-site inspections or independent verification of your data.
        </p>

        <h2>AI accuracy and safety disclaimer</h2>
        <p>
          AI outputs can be incomplete, outdated, or incorrect. BillyBot does not guarantee
          the accuracy, suitability, or completeness of any quote, calculation, material
          list, schedule, or message. You must independently verify all prices, quantities,
          tax calculations, timelines, and job assumptions before sharing anything with
          customers. BillyBot is not responsible for any errors in AI-generated content.
        </p>
        <p>
          You are solely responsible for ensuring all outputs comply with applicable law,
          industry standards, and the specific requirements of each job. Never send quotes or
          instructions to customers without manual review by a qualified person.
        </p>

        <h2>User responsibilities</h2>
        <ul>
          <li>Provide accurate, lawful, and non-misleading information about jobs and customers.</li>
          <li>Review every AI-generated quote, calculation, and material list before use.</li>
          <li>Confirm all prices, taxes, discounts, units, and quantities with suppliers.</li>
          <li>Ensure messaging content is appropriate, lawful, and sent only with proper consent.</li>
          <li>Keep account credentials secure and restrict access to authorised personnel.</li>
        </ul>

        <h2>No guarantee of accuracy</h2>
        <p>
          BillyBot provides recommendations only. AI-generated outputs are provided “as is”
          without warranties of any kind. You accept full responsibility for validating
          whether any output is accurate or suitable for its intended purpose.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, BillyBot, its owners, employees, and
          suppliers are not liable for: (a) loss of profits, revenue, or business; (b) loss of
          data; (c) any indirect or consequential damages; or (d) any cost, loss, or damage
          arising from reliance on AI-generated outputs, pricing errors, or incorrect job
          assumptions. BillyBot is not responsible for financial losses arising from your use
          or misuse of the service. If liability cannot be excluded, it is limited in
          aggregate to the fees you paid to BillyBot in the 3 months preceding the claim.
        </p>

        <h2>Subscription and billing</h2>
        <p>
          BillyBot is offered on a subscription basis. Payments are processed by Stripe on
          your selected billing cycle. You authorise BillyBot and Stripe to charge the payment
          method you provide. Prices and plan features may change; any material change will be
          notified in advance where legally required.
        </p>

        <h2>Cancellation and refunds</h2>
        <p>
          You may cancel at any time via the billing portal. Cancellations take effect at the
          end of the current billing period. Except where required by law, fees already paid
          are non-refundable. Access to BillyBot will continue until the period ends.
        </p>

        <h2>Account responsibilities</h2>
        <p>
          You are responsible for maintaining the confidentiality of your login credentials
          and all activity under your account. You must notify BillyBot promptly of any
          unauthorised access or security incident.
        </p>

        <h2>Prohibited use</h2>
        <ul>
          <li>Using BillyBot for unlawful, harmful, or misleading communications.</li>
          <li>Attempting to reverse engineer, scrape, or disrupt the service or its AI models.</li>
          <li>Sending unsolicited marketing without valid consent.</li>
          <li>Uploading infringing, abusive, or harmful content.</li>
          <li>Misrepresenting AI outputs as professional advice without review.</li>
        </ul>

        <h2>Termination</h2>
        <p>
          BillyBot may suspend or terminate access if you breach these Terms, misuse the
          service, or fail to pay subscription fees. You may terminate by cancelling your
          subscription and ceasing use. Clauses relating to liability, disclaimers, payment
          obligations, and governing law survive termination.
        </p>

        <h2>Governing law</h2>
        <p>
          These Terms are governed by the laws of England and Wales. Courts of England and
          Wales have exclusive jurisdiction, except that we may seek injunctive relief in any
          jurisdiction to protect intellectual property or confidential information.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about these Terms, contact BillyBot at legal@billybot.com. Do not use
          the service if you do not agree to these Terms.
        </p>
      </div>
    </main>
  );
}
