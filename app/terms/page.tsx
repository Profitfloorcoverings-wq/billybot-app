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
        <p>
          Placeholder text for now. These terms outline the guidelines and
          policies that apply when using BillyBot. Content will be updated soon
          with the full details.
        </p>
        <p>
          In the meantime, please continue enjoying the service while we finish
          preparing the final legal language.
        </p>
      </div>
    </div>
  );
}
