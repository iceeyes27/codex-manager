import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAccountStore } from "../store/accountStore";
import { api } from "../utils/invoke";
import { Account } from "../types";
import { hydrateAccounts } from "../utils/accounts";

const AddAccountModal: React.FC = () => {
  const { setAddModalOpen, accounts, setAccounts, showToast } = useAccountStore();
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      isMountedRef.current = false;
    };
  }, []);

  const isOauthCancelledError = (message: string) =>
    /cancelled|canceled|取消/i.test(message);

  const handleCancel = async () => {
    if (isMountedRef.current) {
      setAddModalOpen(false);
    }

    if (loading) {
      void api.cancelOauthFlow().catch(() => {
        // The modal is already closed, so ignore cancellation transport errors here.
      });
    }
  };

  const handleAdd = async () => {
    if (!displayName.trim()) {
      showToast("请输入名称");
      return;
    }

    setLoading(true);
    try {
      const result = await api.startOauthFlow();

      const newAccount: Account = {
        id: uuidv4(),
        displayName: displayName.trim(),
        email: result.email,
        userId: result.userId,
        isActive: false,
        createdAt: new Date().toISOString(),
        lastSwitchedAt: null,
        sessionInfo: null,
      };

      await api.saveAccountCredentials(newAccount.id, result.authJson);
      const next = await hydrateAccounts([...accounts, newAccount]);
      setAccounts(next);
      await api.saveAccounts({ version: "1.0", accounts: next });

      showToast("已添加账户");
      if (isMountedRef.current) {
        setAddModalOpen(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isOauthCancelledError(message)) {
        showToast(`添加失败 · ${message}`);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-account-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          void handleCancel();
        }
      }}
    >
      <div
        className="dialog-shell w-full max-w-[720px] rounded-[34px] p-8 sm:p-9"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative mb-8 grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
          <div className="rounded-[28px] bg-[linear-gradient(155deg,rgba(21,26,34,0.98),rgba(35,46,58,0.94),rgba(92,105,122,0.76))] p-6 text-white shadow-[0_32px_72px_-46px_rgba(22,26,31,0.72)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/12 text-white backdrop-blur-md">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l6 6-6 6" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 18h5" />
              </svg>
            </div>
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-100/72">OAuth</p>
            <h3 className="mt-3 text-[2rem] font-black tracking-[-0.06em]">
              接入新账号
            </h3>
          </div>

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="eyebrow-chip">OAuth</span>
                <h2
                  id="add-account-title"
                  className="mt-4 text-[2.4rem] font-black tracking-[-0.07em] text-slate-950"
                >
                  添加账户
                </h2>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleCancel();
                }}
                className="glass-pill flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-white/80 hover:text-slate-900"
                aria-label={loading ? "取消授权并关闭" : "关闭添加账户"}
              >
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="relative grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4">
            <div className="apple-panel-muted rounded-[28px] p-5">
              <label className="section-kicker tracking-[0.28em] text-slate-500">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="例如：工作账号（主）"
                className="mt-3 w-full rounded-[22px] border border-slate-200/90 bg-white/84 px-4 py-3.5 text-base text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                autoFocus
              />
            </div>

            <div className="apple-panel rounded-[28px] p-5">
              <p className="section-kicker tracking-[0.28em]">Flow</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>命名后开始授权。</p>
                <p>完成登录后会自动加入账户列表。</p>
              </div>
            </div>
          </div>

          <div className="apple-panel rounded-[30px] p-5">
            <p className="section-kicker tracking-[0.28em]">Preview</p>
            <div className="mt-4 rounded-[28px] bg-[linear-gradient(155deg,rgba(255,255,255,0.82),rgba(240,249,255,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700/74">
                New
              </p>
              <p className="mt-3 truncate text-[1.45rem] font-black tracking-[-0.05em] text-slate-950">
                {displayName.trim() || "等待命名"}
              </p>
            </div>

            <p className="mt-4 rounded-[24px] border border-sky-100 bg-sky-50/85 px-4 py-3 text-sm leading-6 text-sky-800">
              不会覆盖你当前正在使用的共享会话。
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleCancel();
                }}
                className="glass-pill rounded-full px-5 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-white/78 hover:text-slate-900"
              >
                {loading ? "取消授权" : "取消"}
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={loading}
                className="flex items-center gap-2 rounded-full bg-[linear-gradient(160deg,#07111f_0%,#163a72_58%,#3b82f6_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_38px_-22px_rgba(15,23,42,0.86)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                )}
                {loading ? "授权中..." : "开始授权"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAccountModal;
