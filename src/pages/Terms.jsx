import { Link } from 'react-router-dom';

export function Terms() {
  const email = import.meta.env.VITE_CONTACT_EMAIL;

  return (
    <div className="min-h-screen bg-background px-6 pt-12 pb-24 max-w-xl mx-auto">
      <div className="mb-6">
        <Link 
          to="/" 
          className="text-xs font-accent tracking-widest uppercase text-foreground-tertiary hover:text-foreground transition duration-200"
        >
          ← Back to Library
        </Link>
      </div>

      <h1 className="text-4xl font-serif font-normal text-foreground mb-8">Terms</h1>

      <section className="space-y-2 mb-8">
        <h2 className="text-xs font-accent text-foreground-tertiary tracking-widest uppercase">
          Your files
        </h2>
        <p className="text-sm text-foreground leading-relaxed">
          Only upload files you own or have the right to use. Your files are private
          to your account. Other readers cannot see or open them.
        </p>
      </section>

      <section className="space-y-2 mb-8">
        <h2 className="text-xs font-accent text-foreground-tertiary tracking-widest uppercase">
          Removal requests
        </h2>
        <p className="text-sm text-foreground leading-relaxed">
          If you believe something on Garder infringes your rights, email{' '}
          {email ? <a className="underline" href={`mailto:${email}`}>{email}</a> : 'us'}{' '}
          with the book title and a short description. We will review it and remove
          it where appropriate.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-accent text-foreground-tertiary tracking-widest uppercase">
          Not legal advice
        </h2>
        <p className="text-sm text-foreground-tertiary leading-relaxed">
          These terms are a plain-language starting point. Garder is a small
          independent project.
        </p>
      </section>
    </div>
  );
}

export default Terms;

