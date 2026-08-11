import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiPostJson } from "../../lib/api";
import { appPath } from "../../lib/paths";
import { Button, ErrorBanner, Field, Input } from "../../components/ui";
import { useI18n } from "../../i18n";

export function RegisterPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: () =>
      apiPostJson<{ user: { id: string; email: string; role: string } }>(
        "/api/auth/register",
        {
          displayName: displayName.trim(),
          email: email.trim(),
          password,
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] });
      void queryClient.invalidateQueries({ queryKey: ["auth_me"] });
      navigate(appPath("/dashboard"), { replace: true });
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-600 shadow-md text-white font-bold text-xl">
            🍊
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink-950">
            {t.auth.registerTitle}
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            {t.auth.registerSubtitle}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
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
              className="w-full justify-center py-2.5"
            >
              {registerMutation.isPending
                ? t.auth.registering
                : t.auth.registerAction}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center text-sm text-ink-500 dark:border-slate-800">
            <span>{t.auth.alreadyHaveAccount} </span>
            <Link
              to={appPath("/login")}
              className="font-semibold text-accent-600 hover:underline dark:text-accent-400"
            >
              {t.auth.signIn}
            </Link>
          </div>
        </div>

        <div className="text-center text-xs text-ink-400">
          OrangeCloud DocOps · Contract-to-Pay Acceleration
        </div>
      </div>
    </div>
  );
}
