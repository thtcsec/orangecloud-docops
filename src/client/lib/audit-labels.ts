/** Human-readable audit labels (client-side). */

const ACTION_EN: Record<string, string> = {
  "document.uploaded": "Document uploaded",
  "document.status.changed": "Document status changed",
  "document.status.noop": "Document status unchanged",
  "document.reprocess_queued": "Reprocess queued",
  "document.previewed": "Document previewed",
  "case.document.linked": "Document linked to case",
  "review.task.created": "Review task created",
  "review.decision.created": "Review decision recorded",
  "processing_run.completed": "Processing finished",
  "processing_run.failed": "Processing failed",
  "export.completed": "Exported to ERP webhook",
  "export.failed": "ERP webhook export failed",
  "export.skipped": "Export skipped (webhook not configured)",
  "integration.erp_webhook.updated": "ERP webhook URL updated",
  "integration.erp_webhook.tested": "ERP webhook test sent",
};

const ACTION_VI: Record<string, string> = {
  "document.uploaded": "Đã tải chứng từ",
  "document.status.changed": "Đổi trạng thái chứng từ",
  "document.status.noop": "Trạng thái chứng từ không đổi",
  "document.reprocess_queued": "Đã xếp hàng xử lý lại",
  "document.previewed": "Đã xem trước chứng từ",
  "case.document.linked": "Đã gắn chứng từ vào hồ sơ",
  "review.task.created": "Tạo nhiệm vụ rà soát",
  "review.decision.created": "Ghi nhận quyết định rà soát",
  "processing_run.completed": "Hoàn tất xử lý",
  "processing_run.failed": "Xử lý thất bại",
  "export.completed": "Đã gửi sang ERP webhook",
  "export.failed": "Gửi ERP webhook thất bại",
  "export.skipped": "Bỏ qua xuất (chưa cấu hình webhook)",
  "integration.erp_webhook.updated": "Cập nhật URL ERP webhook",
  "integration.erp_webhook.tested": "Đã gửi thử ERP webhook",
};

const ACTOR_TYPE_EN: Record<string, string> = {
  user: "User",
  system: "System",
  workflow: "Workflow",
};

const ACTOR_TYPE_VI: Record<string, string> = {
  user: "Người dùng",
  system: "Hệ thống",
  workflow: "Workflow",
};

const ENTITY_TYPE_EN: Record<string, string> = {
  document: "Document",
  case: "Case",
  review_task: "Review task",
  processing_run: "Processing run",
  integration: "Integration",
};

const ENTITY_TYPE_VI: Record<string, string> = {
  document: "Chứng từ",
  case: "Hồ sơ",
  review_task: "Nhiệm vụ rà soát",
  processing_run: "Lần xử lý",
  integration: "Tích hợp",
};

export function formatAuditAction(action: string, locale: string): string {
  const map = locale.startsWith("vi") ? ACTION_VI : ACTION_EN;
  return map[action] || action;
}

export function formatAuditActor(
  actorType: string,
  actorId: string | null,
  locale: string,
  _noneLabel: string,
): string {
  const typeMap = locale.startsWith("vi") ? ACTOR_TYPE_VI : ACTOR_TYPE_EN;
  const typeLabel = typeMap[actorType] || actorType;
  if (!actorId) return typeLabel;
  // Shorten noisy ids for display but keep identifiable tail.
  const short =
    actorId.length > 18 ? `${actorId.slice(0, 10)}…${actorId.slice(-4)}` : actorId;
  if (actorType === "system") {
    return `${typeLabel} (${actorId})`;
  }
  return `${typeLabel}: ${short}`;
}

export function formatAuditEntity(
  entityType: string,
  entityId: string,
  locale: string,
): string {
  const typeMap = locale.startsWith("vi") ? ENTITY_TYPE_VI : ENTITY_TYPE_EN;
  const typeLabel = typeMap[entityType] || entityType;
  const short =
    entityId.length > 22
      ? `${entityId.slice(0, 12)}…${entityId.slice(-4)}`
      : entityId;
  return `${typeLabel}: ${short}`;
}
