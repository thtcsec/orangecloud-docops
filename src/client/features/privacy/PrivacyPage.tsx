import { Link } from "react-router-dom";
import { BrandLogo } from "../../components/BrandLogo";
import {
  LanguageToggle,
  ThemeToggle,
} from "../../components/HeaderControls";
import { SiteFooter } from "../../components/SiteFooter";
import { BackLink } from "../../components/ui";
import { useI18n } from "../../i18n";

export function PrivacyPage() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" aria-label={t.brand.name}>
            <BrandLogo variant="auto" className="h-8 w-auto max-w-[220px]" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="page-enter mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <BackLink to="/" label={t.common.backToHome} />
        <h1 className="text-2xl font-semibold text-ink-950">{t.privacy.title}</h1>
        <p className="mt-2 text-sm text-ink-500">{t.privacy.updated}</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-700">
          {t.privacy.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
