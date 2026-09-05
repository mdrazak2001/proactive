import { useEffect, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

type LegalDocument = 'privacy' | 'terms';

interface LegalSection {
  id: string;
  label: string;
  title: string;
  content: ReactNode;
}

interface LegalPageProps {
  document: LegalDocument;
}

const privacySections: LegalSection[] = [
  {
    id: 'information',
    label: '01',
    title: 'Information Proactive processes',
    content: (
      <>
        <p>
          When you choose Google sign-in, Proactive uses SpacetimeAuth and
          OpenID Connect to request basic identity information: a stable
          account identifier, your name, email address, and profile details
          such as your profile image. Proactive uses this information to
          authenticate you, maintain your session, show who is participating,
          and enforce access boundaries.
        </p>
        <p>
          Google sign-in does not give Proactive access to your Gmail, Google
          Drive, Calendar, Contacts, or other Google product content.
        </p>
        <p>
          Proactive also processes information you deliberately submit or
          create in the app, such as room participation, investigation prompts,
          transcript segments, approvals, and evidence receipts. When an
          authorized user runs a connector check, Proactive processes the
          bounded result returned by that configured provider.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    label: '02',
    title: 'How information is used',
    content: (
      <>
        <p>Proactive uses the information described above to:</p>
        <ul>
          <li>sign you in and protect access to the application;</li>
          <li>operate and synchronize the shared investigation experience;</li>
          <li>perform the bounded checks an authorized user requests; and</li>
          <li>secure, diagnose, and improve the private preview.</li>
        </ul>
        <p>
          Proactive does not use Google identity information for advertising or
          to access content in other Google products.
        </p>
      </>
    ),
  },
  {
    id: 'credentials',
    label: '03',
    title: 'Credentials and connected services',
    content: (
      <>
        <p>
          Credentials for connected signal providers are configured and used
          on the server. They are not sent to the browser or shown to other
          people in a room. The browser receives safe status information and
          the bounded results or receipts needed for the product experience.
        </p>
        <p>
          Google and SpacetimeAuth process the sign-in flow. SpacetimeDB stores
          and synchronizes application state for the deployment. A connected
          provider receives only the request initiated through its configured
          connector. Those services handle information under their own terms
          and privacy practices.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    label: '04',
    title: 'Storage, retention, and security',
    content: (
      <>
        <p>
          Identity tokens are handled by the browser authentication client and
          validated before protected services are used. The application is
          designed to keep provider credentials behind the server boundary and
          to limit connector operations to configured scopes.
        </p>
        <p>
          This private preview does not yet publish a fixed retention period.
          Application state may remain in the active deployment until it is
          removed or that environment is reset. Do not submit information you
          are not authorized to use in the preview.
        </p>
      </>
    ),
  },
  {
    id: 'choices',
    label: '05',
    title: 'Your choices',
    content: (
      <>
        <p>
          You can sign out at any time. You may also revoke Proactive's Google
          sign-in access from your Google Account. Revoking sign-in prevents
          future authentication but does not automatically remove application
          state already created in Proactive.
        </p>
        <p>
          To ask about, access, or request deletion of account-associated
          information, use the support contact displayed on Proactive's OAuth
          consent screen.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    label: '06',
    title: 'Policy changes and contact',
    content: (
      <>
        <p>
          This policy may change as the preview evolves. The effective date at
          the top of this page will be updated when the policy changes.
        </p>
        <p>
          For privacy questions, use the support contact displayed on
          Proactive's OAuth consent screen.
        </p>
      </>
    ),
  },
];

const termsSections: LegalSection[] = [
  {
    id: 'preview',
    label: '01',
    title: 'Private-preview access',
    content: (
      <>
        <p>
          These terms govern your use of the Proactive private-preview web app.
          By using the app, you agree to these terms. If you use Proactive for
          an organization, you confirm that you are authorized to act for that
          organization within the access you are given.
        </p>
        <p>
          The preview may change, pause, or contain errors while the product is
          being developed. Features described in the interface may be simulated
          or marked as upcoming; demo data is labeled in the product.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    label: '02',
    title: 'Accounts and access',
    content: (
      <>
        <p>
          Use only an account you are authorized to use. You are responsible
          for activity performed through your authenticated session and for
          keeping your device and sign-in session secure. Google manages your
          Google account credentials; Proactive does not receive your Google
          password.
        </p>
        <p>
          Access may be limited to approved accounts or workspaces and may be
          withdrawn when needed to protect the preview or connected systems.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    label: '03',
    title: 'Acceptable use',
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>access accounts, data, projects, or services without permission;</li>
          <li>bypass access controls, connector scopes, or safety limits;</li>
          <li>disrupt, probe, overload, or misuse the app or its providers; or</li>
          <li>use Proactive in a way that violates law or another person's rights.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'integrations',
    label: '04',
    title: 'Connected systems and outputs',
    content: (
      <>
        <p>
          Only connect services and initiate checks that you have permission to
          use. Provider credentials stay in server-side configuration. Current
          connector operations are designed as bounded, read-only checks, but
          you remain responsible for reviewing each scope and provider setting.
        </p>
        <p>
          Investigation results can be incomplete, delayed, or incorrect. Keep
          a human in control, verify important findings against their source,
          and do not treat Proactive as the sole basis for safety-critical,
          security-critical, legal, medical, or financial decisions.
        </p>
      </>
    ),
  },
  {
    id: 'content',
    label: '05',
    title: 'Your content',
    content: (
      <>
        <p>
          You retain any rights you have in information you submit. You permit
          Proactive to process that information only as needed to operate,
          secure, and improve the preview. Do not submit confidential,
          regulated, or personal information unless you are authorized to do
          so and the preview is appropriate for that information.
        </p>
      </>
    ),
  },
  {
    id: 'third-parties',
    label: '06',
    title: 'Third-party services',
    content: (
      <>
        <p>
          Proactive relies on services including Google, SpacetimeAuth,
          SpacetimeDB, and any signal provider configured for a deployment.
          Their availability and handling of information are governed by their
          own terms and policies.
        </p>
      </>
    ),
  },
  {
    id: 'responsibility',
    label: '07',
    title: 'Preview responsibility',
    content: (
      <>
        <p>
          The preview is provided as available and without warranties not
          required by law. You are responsible for independently verifying
          outputs, maintaining backups where appropriate, and deciding whether
          the preview is suitable for your use.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    label: '08',
    title: 'Changes and contact',
    content: (
      <>
        <p>
          These terms may change as the preview develops. Continued use after an
          updated effective date means the updated terms apply to your later use.
        </p>
        <p>
          For questions about these terms, use the support contact displayed on
          Proactive's OAuth consent screen.
        </p>
      </>
    ),
  },
];

const documents = {
  privacy: {
    eyebrow: 'DATA BOUNDARY',
    title: 'Privacy policy',
    summary:
      'A plain-language account of the identity, room, and connector information used by the Proactive private preview.',
    noteTitle: 'Basic identity only',
    noteBody:
      'Google sign-in requests your name, email, profile details, and a stable account identifier for authentication. It does not request access to Gmail, Drive, Calendar, or Contacts.',
    sections: privacySections,
  },
  terms: {
    eyebrow: 'USAGE BOUNDARY',
    title: 'Terms of use',
    summary:
      'The ground rules for using Proactive safely while the product is in private preview.',
    noteTitle: 'Human authority stays in the room',
    noteBody:
      'Use only systems you are authorized to access. Review scopes and source evidence before relying on an investigation result.',
    sections: termsSections,
  },
} satisfies Record<LegalDocument, {
  eyebrow: string;
  title: string;
  summary: string;
  noteTitle: string;
  noteBody: string;
  sections: LegalSection[];
}>;

function Brand() {
  return (
    <Link className="legal-brand" to="/" aria-label="Proactive home">
      <span className="legal-brand__mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>PROACTIVE</span>
    </Link>
  );
}

export default function LegalPage({ document }: LegalPageProps) {
  const page = documents[document];

  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = `${page.title} — Proactive`;
    window.scrollTo({ top: 0 });
    return () => {
      window.document.title = previousTitle;
    };
  }, [page.title]);

  return (
    <div className="legal-page">
      <a className="legal-skip-link" href="#legal-document">Skip to document</a>

      <header className="legal-header">
        <Brand />
        <nav className="legal-header__nav" aria-label="Legal pages">
          <Link to="/privacy" aria-current={document === 'privacy' ? 'page' : undefined}>
            Privacy
          </Link>
          <Link to="/terms" aria-current={document === 'terms' ? 'page' : undefined}>
            Terms
          </Link>
        </nav>
        <Link className="legal-header__back" to="/">
          <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.8} />
          Back to product
        </Link>
      </header>

      <main className="legal-layout">
        <article className="legal-document" id="legal-document">
          <header className="legal-document__header">
            <p className="legal-eyebrow">
              <span aria-hidden="true" /> {page.eyebrow}
            </p>
            <h1>{page.title}</h1>
            <p className="legal-document__summary">{page.summary}</p>
            <p className="legal-effective">Effective September 5, 2026</p>
          </header>

          <aside className="legal-note" aria-label="Policy summary">
            <span>{document === 'privacy' ? 'GOOGLE SIGN-IN' : 'PRIVATE PREVIEW'}</span>
            <strong>{page.noteTitle}</strong>
            <p>{page.noteBody}</p>
          </aside>

          <div className="legal-sections">
            {page.sections.map(section => (
              <section id={section.id} key={section.id}>
                <div className="legal-section__heading">
                  <span>{section.label}</span>
                  <h2>{section.title}</h2>
                </div>
                <div className="legal-section__body">{section.content}</div>
              </section>
            ))}
          </div>
        </article>

        <aside className="legal-index" aria-label={`${page.title} contents`}>
          <p>IN THIS DOCUMENT</p>
          <ol>
            {page.sections.map(section => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  <span>{section.label}</span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>
      </main>

      <footer className="legal-footer">
        <Brand />
        <p>Live incident investigation · Private preview</p>
        <nav aria-label="Footer legal navigation">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
