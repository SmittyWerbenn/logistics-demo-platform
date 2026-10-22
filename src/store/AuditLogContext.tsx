import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuditAction, AuditLogEntry, UserRole } from "../types";
import { api } from "../utils/apiClient";
import { useAuth } from "./AuthContext";

interface AuditLogRow {
  id: string;
  timestamp: string;
  user_name: string;
  role: UserRole;
  action: AuditAction;
  action_label: string;
  module: string;
  awb: string | null;
  description: string;
}

function toEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    userName: row.user_name,
    role: row.role,
    action: row.action,
    actionLabel: row.action_label,
    module: row.module,
    awb: row.awb ?? undefined,
    description: row.description,
  };
}

interface AuditLogFilters {
  action?: string;
  module?: string;
  awb?: string;
  user?: string;
}

interface AuditLogContextValue {
  entries: AuditLogEntry[];
  isLoading: boolean;
  refresh: (filters?: AuditLogFilters) => Promise<void>;
}

const AuditLogContext = createContext<AuditLogContextValue | null>(null);

/** Every entry here is written server-side by api-worker as each action
 * happens - this context only ever reads, it never writes. */
export function AuditLogProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function refresh(filters: AuditLogFilters = {}) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20", ...filters } as Record<string, string>);
      const res = await api.get<{ items: AuditLogRow[] }>(`/api/audit-logs?${params.toString()}`);
      setEntries(res.items.map(toEntry));
    } catch {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }

  // Not loaded on login anymore: the Audit Log page pages through the API itself.
  useEffect(() => {
    if (!isAuthenticated) setEntries([]);
  }, [isAuthenticated]);

  return <AuditLogContext.Provider value={{ entries, isLoading, refresh }}>{children}</AuditLogContext.Provider>;
}

export function useAuditLog() {
  const ctx = useContext(AuditLogContext);
  if (!ctx) throw new Error("useAuditLog must be used within AuditLogProvider");
  return ctx;
}
