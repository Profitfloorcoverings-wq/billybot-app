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
        <p>
          Placeholder text for now. This privacy policy will describe how
          BillyBot collects, uses, and protects your data. We will publish the
          full policy soon.
        </p>
        <p>
          Until then, please know that your privacy matters to us and we are
          working to finalize the full details.
        </p>
      </div>
    </div>
  );
}
