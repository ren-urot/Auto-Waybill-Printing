import { Bell } from 'lucide-react';

/**
 * Presentational only — there's no notifications backend yet (new-order/
 * sync-failed/printer-offline alerts are a later phase). Shown because the
 * approved reference design includes it in every page header; clicking it
 * does nothing yet.
 */
export function NotificationBell() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      title="Notifications (coming soon)"
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      <Bell className="h-4.5 w-4.5" />
    </button>
  );
}
