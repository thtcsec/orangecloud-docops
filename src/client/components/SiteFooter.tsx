import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { useI18n } from "../i18n";

const GITHUB_URL = "https://github.com/thtcsec/orangecloud-docops";
const LEARN_URL = "https://orangecloud.vn";
const LINKEDIN_URL = "https://www.linkedin.com/in/thtcsec";

function BuiltBy() {
  const { t } = useI18n();
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span>{t.footer.builtBy}</span>
      <a
        href={LINKEDIN_URL}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-accent-500 hover:text-accent-600"
      >
        Trịnh Hoàng Tú
      </a>
      <span className="text-ink-300">·</span>
      <a
        href={GITHUB_URL}
        className="font-medium text-ink-700 hover:text-accent-500 dark:text-slate-300"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>
    </p>
  );
}

export function SiteFooter({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  if (compact) {
    return (
      <footer className="mt-10 border-t border-slate-200/80 bg-[var(--color-page)] dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-ink-500">
          <p>
            © {year} {t.brand.name}
          </p>
          <BuiltBy />
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-slate-200 bg-[var(--color-page)] text-ink-700 dark:border-slate-800">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-[1.35fr_0.75fr_1.1fr]">
        <div>
          <BrandLogo variant="auto" className="h-9 w-auto max-w-[240px]" />
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-500">
            {t.footer.blurb}
          </p>
          <p className="mt-4 text-xs text-ink-500">{t.footer.hostedOn}</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-ink-800">{t.footer.links}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href={LEARN_URL}
                className="font-medium text-accent-500 hover:text-accent-600"
                target="_blank"
                rel="noreferrer"
              >
                {t.footer.learn}
              </a>
            </li>
            <li>
              <Link
                to="/privacy"
                className="font-medium text-accent-500 hover:text-accent-600"
              >
                {t.footer.privacy}
              </Link>
            </li>
            <li>
              <a
                href={`${GITHUB_URL}/blob/master/docs/ARCHITECTURE.md`}
                className="font-medium text-accent-500 hover:text-accent-600"
                target="_blank"
                rel="noreferrer"
              >
                {t.footer.architecture}
              </a>
            </li>
            <li>
              <a
                href={GITHUB_URL}
                className="font-medium text-accent-500 hover:text-accent-600"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-sm font-semibold text-ink-900">
            {t.footer.newsletterTitle}
          </h2>
          <p className="mt-2 text-sm text-ink-500">{t.footer.newsletterBody}</p>
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => e.preventDefault()}
            aria-disabled="true"
          >
            <label className="sr-only" htmlFor="footer-newsletter-email">
              Email
            </label>
            <input
              id="footer-newsletter-email"
              type="email"
              disabled
              placeholder="email@example.com"
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-ink-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <button
              type="submit"
              disabled
              className="w-full rounded-md bg-accent-500 px-3 py-2 text-sm font-medium text-white opacity-80"
            >
              {t.footer.subscribe}
            </button>
          </form>
          <p className="mt-2 text-xs font-medium text-accent-500">
            {t.footer.comingSoon}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200/80 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-5 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {t.brand.name}
          </p>
          <BuiltBy />
        </div>
        <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 pb-6 text-xs">
          <a
            href={LEARN_URL}
            className="font-medium text-accent-500 hover:text-accent-600"
            target="_blank"
            rel="noreferrer"
          >
            {t.footer.learn}
          </a>
          <Link
            to="/privacy"
            className="font-medium text-accent-500 hover:text-accent-600"
          >
            {t.footer.privacy}
          </Link>
        </div>
      </div>
    </footer>
  );
}
