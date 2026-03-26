import React from "react";
import { clsx } from "clsx";
import { useAccountStore } from "../store/accountStore";
import { Account } from "../types";
import { formatRelativeTime, getAccountInsight, getRecommendedAccountId } from "../utils/dashboard";

interface TrayPanelProps {
  isRefreshing: boolean;
  refreshingAccountIds: string[];
  isImportingCurrentAuth: boolean;
  isSmartSwitching: boolean;
  unmanagedCurrentAuthLabel: string | null;
  onRefreshUsage: () => Promise<void>;
  onRefreshAccount: (id: string) => Promise<void>;
  onImportCurrentAuth: () => Promise<void>;
  onSmartSwitch: () => Promise<void>;
  onSwitch: (account: Account) => void;
}

const TrayPanel: React.FC<TrayPanelProps> = ({
  isRefreshing,
  refreshingAccountIds,
  isImportingCurrentAuth,
  isSmartSwitching,
  unmanagedCurrentAuthLabel,
  onRefreshUsage,
  onRefreshAccount,
  onImportCurrentAuth,
  onSmartSwitch,
  onSwitch,
}) => {
  const { accounts, setAddModalOpen, switchState } = useAccountStore();
  const recommendedId = getRecommendedAccountId(accounts);
  const isSwitching = switchState.phase !== "idle";
  const importButtonLabel = isImportingCurrentAuth
    ? "导入中"
    : unmanagedCurrentAuthLabel
      ? "导入当前授权"
      : "导入当前授权";

  return (
    <section className="mx-auto w-full max-w-[520px] bg-transparent text-stone-100">
      <div className="dark-glass-panel relative overflow-hidden rounded-[34px] px-4 pb-4 pt-4 text-white shadow-[0_30px_90px_-42px_rgba(0,0,0,0.84)]">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_68%)]" />
          <div className="absolute -right-10 top-8 h-44 w-44 rounded-full bg-stone-200/10 blur-3xl" />
          <div className="absolute -left-12 bottom-8 h-40 w-40 rounded-full bg-slate-200/8 blur-3xl" />
        </div>

        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-stone-200/72">Quick</p>
            <h2 className="mt-1 text-[1.45rem] font-black tracking-[-0.06em] text-white/96">
              账户切换
            </h2>
          </div>
          <button
            onClick={() => void onRefreshUsage()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/78 transition-all hover:border-white/25 hover:bg-white/16 hover:text-white disabled:opacity-60"
          >
            <svg
              className={clsx("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            刷新
          </button>
        </div>

        {unmanagedCurrentAuthLabel && (
          <div className="relative mt-4 rounded-[24px] border border-amber-200/16 bg-amber-300/10 px-4 py-3.5 text-amber-50 shadow-[0_22px_50px_-36px_rgba(245,158,11,0.48)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/72">
              Current
            </p>
            <p className="mt-1 text-sm font-semibold">
              当前 auth 属于 {unmanagedCurrentAuthLabel}
            </p>
          </div>
        )}

        <div className="relative mt-4 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => void onImportCurrentAuth()}
            disabled={isImportingCurrentAuth}
            className="rounded-[22px] border border-stone-200/14 bg-stone-200/10 px-3 py-3 text-sm font-semibold text-stone-50 transition-all hover:border-stone-200/24 hover:bg-stone-200/14 disabled:opacity-60"
          >
            {importButtonLabel}
          </button>
          <button
            onClick={() => void onSmartSwitch()}
            disabled={isSmartSwitching}
            className="rounded-[22px] border border-white/12 bg-white/8 px-3 py-3 text-sm font-semibold text-white transition-all hover:border-white/20 hover:bg-white/12 disabled:opacity-60"
          >
            {isSmartSwitching ? "智能切换中..." : "智能切换"}
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="rounded-[22px] border border-white/12 bg-white/8 px-3 py-3 text-sm font-semibold text-white transition-all hover:border-white/20 hover:bg-white/12"
          >
            添加账号
          </button>
          <div className="rounded-[22px] border border-white/10 bg-white/8 px-3 py-3 text-sm text-white/66">
            账户数 <span className="font-semibold text-white/92">{accounts.length}</span>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-3.5">
          {accounts.length === 0 && (
            <div className="col-span-2 rounded-[24px] border border-dashed border-white/12 bg-white/8 px-4 py-8 text-center text-sm text-white/60">
              还没有账户。
            </div>
          )}

          {accounts.map((account) => {
            const insight = getAccountInsight(account);
            const isActive = account.isActive;
            const isSelfRefreshing = refreshingAccountIds.includes(account.id);

            return (
              <article
                key={account.id}
                className={clsx(
                  "overflow-hidden rounded-[26px] border px-3.5 py-3.5 shadow-[0_24px_50px_-34px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all hover:-translate-y-0.5",
                  isActive
                    ? "border-sky-300/32 bg-[linear-gradient(180deg,rgba(18,69,114,0.45),rgba(25,33,52,0.42))]"
                    : recommendedId === account.id
                      ? "border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))]"
                      : "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[13px] font-bold tracking-[-0.03em] text-white/95">
                        {account.displayName}
                      </h3>
                      {recommendedId === account.id && !isActive && (
                        <span className="rounded-full border border-white/18 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/84">
                          推荐
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-white/60">
                      {account.email ?? account.userId ?? "未绑定邮箱"}
                    </p>
                  </div>

                  <span
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
                      isActive
                        ? "border-stone-200/18 bg-stone-200/12 text-stone-100"
                        : "border-white/10 bg-white/10 text-white/72",
                    )}
                  >
                    {isActive ? "当前" : insight.roleLabel}
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-[20px] border border-white/7 bg-black/10 p-2.5">
                  {[insight.hourlyQuota, insight.weeklyQuota].map((metric) => (
                    <div key={metric.label}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                        {metric.label.includes("5") ? "5H" : "WEEK"}
                      </div>
                      <div className="mt-1 text-[12px] font-bold text-white/92">{metric.valueLabel}</div>
                      <div className="mt-0.5 truncate text-[10px] leading-4 text-white/50" title={metric.detail}>
                        {metric.detail}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-white/42">
                  <span className="truncate">最近切换 {formatRelativeTime(account.lastSwitchedAt)}</span>
                  <button
                    onClick={() => void onRefreshAccount(account.id)}
                    disabled={isRefreshing || isSelfRefreshing}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-1 font-semibold text-white/72 transition-all hover:border-white/20 hover:bg-white/14 disabled:opacity-60"
                  >
                    <svg
                      className={clsx("h-3 w-3", (isRefreshing || isSelfRefreshing) && "animate-spin")}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    刷新
                  </button>
                </div>

                <button
                  onClick={() => !isActive && onSwitch(account)}
                  disabled={isActive || isSwitching}
                  className={clsx(
                    "mt-2.5 w-full rounded-[18px] px-3 py-2.5 text-[12px] font-semibold transition-all disabled:cursor-not-allowed",
                    isActive
                      ? "border border-stone-200/18 bg-stone-200/12 text-stone-100"
                      : "border border-white/12 bg-white/12 text-white hover:border-white/20 hover:bg-white/16",
                  )}
                >
                  {isActive ? "当前使用中" : isSwitching ? "切换中..." : "切换"}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrayPanel;
