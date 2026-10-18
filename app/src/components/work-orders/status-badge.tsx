import { cn } from "@/lib/utils";
import { STATUS_BADGE_CLASS } from "@/lib/work-order-status";
import type { WorkOrderStatus } from "@/lib/frappe/work-orders";

export function StatusBadge({ status, className }: { status: WorkOrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-4xl px-2 text-xs font-medium whitespace-nowrap",
        STATUS_BADGE_CLASS[status] ?? "bg-secondary text-secondary-foreground",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      {status}
    </span>
  );
}
