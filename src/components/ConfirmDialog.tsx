import React from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
}) => (
<div
    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
  >
    <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-8 shadow-[0_28px_80px_-35px_rgba(15,23,42,0.5)]">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500/80">
        Danger Zone
      </p>
      <h2
        id="confirm-dialog-title"
        className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950"
      >
        {title}
      </h2>
      <p className="mb-6 mt-2 text-sm leading-7 text-slate-500">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600"
        >
          确认删除
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmDialog;
