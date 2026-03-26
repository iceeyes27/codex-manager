import React from "react";
import { useAccountStore } from "../store/accountStore";
import { SwitchPhase } from "../types";

const PHASES: { key: SwitchPhase; label: string; order: number }[] = [
  { key: "preparing", label: "准备", order: 1 },
  { key: "writing_auth", label: "写入凭证", order: 2 },
  { key: "syncing_state", label: "同步会话", order: 3 },
];

function getPhaseState(
  phaseKey: SwitchPhase,
  currentPhase: SwitchPhase,
): "done" | "active" | "pending" | "error" {
  if (currentPhase === "error") {
    return "error";
  }
  if (currentPhase === "done") {
    return "done";
  }

  const current = PHASES.find((p) => p.key === currentPhase)?.order ?? 0;
  const item = PHASES.find((p) => p.key === phaseKey)?.order ?? 0;

  if (item < current) return "done";
  if (item === current) return "active";
  return "pending";
}

const SwitchProgress: React.FC = () => {
  const { switchState, accounts } = useAccountStore();
  const { phase } = switchState;

  if (phase === "idle") return null;

  const target = accounts.find((a) => a.id === switchState.toAccountId);
  const currentOrder = PHASES.find((item) => item.key === phase)?.order ?? 0;
  const progressValue =
    phase === "done" ? 100 : phase === "error" ? 100 : Math.max((currentOrder / PHASES.length) * 100, 16);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-progress-title"
      aria-live="polite"
    >
      <div className="dialog-shell w-full max-w-[620px] rounded-[34px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-500/80">Switching</p>
        <h2
          id="switch-progress-title"
          className="mt-3 text-[2.2rem] font-black tracking-[-0.06em] text-slate-950"
        >
          正在切换至 &ldquo;{target?.displayName ?? "..."}&rdquo;
        </h2>
        <div className="mt-6 rounded-full bg-slate-100 p-1">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              phase === "error"
                ? "bg-[linear-gradient(90deg,#ef4444,#f97316)]"
                : "bg-[linear-gradient(90deg,#07111f,#2563eb,#38bdf8)]"
            }`}
            style={{ width: `${progressValue}%` }}
          />
        </div>

        <div className="mt-7 space-y-3 rounded-[28px] border border-slate-100 bg-slate-50/90 p-5">
          {PHASES.map((p) => {
            const phaseState = getPhaseState(p.key, phase);
            return (
              <div key={p.key} className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    phaseState === "done"
                      ? "bg-emerald-500 text-white"
                      : phaseState === "active"
                        ? "bg-[linear-gradient(160deg,#07111f,#2563eb)] text-white"
                        : phaseState === "error"
                          ? "bg-red-500 text-white"
                          : "bg-slate-100 text-slate-400"
                  }`}
                  aria-hidden="true"
                >
                  {phaseState === "done" ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : phaseState === "active" ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  ) : phaseState === "error" ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={`text-sm ${
                    phaseState === "done" || phaseState === "active"
                      ? "text-slate-800"
                      : phaseState === "error"
                        ? "text-red-600"
                        : "text-slate-400"
                  }`}
                >
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>

        {phase === "error" && switchState.error && (
          <p className="mt-4 rounded-[20px] border border-red-100 bg-red-50/90 px-4 py-3 text-xs leading-6 text-red-600">
            {switchState.error}
          </p>
        )}
      </div>
    </div>
  );
};

export default SwitchProgress;
