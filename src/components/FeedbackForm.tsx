import { AlertTriangle, CheckCircle2, MessageSquare, Star } from "lucide-react";
import { useState } from "react";
import { useFeedback } from "../store/FeedbackContext";
import { useLanguage } from "../store/LanguageContext";

export function FeedbackForm({ awb, customerName }: { awb: string; customerName: string }) {
  const { t } = useLanguage();
  const { submitFeedback } = useFeedback();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    setError(null);
    const result = await submitFeedback({ awb, customerName, rating, comment: comment.trim() || undefined });
    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
    } else {
      setError(result.error);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:p-6">
        <CheckCircle2 size={26} className="mx-auto mb-2 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-800">{t.feedback.thankYou}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <MessageSquare size={16} className="text-blue-800" />
        <h2 className="text-sm font-semibold text-slate-800">{t.feedback.prompt}</h2>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={t.feedback.starLabel(n)}
            className="p-1"
          >
            <Star
              size={30}
              className={
                n <= (hoverRating || rating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-200"
              }
            />
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">{t.feedback.commentLabel}</span>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t.feedback.commentPlaceholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </label>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t.feedback.submitButton}
      </button>
    </div>
  );
}
