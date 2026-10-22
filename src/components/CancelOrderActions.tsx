import { actionClass } from "./ActionButton";
import { Ban, Check, Loader2, Send, Undo2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "../store/AuthContext";
import type { Shipment } from "../types";
import { cancelOrder, decideCancellation, requestCancellation, withdrawCancellation } from "../utils/cancellation";
import { formatTanggalJam, isoToWib } from "../utils/format";
import { ReasonModal } from "./ReasonModal";
import { useToast } from "./Toast";

type Open = "direct" | "request" | "decide" | "withdraw" | null;

const fmtIso = (iso: string) => {
  const w = isoToWib(iso);
  return formatTanggalJam(w.tanggal, w.jam);
};

interface Props {
  shipment: Pick<Shipment, "awb" | "status" | "kotaAsal" | "kotaTujuan" | "createdByName" | "createdByRole" | "cancel" | "cancellation" | "customerId">;
  /** Reload the list/detail after any change. */
  onDone: () => unknown;
  /** "icon" for dense table rows, "full" for the detail header. */
  variant?: "icon" | "full";
}

/** The cancel controls for one order. WHICH control shows (Batalkan / Ajukan Pembatalan /
 * decision) comes from shipment.cancel, computed by the API from who created the order
 * and whether cargo has been picked up - the UI never decides that itself. */
export function CancelOrderActions({ shipment, onDone, variant = "icon" }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);
  const policy = shipment.cancel;
  const req = shipment.cancellation;
  const pending = req?.status === "PENDING";
  const isStaff = profile?.role === "Superadmin" || profile?.role === "Admin";
  if (!policy) return null;

  const btn = (label: string, onClick: () => void, tone: "rose" | "blue" | "amber", icon: ReactNode) => {
    const toneCls = {
      rose: "text-rose-600 hover:bg-rose-50 border-rose-600",
      blue: "text-blue-800 hover:bg-blue-50 border-blue-800",
      amber: "text-amber-800 hover:bg-amber-50 border-amber-600",
    }[tone];
    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        className={
          variant === "icon"
            ? actionClass(tone === "rose" ? "danger" : tone === "blue" ? "view" : "warn", true)
            : `inline-flex items-center gap-1.5 rounded-lg border-2 bg-white px-3.5 py-2 text-sm font-semibold ${toneCls}`
        }
      >
        {icon} {label}
      </button>
    );
  };

  const finish = async (message: string) => {
    setOpen(null);
    toast(message);
    await onDone();
  };

  const orderLine = (
    <dl className="mt-1 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
      <Row k="AWB" v={shipment.awb} mono />
      <Row k="Rute" v={`${shipment.kotaAsal} → ${shipment.kotaTujuan}`} />
      <Row k="Status" v={shipment.status} />
      <Row k="Dibuat oleh" v={`${shipment.createdByName ?? "-"}${shipment.createdByRole ? ` (${shipment.createdByRole === "Admin" ? "GMS-Admin" : shipment.createdByRole})` : ""}`} />
    </dl>
  );

  return (
    <>
      {policy.canDirect && btn("Batalkan", () => setOpen("direct"), "rose", <Ban size={variant === "icon" ? 14 : 15} />)}
      {policy.canRequest && btn("Ajukan Pembatalan", () => setOpen("request"), "amber", <Send size={variant === "icon" ? 14 : 15} />)}
      {policy.canDecide && pending && btn("Keputusan Pembatalan", () => setOpen("decide"), "blue", <Ban size={variant === "icon" ? 14 : 15} />)}
      {isStaff && pending && btn("Tarik Permintaan", () => setOpen("withdraw"), "blue", <Undo2 size={variant === "icon" ? 14 : 15} />)}

      {open === "direct" && (
        <ReasonModal
          title="Batalkan Pesanan?"
          reasonLabel="Alasan Pembatalan"
          placeholder="Contoh: Salah input, pesanan diganti"
          confirmLabel="Batalkan Pesanan"
          onClose={() => setOpen(null)}
          onConfirm={async (reason) => {
            await cancelOrder(shipment.awb, reason);
            await finish("Order berhasil dibatalkan.");
          }}
        >
          <p>Order berikut akan dibatalkan. Setelah dibatalkan, status tidak bisa dikembalikan tanpa pemulihan.</p>
          {orderLine}
        </ReasonModal>
      )}

      {open === "request" && (
        <ReasonModal
          title="Ajukan Pembatalan Order"
          reasonLabel="Alasan Pembatalan"
          placeholder="Contoh: Armada tidak tersedia"
          confirmLabel="Ajukan Pembatalan"
          tone="warning"
          onClose={() => setOpen(null)}
          onConfirm={async (reason) => {
            await requestCancellation(shipment.awb, reason);
            await finish("Permintaan pembatalan dikirim. Menunggu konfirmasi Client.");
          }}
        >
          <p>
            Order ini dibuat oleh Client, jadi tidak dapat dibatalkan langsung. Order tetap berjalan sampai Client memberi keputusan.
          </p>
          {orderLine}
        </ReasonModal>
      )}

      {open === "withdraw" && (
        <ReasonModal
          title="Tarik Permintaan Pembatalan?"
          reasonLabel="Keterangan"
          confirmLabel="Tarik Permintaan"
          tone="warning"
          onClose={() => setOpen(null)}
          onConfirm={async (note) => {
            await withdrawCancellation(shipment.awb, note);
            await finish("Permintaan pembatalan ditarik.");
          }}
        >
          <p>Permintaan pembatalan yang menunggu keputusan Client akan ditarik.</p>
          {orderLine}
        </ReasonModal>
      )}

      {open === "decide" && req && <DecisionModal shipment={shipment} onClose={() => setOpen(null)} onDecided={finish} />}
    </>
  );

  function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
    return (
      <div className="flex gap-2">
        <dt className="w-24 shrink-0 text-xs text-slate-500">{k}</dt>
        <dd className={`break-words font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{v}</dd>
      </div>
    );
  }
}

function DecisionModal({
  shipment,
  onClose,
  onDecided,
}: {
  shipment: Props["shipment"];
  onClose: () => void;
  onDecided: (message: string) => Promise<void>;
}) {
  const req = shipment.cancellation!;
  const [keterangan, setKeterangan] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    if (busy) return;
    if (!keterangan.trim()) {
      setError("Keterangan wajib diisi.");
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      await decideCancellation(shipment.awb, decision, keterangan.trim());
      await onDecided(decision === "approve" ? "Pembatalan disetujui. Order dibatalkan." : "Pembatalan ditolak. Order tetap berjalan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.");
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">Request Pembatalan Order</h2>
        <dl className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex gap-2"><dt className="w-24 shrink-0 text-xs text-slate-500">AWB</dt><dd className="font-mono font-medium text-slate-800">{shipment.awb}</dd></div>
          <div className="flex gap-2"><dt className="w-24 shrink-0 text-xs text-slate-500">Order</dt><dd className="font-medium text-slate-800">Pengiriman {shipment.kotaAsal} → {shipment.kotaTujuan}</dd></div>
          <div className="flex gap-2"><dt className="w-24 shrink-0 text-xs text-slate-500">Diajukan oleh</dt><dd className="font-medium text-slate-800">{req.requestedBy} ({req.requestedByRole === "Admin" ? "GMS-Admin" : req.requestedByRole})</dd></div>
          <div className="flex gap-2"><dt className="w-24 shrink-0 text-xs text-slate-500">Tanggal</dt><dd className="font-medium text-slate-800">{fmtIso(req.requestedAt)}</dd></div>
          <div className="flex gap-2"><dt className="w-24 shrink-0 text-xs text-slate-500">Alasan</dt><dd className="font-medium text-slate-800">“{req.reason}”</dd></div>
        </dl>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">
            Keterangan Anda <span className="text-rose-600">*</span>
          </span>
          <textarea
            rows={3}
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            maxLength={500}
            placeholder="Wajib diisi untuk Terima maupun Tolak"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={!!busy} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            Tutup
          </button>
          <button type="button" onClick={() => decide("reject")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-700 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
            {busy === "reject" ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />} Tolak Pembatalan
          </button>
          <button type="button" onClick={() => decide("approve")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
            {busy === "approve" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Terima & Batalkan Order
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  WITHDRAWN: "bg-slate-200 text-slate-600",
  EXPIRED: "bg-slate-200 text-slate-600",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu Konfirmasi Client",
  APPROVED: "Disetujui Client",
  REJECTED: "Ditolak Client",
  WITHDRAWN: "Ditarik",
  EXPIRED: "Kedaluwarsa",
};

/** Detail-page card: who created the order, why it can/can't be cancelled, and the latest cancellation request. */
export function CancellationInfo({ shipment }: { shipment: Props["shipment"] }) {
  const req = shipment.cancellation;
  const note = shipment.cancel?.blockedReason;
  const creator = shipment.createdByName
    ? `${shipment.createdByName} - ${shipment.createdByRole === "Admin" ? "GMS-Admin" : shipment.createdByRole ?? "-"}`
    : shipment.createdByRole === "Client"
      ? "Client"
      : "-";
  if (!req && !note && !shipment.createdByName) return null;
  return (
    <div className="no-print mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <p>
          <span className="text-xs text-slate-500">Dibuat Oleh </span>
          <span className="font-medium text-slate-800">{creator}</span>
        </p>
        {req && (
          <p>
            <span className="text-xs text-slate-500">Request Pembatalan </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[req.status]}`}>{STATUS_LABEL[req.status]}</span>
          </p>
        )}
      </div>
      {note && !req?.status.startsWith("APPROVED") && <p className="mt-2 text-xs text-slate-500">{note}</p>}
      {req && (
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Diajukan oleh</dt>
            <dd className="font-medium text-slate-800">
              {req.requestedBy} ({req.requestedByRole === "Admin" ? "GMS-Admin" : req.requestedByRole}) · {fmtIso(req.requestedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Alasan</dt>
            <dd className="text-slate-800">{req.reason}</dd>
          </div>
          {req.decidedAt && (
            <>
              <div>
                <dt className="text-xs text-slate-500">Diputuskan oleh</dt>
                <dd className="font-medium text-slate-800">
                  {req.decidedBy} · {fmtIso(req.decidedAt)}
                </dd>
              </div>
              {req.decisionReason && (
                <div>
                  <dt className="text-xs text-slate-500">Keterangan</dt>
                  <dd className="text-slate-800">{req.decisionReason}</dd>
                </div>
              )}
            </>
          )}
        </dl>
      )}
    </div>
  );
}
