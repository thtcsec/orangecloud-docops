import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

/** Floating control to jump back to the top of long pages. */
export function ScrollToTopButton() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 420);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="fixed bottom-5 right-5 z-50 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 shadow-md transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t.common.scrollToTop}
    >
      {t.common.scrollToTop}
    </button>
  );
}
