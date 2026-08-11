import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet, apiPostJson } from "../../lib/api";
import { appPath } from "../../lib/paths";
import { Button, ErrorBanner, Field, Input } from "../../components/ui";
import { BrandLogo } from "../../components/BrandLogo";
import { LanguageToggle, ThemeToggle } from "../../components/HeaderControls";
import { useI18n } from "../../i18n";

export function LoginPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redirectUrl = searchParams.get("redirect") || appPath("/dashboard");

  // Check if user is already authenticated (e.g. via CF Access or existing session)
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () =>
      apiGet<{ user: { id: string; email: string; role: string } }>("/api/session"),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (session.data?.user) {
      window.location.replace(redirectUrl);
    }
  }, [session.data, redirectUrl]);


  const loginMutation = useMutation({
    mutationFn: () =>
      apiPostJson<{ user: { id: string; email: string; role: string } }>(
        "/api/auth/login",
        {
          email: email.trim(),
          password,
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] });
      void queryClient.invalidateQueries({ queryKey: ["auth_me"] });
      window.location.assign(redirectUrl);
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof Error ? err.message : t.common.actionFailed,
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setErrorMsg(null);
    loginMutation.mutate();
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">
      {/* Left Column: Brand & Hero Showcase */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex xl:w-5/12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_-20%,rgba(249,115,22,0.25),rgba(255,255,255,0))]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_90%,rgba(59,130,246,0.2),rgba(255,255,255,0))]"
        />

        {/* Brand Header */}
        <div className="relative z-10">
          <Link to="/" className="inline-block transition hover:opacity-90">
            <BrandLogo variant="light" className="h-10 w-auto" />
          </Link>
          <p className="mt-3 text-sm text-slate-400 font-medium tracking-wide">
            Contract-to-Pay Document Operations on Cloudflare Edge
          </p>
        </div>

        {/* Center Feature Highlights */}
        <div className="relative z-10 my-auto max-w-md space-y-6">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Chuẩn hóa & Tự động hóa dòng chứng từ thanh toán doanh nghiệp
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Hợp nhất Hợp đồng, PO và Hóa đơn điện tử vào một luồng khép kín. Kiểm tra đối soát quy tắc tự động và lưu vết kiểm toán bất biến.
          </p>

          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 backdrop-blur-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-sm text-orange-400 font-bold">
                ✓
              </span>
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Bảo mật đa tầng:</span> Lưu trữ mã hóa trên Cloudflare R2 và xác thực phiên an toàn.
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 backdrop-blur-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-sm text-orange-400 font-bold">
                ✓
              </span>
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Đối soát tự động:</span> Trích xuất trường số liệu thông minh và chạy quy tắc C2P tức thời.
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 backdrop-blur-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-sm text-orange-400 font-bold">
                ✓
              </span>
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Đồng bộ ERP:</span> Đẩy dữ liệu đã phê duyệt sang ERP Webhook ngay khi hoàn tất.
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
          <span>© 2026 OrangeCloud DocOps</span>
          <span className="font-mono text-slate-400">v0.1.0 · Serverless</span>
        </div>
      </div>

      {/* Right Column: Auth Form */}
      <div className="flex flex-1 flex-col justify-between p-6 sm:p-12 lg:p-16">
        {/* Top bar controls */}
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Link to="/" className="inline-block">
              <BrandLogo variant="auto" className="h-8 w-auto" />
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Center Form Container */}
        <div className="mx-auto w-full max-w-md py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              {t.auth.loginTitle}
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              {t.auth.loginSubtitle}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && <ErrorBanner message={errorMsg} />}

              <Field label={t.auth.email}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  placeholder={t.auth.emailPlaceholder}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </Field>

              <Field label={t.auth.password}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPassword(e.target.value)
                  }
                  placeholder={t.auth.passwordPlaceholder}
                  required
                  autoComplete="current-password"
                />
              </Field>

              <Button
                type="submit"
                variant="primary"
                disabled={loginMutation.isPending || !email.trim() || !password}
                className="mt-2 w-full justify-center py-2.5 text-base font-semibold"
              >
                {loginMutation.isPending
                  ? t.auth.loggingIn
                  : t.auth.loginAction}
              </Button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-ink-500 dark:border-slate-800">
              <span>{t.auth.dontHaveAccount} </span>
              <Link
                to={appPath("/register")}
                className="font-semibold text-accent-600 hover:underline dark:text-accent-400"
              >
                {t.auth.signUp}
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Back link */}
        <div className="text-center text-xs text-ink-400">
          <Link to="/" className="hover:text-ink-600 hover:underline dark:hover:text-ink-200">
            ← {t.common.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
