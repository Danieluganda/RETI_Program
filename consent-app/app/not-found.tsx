import Link from "next/link";

export default function NotFound() {
  return (
    <main className="a4-page">
      <section className="form-shell">
        <p className="brand-kicker">10X Program</p>
        <h1>Page not found</h1>
        <p>The page you requested could not be found.</p>
        <Link className="button secondary" href="/consent/sample">
          Open consent form
        </Link>
      </section>
    </main>
  );
}
