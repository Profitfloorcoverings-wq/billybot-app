export default function PrivacyPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="page-container">
      <h1 className="section-title">Privacy Policy</h1>
      <p className="section-subtitle">Last updated: {lastUpdated}</p>

      <div className="card stack gap-4">
        <section className="stack gap-2">
          <h2 className="section-subtitle">What Personal Data We Collect</h2>
          <p>
            We collect account details (name, email, company), authentication
            information, billing details, and any customer or project
            information you provide while using BillyBot.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">How Supabase and Stripe Are Used</h2>
          <p>
            Supabase is used for authentication, database storage, and managing
            user sessions. Stripe processes payments and stores billing-related
            information necessary to complete transactions.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Messages, Quotes, and Storage</h2>
          <p>
            Messages, quotes, and related job details you enter are stored to
            provide the AI assistant, automation, and communication features.
            This data helps generate responses, draft quotes, and keep history
            for your account.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Cookies and Sessions</h2>
          <p>
            We use cookies and session data to keep you signed in, secure your
            account, and remember preferences. Some cookies may be necessary for
            core functionality such as authentication.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Why We Collect Data</h2>
          <p>
            Data is collected to operate BillyBot, deliver AI-driven quotes and
            automations, process payments, improve product performance, and
            provide customer support.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">How We Protect User Data</h2>
          <p>
            We employ industry-standard security measures, including encryption
            in transit, access controls, and monitoring. Access to your data is
            limited to authorized personnel and necessary service providers.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Your Rights Under UK GDPR</h2>
          <p>
            Users in the United Kingdom have rights to access, correct, delete,
            or restrict processing of their personal data. You may also object to
            certain processing or request data portability. Contact us to
            exercise these rights.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Data Retention</h2>
          <p>
            We retain personal data for as long as necessary to provide the
            service, comply with legal obligations, resolve disputes, and
            enforce agreements. Data may be archived or deleted when no longer
            needed.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Third-Party Services</h2>
          <p>
            We rely on third-party providers such as Supabase for hosting and
            authentication, and Stripe for payments. These providers process data
            under their own privacy practices and agreements with us.
          </p>
        </section>

        <section className="stack gap-2">
          <h2 className="section-subtitle">Contact Information</h2>
          <p>
            For questions about this Privacy Policy or to submit a data request,
            contact support@billybot.com.
          </p>
        </section>
      </div>
    </div>
  );
}
