import { BrandLogo } from "../../components/BrandLogo";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LanguageToggle,
  ThemeToggle,
} from "../../components/HeaderControls";
import { UserMenu } from "../../components/UserMenu";
import { SiteFooter } from "../../components/SiteFooter";
import { useI18n } from "../../i18n";
import { apiGet } from "../../lib/api";
import { appPath } from "../../lib/paths";

type Session = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    organizationId: string;
    authSource: string;
  };
};

export function LandingPage() {
  const { t } = useI18n();
  const preview = t.landing.preview;

  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<Session>("/api/session"),
    retry: false,
    staleTime: 60_000,
  });

  const isAuthenticated = Boolean(session.data?.user);

  return (
    <div className="flex min-h-full flex-col bg-slate-50 text-ink-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/" className="inline-block transition hover:opacity-90">
            <BrandLogo variant="auto" className="h-9 w-auto max-w-[260px]" />
          </Link>

          <div className="flex items-center gap-2.5">
            <LanguageToggle />
            <ThemeToggle />

            {isAuthenticated && session.data?.user ? (
              <>
                <Link
                  to={appPath("/dashboard")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-500"
                >
                  <span>{t.landing.openConsole}</span>
                  <span aria-hidden>→</span>
                </Link>
                <div className="relative">
                  <UserMenu user={session.data.user} />
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-500"
              >
                {t.auth.signIn}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-slate-800">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_10%_-20%,#ffedd5_0%,transparent_55%),linear-gradient(180deg,#fffaf5_0%,#f8fafc_70%)] dark:bg-[radial-gradient(900px_420px_at_10%_-20%,#431407_0%,transparent_50%),linear-gradient(180deg,#0b1220_0%,#111827_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/80 px-3 py-1 text-xs font-semibold text-orange-800 dark:border-orange-950/80 dark:bg-orange-950/40 dark:text-orange-300">
                <span className="flex size-2 rounded-full bg-orange-500 animate-pulse" />
                Cloudflare Edge · Contract-to-Pay Engine
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink-950 sm:text-5xl lg:leading-tight">
                {t.landing.title}
              </h1>

              <div className="mt-5 space-y-3 text-sm leading-relaxed text-ink-500 sm:text-base">
                {t.landing.story.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                {isAuthenticated ? (
                  <Link
                    to={appPath("/dashboard")}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-accent-500 hover:shadow-orange-500/30"
                  >
                    <span>{t.landing.openConsole}</span>
                    <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-accent-500 hover:shadow-orange-500/30"
                  >
                    <span>{t.auth.signIn}</span>
                    <span aria-hidden>→</span>
                  </Link>
                )}

                <a
                  href="https://github.com/thtcsec/orangecloud-docops/blob/master/docs/ARCHITECTURE.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t.landing.ctaSecondary}
                </a>
              </div>
            </div>

            {/* Terminal Live Workflow Preview */}
            <aside
              className="animate-fade-in overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0b1220] text-slate-100 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.55)] ring-1 ring-white/10"
              aria-label={preview.label}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-rose-500/80" />
                  <span className="size-3 rounded-full bg-amber-500/80" />
                  <span className="size-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-[11px] tracking-wide text-slate-400">
                    {preview.label}
                  </span>
                </div>
                <span className="rounded bg-accent-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-400">
                  {preview.badge}
                </span>
              </div>
              <div className="space-y-3.5 p-5 font-mono text-[12px] leading-relaxed">
                <p className="text-slate-400">
                  <span className="text-accent-400 font-bold">$</span> {preview.command}
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-slate-300">
                  <dt className="text-slate-400 font-medium">{preview.doc}</dt>
                  <dd className="truncate text-slate-100 font-semibold">{preview.docValue}</dd>
                  <dt className="text-slate-400 font-medium">{preview.case}</dt>
                  <dd className="text-slate-100 font-semibold">{preview.caseValue}</dd>
                  <dt className="text-slate-400 font-medium">{preview.extract}</dt>
                  <dd>
                    <span className="text-emerald-400">{preview.extractValue}</span>
                  </dd>
                  <dt className="text-slate-400 font-medium">{preview.rules}</dt>
                  <dd>
                    <span className="text-amber-300">{preview.rulesValue}</span>
                  </dd>
                  <dt className="text-slate-400 font-medium">{preview.status}</dt>
                  <dd>
                    <span className="inline-block rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                      {preview.statusValue}
                    </span>
                  </dd>
                </dl>
                <p className="border-t border-white/10 pt-3 text-[11px] text-slate-400">
                  {preview.footer}
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              {t.landing.featuresTitle}
            </h2>
            <p className="mt-2 text-sm text-ink-500 sm:text-base">
              {t.landing.featuresSubtitle}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t.landing.features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-accent-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-orange-800"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-orange-50 text-2xl dark:bg-orange-950/40">
                  {feature.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink-950 group-hover:text-accent-600 dark:group-hover:text-accent-400">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Supported Document Formats */}
        <section className="border-t border-slate-200/70 bg-slate-100/50 py-16 dark:border-slate-800 dark:bg-slate-900/30">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
                {t.landing.formatsTitle}
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {t.landing.formats.map((fmt) => (
                <div
                  key={fmt.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="inline-block rounded-md bg-accent-500/10 px-2.5 py-1 text-xs font-bold font-mono text-accent-700 dark:bg-accent-500/20 dark:text-accent-400">
                    {fmt.badge}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink-950">
                    {fmt.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">
                    {fmt.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What DocOps Is vs Is Not */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-ink-950">
                {t.landing.whatTitle}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-500">
                {t.landing.whatBody.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-ink-950">
                {t.landing.notTitle}
              </h2>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-500">
                {t.landing.notItems.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-accent-600 font-bold">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {/* 5-Step Automated Workflow */}
        <section className="border-y border-slate-200/70 bg-white py-16 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
                {t.landing.flowTitle}
              </h2>
            </div>

            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {t.landing.flowItems.map((item, index) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="font-mono text-xs font-bold text-accent-600 dark:text-accent-400">
                    {String(index + 1).padStart(2, "0")} — {item.title}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-600 dark:text-slate-300">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              {t.landing.faqTitle}
            </h2>
          </div>

          <div className="mt-10 space-y-4">
            {t.landing.faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <h3 className="text-base font-semibold text-ink-950">
                  {faq.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Call to Action (CTA) */}
        <section className="relative overflow-hidden bg-slate-900 px-4 py-16 text-center text-white sm:px-6 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(249,115,22,0.3),rgba(255,255,255,0))]"
          />
          <div className="relative mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t.landing.ctaBottomTitle}
            </h2>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              {t.landing.ctaBottomSubtitle}
            </p>
            <div className="mt-8 flex justify-center gap-3.5">
              {isAuthenticated ? (
                <Link
                  to={appPath("/dashboard")}
                  className="rounded-xl bg-orange-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-400"
                >
                  {t.landing.openConsole} →
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="rounded-xl bg-orange-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-400"
                >
                  {t.auth.signIn} →
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
