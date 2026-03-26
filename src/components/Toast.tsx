import React from "react";
import { useAccountStore } from "../store/accountStore";

const Toast: React.FC = () => {
  const { toastMessage } = useAccountStore();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2">
      <div className="toast-shell relative flex items-center gap-3 overflow-hidden rounded-full px-5 py-3 text-sm font-medium text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_44%)]" />
        <div className="relative h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.9)]" />
        <span className="relative whitespace-nowrap">
          {toastMessage}
        </span>
      </div>
    </div>
  );
};

export default Toast;
