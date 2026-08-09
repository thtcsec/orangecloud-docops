import { BrandLogo } from "../../components/BrandLogo";
import {
  LanguageToggle,
  ThemeToggle,
} from "../../components/HeaderControls";
import { SiteFooter } from "../../components/SiteFooter";
import { useI18n } from "../../i18n";
import { appPath } from "../../lib/paths";

export function LandingPage() {
  const { t } = useI18n();
  const preview = t.landing.preview;
  const appEntry = appPath("/dashboard");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <BrandLogo variant="auto" className="h-9 w-auto max-w-[260px]" />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <a
              href={appEntry}
              className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-500"
            >
              {t.landing.ctaPrimary}
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-slate-800">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_10%_-20%,#ffedd5_0%,transparent_55%),linear-gradient(180deg,#fffaf5_0%,#f8fafc_70%)] dark:bg-[radial-gradient(900px_420px_at_10%_-20%,#431407_0%,transparent_50%),linear-gradient(180deg,#0b1220_0%,#111827_70%)]"
          />
          <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div>
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-ink-950 sm:text-5xl">
                {t.brand.name}
              </h1>
              <p className="mt-4 max-w-xl text-xl font-medium leading-snug text-ink-800 sm:text-2xl">
                {t.landing.title}
              </p>
              <div className="mt-5 max-w-xl space-y-3 text-sm leading-relaxed text-ink-500">
                {t.landing.story.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={appEntry}
                  className="rounded-md bg-accent-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-500"
                >
                  {t.landing.ctaPrimary}
                </a>
                <a
                  href="https://github.com/thtcsec/orangecloud-docops/blob/master/docs/ARCHITECTURE.md"
                  className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {t.landing.ctaSecondary}
                </a>
              </div>
            </div>

            <aside
              className="animate-fade-in overflow-hidden rounded-xl border border-slate-800/80 bg-[#0b1220] text-slate-100 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.55)]"
              aria-label={preview.label}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <span className="font-mono text-[11px] tracking-wide text-slate-400">
                  {preview.label}
                </span>
                <span className="rounded bg-accent-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-400">
                  {preview.badge}
                </span>
              </div>
              <div className="space-y-3 px-4 py-4 font-mono text-[12px] leading-relaxed">
                <p className="text-slate-400">
                  <span className="text-accent-400">$</span> {preview.command}
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-slate-300">
                  <dt className="text-slate-500">{preview.doc}</dt>
                  <dd className="truncate text-slate-100">{preview.docValue}</dd>
                  <dt className="text-slate-500">{preview.case}</dt>
                  <dd className="text-slate-100">{preview.caseValue}</dd>
                  <dt className="text-slate-500">{preview.extract}</dt>
                  <dd>
                    <span className="text-emerald-400">{preview.extractValue}</span>
                  </dd>
                  <dt className="text-slate-500">{preview.rules}</dt>
                  <dd>
                    <span className="text-amber-300">{preview.rulesValue}</span>
                  </dd>
                  <dt className="text-slate-500">{preview.status}</dt>
                  <dd>
                    <span className="font-semibold text-accent-400">
                      {preview.statusValue}
                    </span>
                  </dd>
                </dl>
                <p className="border-t border-white/10 pt-3 text-slate-400">
                  {preview.footer}
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-4 py-12 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <h2 className="text-sm font-semibold text-ink-950">
              {t.landing.whatTitle}
            </h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-500">
              {t.landing.whatBody.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>
          <article className="rounded-lg border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
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

        <section className="border-y border-slate-200/70 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-sm font-semibold text-ink-950">
              {t.landing.flowTitle}
            </h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {t.landing.flowItems.map((item, index) => (
                <li
                  key={item.title}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="font-mono text-xs text-accent-600">
                    {String(index + 1).padStart(2, "0")} — {item.title}
                  </div>
                  <p className="mt-1.5 text-ink-700">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
