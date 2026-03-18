import React from "react";
import { useAccountStore } from "../store/accountStore";

const Toast: React.FC = () => {
  const { toastMessage } = useAccountStore();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-[0_22px_45px_-25px_rgba(15,23,42,0.75)]">
        <div className="h-2 w-2 rounded-full bg-indigo-400" />
        {toastMessage}
      </div>
    </div>
  );
};

export default Toast;
