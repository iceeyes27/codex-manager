import React, { useRef } from "react";
import { useAccountStore } from "../store/accountStore";
import { exportBackupBundle } from "../utils/backup";

interface HeaderProps {
  onImportConfig: (file: File) => Promise<void>;
}

const APP_VERSION = "v0.1.0";

const Header: React.FC<HeaderProps> = ({ onImportConfig }) => {
  const { accounts, settings, setSettingsOpen, setAddModalOpen, showToast } =
    useAccountStore();
  const activeAccount = accounts.find((a) => a.isActive);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = async () => {
    try {
      await exportBackupBundle(accounts, settings);
      showToast("备份已导出");
    } catch (error) {
      showToast(`导出失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleImportChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await onImportConfig(file);
    event.target.value = "";
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(160deg,_#6452ff_0%,_#4f46e5_100%)] shadow-[0_14px_24px_-16px_rgba(79,70,229,0.7)]">
            <svg
              className="h-5.5 w-5.5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l6 6-6 6" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 18h5" />
            </svg>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[1.9rem] font-black tracking-[-0.04em] text-slate-950 sm:text-[2rem]">
                Codex Manager
              </h1>
              <span className="rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700 shadow-sm">
                {APP_VERSION}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {activeAccount
                ? `当前工作账户：${activeAccount.displayName}`
                : "集中管理 OAuth 账户、会话快照与切换状态"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportChange}
          />

          <button
            onClick={handleExport}
            className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 sm:flex"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v11"
              />
            </svg>
            导出备份
          </button>

          <button
            onClick={() => importInputRef.current?.click()}
            className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 sm:flex"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 13l5 5 5-5M12 18V7"
              />
            </svg>
            导入配置
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
            aria-label="打开设置"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[linear-gradient(160deg,_#6452ff_0%,_#4f46e5_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_28px_-20px_rgba(79,70,229,0.95)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_30px_-18px_rgba(79,70,229,0.88)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
            </svg>
            添加 OAuth 账户
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1480px] px-4 pb-2 sm:hidden">
        <button
          onClick={handleExport}
          className="mr-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-white"
        >
          导出备份
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-white"
        >
          导入配置
        </button>
      </div>
    </header>
  );
};

export default Header;
