const LAST_UPDATED = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(new Date());

export default function TermsPage() {
  return (
    <div className="page-container">
      <h1 className="section-title">Terms of Service</h1>
      <p className="section-subtitle">Last updated: {LAST_UPDATED}</p>

      <div className="card stack gap-4">
        <p>
          Placeholder terms for now. This is where the detailed terms of service
          for BillyBot will live, outlining how the product can be used.
        </p>
        <p>
          Replace this copy with the final legal language when it is ready.
          These placeholder paragraphs are here to demonstrate the layout and
          styling for the finished document.
        </p>
        <p>
          Additional sections—such as user responsibilities, acceptable use,
          limitations of liability, and dispute resolution—can be added here as
          needed.
        </p>
      </div>
    </div>
  );
}
