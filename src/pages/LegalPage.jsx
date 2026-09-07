import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LegalLinks } from '@/components/LegalLinks';

const updated = '7 September 2026';

const documents = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This page explains what we store when you use Oikos, how we use it (dashboards, weekly digest, and similar summaries), and how Google sign-in works. It is written in plain language. We run this Oikos site, so this policy is ours.',
    sections: [
      {
        heading: 'Who we are',
        body: [
          'We operate this Oikos site. Oikos is a private household expense tracker. If you have an account here, we are the ones holding your data and responsible for how this service is run.',
          'These same privacy terms apply to everyone who uses this site.'
        ]
      },
      {
        heading: 'What we store',
        body: [
          'To run your account we store your name, email address, password hash (if you use email sign-in), profile photo if you upload one, and whether your account is verified and approved.',
          'Expense records you enter (dates, amounts, titles, categories, stores, payment methods) stay in our database. Regular users only see their own expenses. Admins can see more, including all transactions and user accounts, so the household list can be managed.'
        ]
      },
      {
        heading: 'How we use your data',
        body: [
          'We use your account and expense records to run the tracker: show your spending, build dashboards and charts (totals, categories, stores, months, filters), and send the weekly spending digest if you leave that on. We also use the same data for related in-app summaries, such as home totals and reports.',
          'We do not sell your data or use it for advertising. We do not share it with third parties except as needed to operate the site (for example Google for sign-in, and our email provider for verification, one-time codes, and the weekly digest).'
        ]
      },
      {
        heading: 'Google sign-in',
        body: [
          'If you continue with Google, Google asks you to share your Google name, email, and (if available) profile photo with us. We use that to create or sign in to your Oikos account, and you can choose to link Google to an existing account.',
          'We do not get your Google password. You can keep using email and password instead. Google’s own privacy policy applies to Google’s services.'
        ]
      },
      {
        heading: 'Cookies and session',
        body: [
          'Sign-in uses a login token stored in your browser. A small cookie may be set only as a hint that you have a session, so the layout can load correctly. We do not use advertising cookies or sell your data.'
        ]
      },
      {
        heading: 'Email',
        body: [
          'We send mail this site needs: email verification, optional one-time sign-in codes, and a weekly spending summary if you leave that on. You can turn the weekly digest off under Me.'
        ]
      },
      {
        heading: 'How long we keep data',
        body: [
          'Your account and expenses stay until you or an admin remove them, or until we delete this site’s database. Deleted expenses may be archived rather than erased immediately.'
        ]
      },
      {
        heading: 'Your choices',
        body: [
          'You can edit your name, email, and photo, change preferences, and log out at any time. To delete your account or ask for a copy of your data, contact us through an admin on this Oikos site.'
        ]
      }
    ]
  },
  terms: {
    title: 'Terms of Service',
    intro: 'These terms are a simple agreement for using Oikos to track household spending. We operate this site, so these terms are the ones that apply.',
    sections: [
      {
        heading: 'The service',
        body: [
          'Oikos is a private expense tracker we host and run. It is meant for household or small-group use, not as a bank, tax advisor, or public social network. Features include logging expenses, dashboards and filters, and an optional weekly digest email. The same terms apply to every account on this site.'
        ]
      },
      {
        heading: 'Accounts',
        body: [
          'You must provide a real email you control. Email and password signups need email verification and admin approval before you can use the full app. Google sign-up is verified by Google and does not wait on admin approval.',
          'You are responsible for keeping your password and Google account secure. If you link Google, you can sign in with that Google account as well as with email and password.'
        ]
      },
      {
        heading: 'Acceptable use',
        body: [
          'Use the app to record your own household spending. Do not try to break in, scrape other people’s data, or use the service for anything illegal. We may refuse, suspend, or delete accounts that abuse the site.'
        ]
      },
      {
        heading: 'Your content',
        body: [
          'The expenses and profile details you enter are your records. By using the app you allow us to store them and use them to run the service: dashboards, charts, filters, home totals, and the weekly digest if you have not opted out. Admins may see user lists and, when needed, all transactions.'
        ]
      },
      {
        heading: 'No warranty',
        body: [
          'The service is provided as-is. Totals and reports are for your own tracking. They may contain mistakes. This site is not a substitute for receipts, bank statements, or professional advice. We are not liable for lost data, downtime, or decisions you make from the numbers shown.'
        ]
      },
      {
        heading: 'Changes',
        body: [
          'We may update the app, these terms, or the privacy policy. Continued use after a change means you accept the new text. If you do not agree, stop using the site and ask an admin to close your account.'
        ]
      }
    ]
  }
};

export default function LegalPage({ document: documentId }) {
  const { user, isApproved } = useAuth();
  const document = documents[documentId] || documents.privacy;
  const other = documentId === 'privacy' ? { to: '/terms', label: 'Terms of Service' } : { to: '/privacy', label: 'Privacy Policy' };
  const showGuestToggle = !(user && isApproved);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-primary">Oikos</p>
          <h1 className="text-3xl font-semibold tracking-tight">{document.title}</h1>
          <p className="text-sm text-muted-foreground">Last updated {updated}</p>
        </div>
        {showGuestToggle ? <ThemeToggle className="size-9 shrink-0" /> : null}
      </div>

      <div className="space-y-6 text-sm leading-relaxed">
        <p className="text-muted-foreground">{document.intro}</p>
        {document.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-base font-semibold tracking-tight">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-8 space-y-2 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          Also see the <Link to={other.to} className="underline-offset-4 hover:underline">{other.label}</Link>.
        </p>
        <LegalLinks className="text-left" />
      </div>
    </div>
  );
}
