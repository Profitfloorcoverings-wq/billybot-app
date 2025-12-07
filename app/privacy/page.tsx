const LAST_UPDATED = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(new Date());

export default function PrivacyPage() {
  return (
    <div className="page-container">
      <h1 className="section-title">Privacy Policy</h1>
      <p className="section-subtitle">Last updated: {LAST_UPDATED}</p>

      <div className="card stack gap-4">
        <p>
          Placeholder privacy details for now. This page will explain what data
          BillyBot collects, how it is used, and how it is protected.
        </p>
        <p>
          Swap this content with the finalized privacy language when available.
          The current text is present to illustrate the structure and styling of
          the policy page.
        </p>
        <p>
          You can add sections about data retention, user rights, cookies, and
          contact information here to complete the policy.
        </p>
      </div>
    </div>
  );
}
