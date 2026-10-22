import { AlertTriangle, Check, ClipboardCheck, Navigation, PackageCheck, Truck } from "lucide-react";
import { useLanguage } from "../store/LanguageContext";
import type { ShipmentStatus } from "../types";

const STEP_ICONS = [ClipboardCheck, PackageCheck, Truck, Navigation, Check];

function getProgress(status: ShipmentStatus): { index: number; hasKendala: boolean } {
  switch (status) {
    case "Dalam Persiapan":
    case "Hold":
      return { index: 1, hasKendala: false };
    case "Berangkat":
    case "Transit":
    case "Dalam Perjalanan":
    case "Re-route":
    case "Penarikan":
      return { index: 2, hasKendala: false };
    case "Kendala":
      return { index: 2, hasKendala: true };
    case "Tiba di Tujuan":
      return { index: 3, hasKendala: false };
    case "Selesai / Terkirim":
      return { index: 4, hasKendala: false };
    default:
      return { index: 0, hasKendala: false };
  }
}

export function StatusStepper({ status }: { status: ShipmentStatus }) {
  const { t } = useLanguage();
  const { index: current, hasKendala } = getProgress(status);
  const STEPS = [
    { label: t.stepper.orderCreated, icon: STEP_ICONS[0] },
    { label: t.stepper.pickedUp, icon: STEP_ICONS[1] },
    { label: t.stepper.inTransit, icon: STEP_ICONS[2] },
    { label: t.stepper.outForDelivery, icon: STEP_ICONS[3] },
    { label: t.stepper.delivered, icon: STEP_ICONS[4] },
  ];

  return (
    <div>
      {hasKendala && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          {t.stepper.kendalaWarning}
        </div>
      )}
      <ol className="flex items-start">
        {STEPS.map((step, i) => {
          const isLast = i === STEPS.length - 1;
          // Reaching the final step IS completion, not "in progress toward
          // it" - treat it as done (emerald + check) rather than the
          // in-progress blue used for earlier current steps.
          const isDelivered = i === current && isLast && !hasKendala;
          const done = i < current || isDelivered;
          const isCurrent = i === current && !isDelivered;
          const Icon = step.icon;
          return (
            <li key={i} className="flex flex-1 flex-col items-center last:flex-none">
              <div className="relative flex w-full items-center">
                <div
                  className={`absolute left-0 top-1/2 h-0.5 w-1/2 -translate-y-1/2 ${
                    i === 0 ? "invisible" : done ? "bg-emerald-500" : isCurrent ? "bg-blue-800" : "bg-slate-200"
                  }`}
                />
                <div
                  className={`absolute right-0 top-1/2 h-0.5 w-1/2 -translate-y-1/2 ${
                    isLast ? "invisible" : done ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                />
                <span className="relative z-10 mx-auto flex h-9 w-9 shrink-0 sm:h-10 sm:w-10">
                  {(isCurrent || isDelivered) && (
                    <span
                      className={`absolute inset-0 animate-ping rounded-full opacity-75 ${
                        hasKendala ? "bg-red-400" : isDelivered ? "bg-emerald-400" : "bg-blue-500"
                      }`}
                    />
                  )}
                  <span
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white sm:h-10 sm:w-10 ${
                      isCurrent && hasKendala
                        ? "bg-red-500 text-white"
                        : done
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                            ? "bg-blue-800 text-white"
                            : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isCurrent && hasKendala ? (
                      <AlertTriangle size={16} />
                    ) : done ? (
                      <Check size={16} />
                    ) : (
                      <Icon size={16} />
                    )}
                  </span>
                </span>
              </div>
              <p
                className={`mt-2 max-w-[70px] text-center text-[10px] font-medium leading-tight sm:max-w-none sm:text-xs ${
                  done || isCurrent ? "text-slate-800" : "text-slate-400"
                }`}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
