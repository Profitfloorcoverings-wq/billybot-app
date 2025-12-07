export default function PrivacyPolicyPage() {
  return (
    <main className="page-container standard">
      <div className="card prose prose-invert">
        <h1>Privacy Policy</h1>
        <p>
          This Privacy Policy explains how BillyBot collects, uses, and protects personal data
          when you use our AI-powered quoting assistant. By using BillyBot you agree to this
          Policy. BillyBot acts as a processor of customer and messaging data stored for your
          business and as a controller for account and billing data.
        </p>

        <h2>Data we collect</h2>
        <ul>
          <li>Account data: name, email, business details, contact numbers, and addresses.</li>
          <li>Service data: quotes, job details, material lists, customer conversations, and templates.</li>
          <li>Usage and device data: log data, timestamps, browser details, and approximate location.</li>
          <li>Billing data: payment method identifiers and billing history via Stripe.</li>
        </ul>

        <h2>How Supabase stores messages, customers, and quotes</h2>
        <p>
          Supabase provides our database and authentication. Messages, customer profiles,
          quotes, material lists, and job notes you enter are stored in Supabase tables within
          our managed project. Access is restricted to your authenticated account and
          controlled by row-level security. Supabase retains data while your account is active
          and as needed for backups.
        </p>

        <h2>How Stripe handles billing data</h2>
        <p>
          Stripe processes subscription payments on our behalf. Payment details you provide
          are transmitted directly to Stripe and never stored on BillyBot servers. Stripe acts
          as an independent controller for payment processing and retains billing records as
          required by law.
        </p>

        <h2>Session cookies and authentication</h2>
        <p>
          We use Supabase-auth cookies and secure tokens to keep you signed in and to protect
          your workspace. These cookies are required for authentication and expire based on the
          session length. Disabling them will prevent access to the service.
        </p>

        <h2>Why we process data</h2>
        <ul>
          <li>To provide and improve the quoting assistant and automation features.</li>
          <li>To generate AI-assisted drafts of quotes, messages, and materials lists.</li>
          <li>To manage subscriptions, invoicing, and fraud prevention.</li>
          <li>To secure the service, debug issues, and comply with legal obligations.</li>
        </ul>

        <h2>UK GDPR legal basis</h2>
        <p>
          We rely on contractual necessity to provide the service you sign up for; legitimate
          interests to secure, improve, and market BillyBot to existing customers; and consent
          where required for optional communications. You are responsible for ensuring you have
          a lawful basis to upload and process your own customer data.
        </p>

        <h2>Data retention</h2>
        <p>
          Account and service data are kept while you maintain an active subscription. Backups
          are retained for a limited period for disaster recovery. We may retain minimal
          records after cancellation where required for legal or accounting purposes.
        </p>

        <h2>User rights</h2>
        <ul>
          <li>Access: request a copy of personal data we hold about you.</li>
          <li>Rectification: correct inaccurate account or customer information.</li>
          <li>Deletion: request deletion of personal data, subject to legal retention duties.</li>
          <li>Restriction and objection: limit or object to certain processing where applicable.</li>
          <li>Portability: receive personal data you provided in a structured, commonly used format.</li>
        </ul>
        <p>
          Requests can be sent to legal@billybot.com. We will verify identity before acting on
          any request.
        </p>

        <h2>Third-party processors</h2>
        <ul>
          <li>Supabase (database, authentication, storage of messages, customers, and quotes).</li>
          <li>Stripe (billing, subscription management, payment security).</li>
          <li>OpenAI (AI model inference for drafting text from the prompts you provide).</li>
          <li>Cloud hosting and monitoring providers used to run the application securely.</li>
        </ul>

        <h2>Security measures</h2>
        <p>
          We use HTTPS, access controls, least-privilege permissions, and audit logging within
          Supabase and our hosting environment. You are responsible for safeguarding login
          credentials and limiting access to authorised team members.
        </p>

        <h2>Data transfers</h2>
        <p>
          Data may be processed outside the UK or EEA by our providers. Where transfers occur,
          we rely on appropriate safeguards such as Standard Contractual Clauses or provider
          certifications. By using BillyBot you authorise these transfers for service delivery.
        </p>

        <h2>Breach notification</h2>
        <p>
          In the event of a personal data breach affecting your data, we will notify you
          without undue delay, provide details of the breach, and outline steps taken to
          mitigate impact.
        </p>

        <h2>Contact</h2>
        <p>
          If you have questions or wish to exercise your rights, contact legal@billybot.com.
          You may also lodge a complaint with the UK Information Commissioner&rsquo;s Office (ICO).
        </p>
      </div>
    </main>
  );
}
