import React from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = "确认",
  tone = "danger",
  onConfirm,
  onCancel,
}) => (
  <div
    className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center px-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
  >
    <div className="dialog-shell w-full max-w-[560px] rounded-[32px] p-8">
      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] ${
            tone === "danger"
              ? "bg-red-50 text-red-600"
              : "bg-sky-50 text-sky-600"
          }`}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {tone === "danger" ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 9v4m0 4h.01M10.29 3.86l-7.54 13.08A2 2 0 004.46 20h15.08a2 2 0 001.73-3.06L13.73 3.86a2 2 0 00-3.46 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold uppercase tracking-[0.3em] ${
              tone === "danger" ? "text-red-500/80" : "text-sky-500/80"
            }`}
          >
            操作确认
          </p>
          <h2
            id="confirm-dialog-title"
            className="mt-3 text-[2rem] font-black tracking-[-0.05em] text-slate-950"
          >
            {title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">{message}</p>
        </div>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="glass-pill rounded-full px-5 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-white/78 hover:text-slate-900"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          className={`rounded-full px-5 py-3 text-sm font-medium text-white shadow-[0_18px_34px_-24px_rgba(15,23,42,0.72)] transition-all hover:-translate-y-0.5 ${
            tone === "danger"
              ? "bg-[linear-gradient(160deg,#b91c1c,#ef4444)] hover:brightness-105"
              : "bg-[linear-gradient(160deg,#07111f,#2563eb)] hover:brightness-105"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmDialog;
