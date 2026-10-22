import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { NotificationItem, NotificationTrigger } from "../types";
import { api } from "../utils/apiClient";
import { useAuth } from "./AuthContext";

export interface NotificationRow {
  id: string;
  awb: string;
  trigger_type: NotificationTrigger;
  subject: string;
  to_email: string;
  to_name: string;
  recipient_role: "penerima" | "pengirim";
  created_at: string;
  is_read: number;
}

export function toItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    awb: row.awb,
    trigger: row.trigger_type,
    subject: row.subject,
    toEmail: row.to_email,
    toName: row.to_name,
    recipientRole: row.recipient_role,
    createdAt: row.created_at,
    isRead: row.is_read === 1,
  };
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/** (The bell + dashboard only need the latest few, so this loads 10; the Notification Center pages through the API itself.)
 * Notifications are created server-side (see api-worker/src/routes/shipments.ts)
 * whenever a shipment is created or reaches Kendala/Selesai - this context
 * only ever reads the feed, it never creates entries itself. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function refresh() {
    setIsLoading(true);
    try {
      const res = await api.get<{ items: NotificationRow[] }>("/api/notifications?limit=10");
      setNotifications(res.items.map(toItem));
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) refresh();
    else setNotifications([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.post("/api/notifications/read-all");
    } catch {
      // Best-effort - a failed mark-as-read shouldn't block viewing the list.
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, isLoading, refresh, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
