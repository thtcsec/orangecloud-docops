import { Link } from "react-router-dom";
import { LanguageSwitcher, useI18n } from "../../i18n";

export function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-600 text-sm font-bold text-white">
              OC
            </div>
            <div>
              <div className="text-base font-semibold text-ink-950">
                {t.brand.name}
              </div>
              <div className="text-xs text-ink-500">{t.brand.tagline}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              to="/dashboard"
              className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-500"
            >
              {t.landing.ctaPrimary}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200/70">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_10%_-20%,#ffedd5_0%,transparent_55%),linear-gradient(180deg,#fffaf5_0%,#f8fafc_70%)]"
          />
          <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-600">
              {t.landing.eyebrow}
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink-950 sm:text-5xl">
              {t.brand.name}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-ink-700">
              {t.landing.title}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">
              {t.landing.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="rounded-md bg-accent-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-500"
              >
                {t.landing.ctaPrimary}
              </Link>
              <a
                href="https://github.com/thtcsec/orangecloud-docops/blob/master/docs/ARCHITECTURE.md"
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-slate-50"
              >
                {t.landing.ctaSecondary}
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-4 py-12 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200/80 bg-white/90 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-ink-950">
              {t.landing.whatTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              {t.landing.whatBody}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200/80 bg-white/90 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-ink-950">
              {t.landing.notTitle}
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-500">
              {t.landing.notItems.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="border-y border-slate-200/70 bg-white/70">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-sm font-semibold text-ink-950">
              {t.landing.flowTitle}
            </h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {t.landing.flowItems.map((item, index) => (
                <li
                  key={item}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-ink-700"
                >
                  <div className="font-mono text-xs text-accent-600">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <p className="mt-1">{item}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-sm font-semibold text-ink-950">
            {t.landing.domainsTitle}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-ink-500">
                {t.landing.staging}
              </div>
              <div className="mt-1 font-mono text-ink-900">
                docops-stg.orangecloud.vn
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-ink-500">
                {t.landing.production}
              </div>
              <div className="mt-1 font-mono text-ink-900">
                docops.orangecloud.vn
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-ink-500">
        {t.landing.footer}
      </footer>
    </div>
  );
}
