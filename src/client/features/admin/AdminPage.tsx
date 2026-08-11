import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { roleIsAdmin } from "@shared/domain";
import { apiGet } from "../../lib/api";
import { appPath } from "../../lib/paths";
import {
  CardsSkeleton,
  PageHeader,
  Panel,
  SoftBanner,
} from "../../components/ui";
import { useI18n } from "../../i18n";

type AdminLink = {
  to: string;
  title: string;
  description: string;
};

export function AdminPage() {
  const { t } = useI18n();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<{ user: { role: string } }>("/api/session"),
  });

  if (session.isLoading) return <CardsSkeleton count={3} />;

  if (!roleIsAdmin(session.data?.user.role)) {
    return (
      <div>
        <PageHeader title={t.admin.title} description={t.admin.description} />
        <SoftBanner tone="warn">{t.admin.adminOnly}</SoftBanner>
      </div>
    );
  }

  const links: AdminLink[] = [
    {
      to: appPath("/settings/users"),
      title: t.admin.usersTitle,
      description: t.admin.usersBody,
    },
    {
      to: appPath("/audit"),
      title: t.admin.auditTitle,
      description: t.admin.auditBody,
    },
    {
      to: appPath("/settings/integrations"),
      title: t.admin.integrationsTitle,
      description: t.admin.integrationsBody,
    },
  ];

  return (
    <div>
      <PageHeader title={t.admin.title} description={t.admin.description} />
      <SoftBanner tone="info">{t.admin.note}</SoftBanner>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="block">
            <Panel className="h-full p-4 transition hover:border-accent-300 hover:bg-accent-50/40 dark:hover:border-orange-800 dark:hover:bg-orange-950/20">
              <h2 className="font-semibold text-ink-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                {item.description}
              </p>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
