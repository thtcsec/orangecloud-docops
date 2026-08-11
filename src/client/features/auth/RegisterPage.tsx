import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, apiPostJson } from "../../lib/api";
import { appPath } from "../../lib/paths";
import { Button, ErrorBanner, Field, Input } from "../../components/ui";
import { BrandLogo } from "../../components/BrandLogo";
import { LanguageToggle, ThemeToggle } from "../../components/HeaderControls";
import { useI18n } from "../../i18n";

export function RegisterPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      window.location.replace(appPath("/dashboard"));
    }
  }, [session.data]);


  const registerMutation = useMutation({
    mutationFn: () =>
      apiPostJson<{ user: { id: string; email: string; role: string } }>(
        "/api/auth/register",
        {
          displayName: displayName.trim(),
          email: email.trim().toLowerCase(),
          password,
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] });
      void queryClient.invalidateQueries({ queryKey: ["auth_me"] });
      window.location.assign(appPath("/dashboard"));
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof Error ? err.message : t.common.actionFailed,
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password) return;

    if (password.length < 8) {
      setErrorMsg(t.auth.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(t.auth.passwordMismatch);
      return;
    }

    setErrorMsg(null);
    registerMutation.mutate();
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
            Bắt đầu quản lý và tự động hóa chứng từ ngay hôm nay
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Đăng ký tài khoản để trải nghiệm luồng thẩm định chứng từ, đối soát dòng tiền và lưu vết kiểm toán bất biến theo tiêu chuẩn doanh nghiệp.
          </p>

          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 backdrop-blur-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-sm text-orange-400 font-bold">
                ✓
              </span>
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Khởi tạo nhanh chóng:</span> Tài khoản đầu tiên tự động nhận vai trò Quản trị viên (Admin).
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 backdrop-blur-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-sm text-orange-400 font-bold">
                ✓
              </span>
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Tải tệp đa định dạng:</span> Hỗ trợ XML hóa đơn điện tử VN và PDF hóa đơn quét.
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 backdrop-blur-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-sm text-orange-400 font-bold">
                ✓
              </span>
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Kiểm soát toàn diện:</span> Hàng đợi thẩm định minh bạch và phân quyền chi tiết.
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
              {t.auth.registerTitle}
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              {t.auth.registerSubtitle}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && <ErrorBanner message={errorMsg} />}

              <Field label={t.auth.displayName}>
                <Input
                  value={displayName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDisplayName(e.target.value)
                  }
                  placeholder={t.auth.displayNamePlaceholder}
                  required
                  autoFocus
                />
              </Field>

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
                  autoComplete="new-password"
                />
              </Field>

              <Field label={t.auth.confirmPassword}>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder={t.auth.confirmPasswordPlaceholder}
                  required
                  autoComplete="new-password"
                />
              </Field>

              <Button
                type="submit"
                variant="primary"
                disabled={
                  registerMutation.isPending ||
                  !displayName.trim() ||
                  !email.trim() ||
                  !password ||
                  !confirmPassword
                }
                className="mt-2 w-full justify-center py-2.5 text-base font-semibold"
              >
                {registerMutation.isPending
                  ? t.auth.registering
                  : t.auth.registerAction}
              </Button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-ink-500 dark:border-slate-800">
              <span>{t.auth.alreadyHaveAccount} </span>
              <Link
                to={appPath("/login")}
                className="font-semibold text-accent-600 hover:underline dark:text-accent-400"
              >
                {t.auth.signIn}
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
