import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Feedback } from "../types";
import { api, ApiError } from "../utils/apiClient";
import { useAuth } from "./AuthContext";

export interface FeedbackRow {
  id: string;
  awb: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  submitted_at: string;
}

export function toFeedback(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    awb: row.awb,
    customerName: row.customer_name,
    rating: row.rating,
    comment: row.comment ?? undefined,
    submittedAt: row.submitted_at,
  };
}

export interface FeedbackSummary {
  count: number;
  avgRating: number | null;
  byStar: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface AddFeedbackInput {
  awb: string;
  customerName: string;
  rating: number;
  comment?: string;
}

interface FeedbackContextValue {
  feedback: Feedback[];
  summary: FeedbackSummary | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  /** Public, unauthenticated submission from the customer tracking page. */
  submitFeedback: (input: AddFeedbackInput) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function refresh() {
    setIsLoading(true);
    try {
      const res = await api.get<{
        items: FeedbackRow[];
        summary: { count: number; avg_rating: number | null; r1: number; r2: number; r3: number; r4: number; r5: number };
      }>("/api/feedback?limit=10");
      setFeedback(res.items.map(toFeedback));
      setSummary({
        count: res.summary.count,
        avgRating: res.summary.avg_rating,
        byStar: { 1: res.summary.r1, 2: res.summary.r2, 3: res.summary.r3, 4: res.summary.r4, 5: res.summary.r5 },
      });
    } catch {
      setFeedback([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) refresh();
    else {
      setFeedback([]);
      setSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function submitFeedback(input: AddFeedbackInput) {
    try {
      await api.post(
        "/api/public/feedback",
        { awb: input.awb, customerName: input.customerName, rating: input.rating, comment: input.comment },
        { auth: false },
      );
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal mengirim feedback." };
    }
  }

  return (
    <FeedbackContext.Provider value={{ feedback, summary, isLoading, refresh, submitFeedback }}>
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}
