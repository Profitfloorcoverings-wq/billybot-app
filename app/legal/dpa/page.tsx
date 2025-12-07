export default function DataProcessingAgreementPage() {
  return (
    <main className="page-container standard">
      <div className="card prose prose-invert">
        <h1>Data Processing Agreement</h1>
        <p>
          This Data Processing Agreement ("DPA") forms part of your subscription with BillyBot
          and applies where BillyBot processes personal data on your behalf. In this DPA,
          "Controller" means your business, and "Processor" means BillyBot.
        </p>

        <h2>Subject matter and duration</h2>
        <p>
          BillyBot processes personal data to provide AI-assisted quoting, customer messaging,
          automation, and storage services. Processing continues for the duration of your
          subscription and any wind-down period required for deletion or return of data.
        </p>

        <h2>Nature and purpose of processing</h2>
        <p>
          Personal data is processed to draft quotes, generate materials lists, store customer
          information, send communications, and operate analytics and security features that
          support the service you request.
        </p>

        <h2>Data subjects and data types</h2>
        <ul>
          <li>Data subjects: your customers, prospects, staff members, subcontractors, and end recipients of messages.</li>
          <li>Data types: names, contact details, job addresses, job descriptions, material requirements, pricing details, message content, and any files you upload.</li>
        </ul>

        <h2>Roles and responsibilities</h2>
        <p>
          You, as Controller, determine the purposes and means of processing and are
          responsible for the lawfulness of the data you supply. BillyBot acts as Processor and
          processes personal data only on your documented instructions as outlined in this DPA
          and your account settings.
        </p>

        <h2>Confidentiality</h2>
        <p>
          BillyBot ensures personnel are bound by confidentiality obligations and receive
          training on data protection appropriate to their roles.
        </p>

        <h2>Sub-processors</h2>
        <p>
          BillyBot engages sub-processors to deliver the service, including Supabase (database
          and authentication), Stripe (billing), OpenAI (AI inference), and cloud hosting and
          monitoring providers. We remain responsible for their performance and will notify you
          of any material changes to sub-processors where feasible. You authorise use of these
          sub-processors for the duration of the service.
        </p>

        <h2>Cross-border transfers</h2>
        <p>
          Personal data may be transferred outside the UK or EEA by sub-processors. Where
          transfers occur, BillyBot relies on appropriate safeguards such as Standard
          Contractual Clauses, data processing addenda, or recognised certifications.
        </p>

        <h2>Security measures</h2>
        <p>
          BillyBot implements technical and organisational measures including HTTPS, access
          controls, encryption in transit, least-privilege permissions, audit logging, and
          monitoring. You are responsible for enforcing appropriate access control for your
          users and ensuring secure input of data.
        </p>

        <h2>Breach notification</h2>
        <p>
          BillyBot will notify you without undue delay after becoming aware of a personal data
          breach affecting your data. The notification will describe the nature of the breach,
          likely consequences, and steps taken or proposed to mitigate adverse effects.
        </p>

        <h2>Assistance and audits</h2>
        <p>
          BillyBot will assist you in responding to data subject requests and demonstrating
          compliance with applicable data protection laws, within the limits of the service.
          Reasonable audit requests will be accommodated subject to confidentiality and cost
          recovery where appropriate.
        </p>

        <h2>Deletion and return of data</h2>
        <p>
          Upon termination of the service, BillyBot will delete or anonymise personal data
          within a reasonable period, subject to backups and legal retention requirements. On
          request, we will provide a final export of your core data where technically feasible.
        </p>

        <h2>Client responsibilities</h2>
        <ul>
          <li>Obtain necessary consents and provide required notices to data subjects.</li>
          <li>Ensure data uploaded is accurate, lawful, and limited to what is necessary.</li>
          <li>Configure access controls and verify outputs before sharing with customers.</li>
          <li>Notify BillyBot promptly of any suspected misuse of accounts or credentials.</li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions about this DPA can be sent to legal@billybot.com. Continued use of
          BillyBot constitutes acceptance of these processing terms.
        </p>
      </div>
    </main>
  );
}
