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
  icon: string;
  title: string;
  description: string;
  badge?: string;
};

export function AdminPage() {
  const { t } = useI18n();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet<{ user: { role: string } }>("/api/session"),
  });

  if (session.isPending) return <CardsSkeleton count={6} />;

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
      icon: "👥",
      title: t.admin.usersTitle,
      description: t.admin.usersBody,
      badge: "CRUD",
    },
    {
      to: appPath("/cases"),
      icon: "📁",
      title: t.nav.cases,
      description: "Tạo mới, chỉnh sửa hồ sơ C2P, gắn/gỡ chứng từ và theo dõi đối soát tài chính.",
      badge: "CRUD",
    },
    {
      to: appPath("/documents"),
      icon: "📄",
      title: t.nav.documents,
      description: "Tải lên hàng loạt, chỉnh sửa trường số liệu trích xuất, chạy lại quy tắc và xuất CSV.",
      badge: "CRUD",
    },
    {
      to: appPath("/review"),
      icon: "⚖️",
      title: t.nav.review,
      description: "Hàng đợi thẩm định: Phê duyệt, từ chối hoặc yêu cầu chỉnh sửa chứng từ.",
    },
    {
      to: appPath("/settings/integrations"),
      icon: "🔌",
      title: t.admin.integrationsTitle,
      description: t.admin.integrationsBody,
      badge: "Webhook",
    },
    {
      to: appPath("/audit"),
      icon: "🛡️",
      title: t.admin.auditTitle,
      description: t.admin.auditBody,
      badge: "Immutable",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t.admin.title} description={t.admin.description} />
      <SoftBanner tone="info">{t.admin.note}</SoftBanner>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="group block">
            <Panel className="h-full p-5 transition hover:border-accent-400 hover:bg-accent-50/30 hover:shadow-md dark:hover:border-orange-700 dark:hover:bg-orange-950/20">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-xl dark:bg-slate-800">
                  {item.icon}
                </span>
                {item.badge && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink-600 dark:bg-slate-800 dark:text-slate-300">
                    {item.badge}
                  </span>
                )}
              </div>
              <h2 className="mt-4 font-semibold text-ink-950 group-hover:text-accent-600 dark:group-hover:text-accent-400">
                {item.title}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
                {item.description}
              </p>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
