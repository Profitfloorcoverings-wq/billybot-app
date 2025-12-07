export default function EulaPage() {
  return (
    <main className="page-container standard">
      <div className="card prose prose-invert">
        <h1>End User License Agreement (EULA)</h1>
        <p>
          This End User License Agreement governs your installation and use of BillyBot. By
          accessing or using BillyBot you agree to this EULA. If you do not agree, do not use
          the service.
        </p>

        <h2>License grant</h2>
        <p>
          BillyBot grants you a limited, non-exclusive, non-transferable, revocable license to
          access and use the service for your internal business purposes while your
          subscription remains active.
        </p>

        <h2>License restrictions</h2>
        <ul>
          <li>Do not sublicense, resell, or provide BillyBot to third parties as a hosted service.</li>
          <li>Do not copy, modify, or create derivative works of the service except where permitted by law.</li>
          <li>Do not reverse engineer, decompile, or attempt to extract source code or AI model weights.</li>
          <li>Do not remove or obscure proprietary notices or trademarks.</li>
          <li>Do not use BillyBot to develop competing products using confidential information gained from the service.</li>
        </ul>

        <h2>Intellectual property</h2>
        <p>
          BillyBot and its licensors retain all rights, title, and interest in the service,
          including software, models, trademarks, and documentation. This EULA does not grant
          ownership rights. You retain ownership of the data you submit to the service.
        </p>

        <h2>AI output limitations</h2>
        <p>
          AI-generated content may be inaccurate or incomplete. Outputs are provided for
          drafting assistance only and should not be relied upon without human review. You are
          responsible for verifying all prices, measurements, and job details before using any
          output with customers or suppliers.
        </p>

        <h2>No warranties</h2>
        <p>
          BillyBot is provided "as is" without warranties of any kind. We do not warrant that
          the service will be error-free, uninterrupted, or that AI outputs will meet your
          requirements. You assume all risk arising from use of the service.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, BillyBot is not liable for indirect,
          incidental, special, or consequential damages, loss of profits, loss of business, or
          claims arising from inaccurate AI outputs. Liability, if any, is limited to the fees
          paid in the 3 months preceding the claim.
        </p>

        <h2>Termination</h2>
        <p>
          This license terminates automatically if you breach this EULA or if your
          subscription ends. Upon termination you must stop using BillyBot. Clauses relating to
          intellectual property, AI limitations, liability, and governing law survive
          termination.
        </p>

        <h2>Governing law</h2>
        <p>
          This EULA is governed by the laws of England and Wales, and the courts of England and
          Wales have exclusive jurisdiction.
        </p>
      </div>
    </main>
  );
}
