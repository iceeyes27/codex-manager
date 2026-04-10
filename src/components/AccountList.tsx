import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { useAccountStore } from "../store/accountStore";
import { Account } from "../types";
import AccountCard from "./AccountCard";
import EmptyState from "./EmptyState";
import {
  formatRelativeTime,
  getAccountStatusReason,
  getAccountInsight,
  getRecommendedAccountId,
  isAccountInvalid,
} from "../utils/dashboard";
import { hoverLift, revealUp } from "../utils/motion";

interface AccountListProps {
  isRefreshing: boolean;
  refreshingAccountIds: string[];
  onDelete: (id: string) => void;
  onRefreshAccount: (id: string) => Promise<void>;
  onRefreshUsage: () => Promise<void>;
  onRename: (id: string, displayName: string) => Promise<void>;
  onSwitch: (account: Account) => void;
}

const AccountList: React.FC<AccountListProps> = ({
  isRefreshing,
  refreshingAccountIds,
  onDelete,
  onRefreshAccount,
  onRefreshUsage,
  onRename,
  onSwitch,
}) => {
  const { accounts, setAddModalOpen, switchState } = useAccountStore();
  const prefersReducedMotion = useReducedMotion() ?? false;

  if (accounts.length === 0) {
    return <EmptyState onAdd={() => setAddModalOpen(true)} />;
  }

  const sorted = [...accounts].sort((a, b) => {
    if (a.isActive) return -1;
    if (b.isActive) return 1;
    const da = a.lastSwitchedAt ? new Date(a.lastSwitchedAt).getTime() : 0;
    const db = b.lastSwitchedAt ? new Date(b.lastSwitchedAt).getTime() : 0;
    return db - da;
  });
  const recommendedId = getRecommendedAccountId(sorted);
  const featuredAccount =
    sorted.find((account) => account.isActive) ??
    sorted.find((account) => account.id === recommendedId) ??
    sorted[0];
  const standbyAccounts = sorted.filter((account) => account.id !== featuredAccount?.id);
  const recommendedStandby = sorted.find(
    (account) => account.id === recommendedId && account.id !== featuredAccount?.id,
  );
  const featuredQuota = featuredAccount?.rateLimits?.primary?.usedPercent;
  const featuredIdentity =
    featuredAccount?.email ?? featuredAccount?.userId ?? "未识别身份";
  const featuredInsight = featuredAccount ? getAccountInsight(featuredAccount) : null;
  const featuredInvalid = featuredAccount ? isAccountInvalid(featuredAccount) : false;
  const isSwitching = switchState.phase !== "idle";
  const isSwitchTarget =
    featuredAccount && switchState.toAccountId === featuredAccount.id && isSwitching;
  const featuredStatus = featuredInvalid
    ? featuredAccount?.isActive
      ? "当前已失效"
      : "已失效"
    : featuredAccount?.isActive
      ? "当前"
      : isSwitchTarget
        ? "切换中"
        : "待命";

  return (
    <section className="mx-auto w-full max-w-[1480px] space-y-4">
      {featuredAccount && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_290px]">
          <motion.article
            className="relative overflow-hidden rounded-[38px] bg-[linear-gradient(145deg,#13181f_0%,#1c252f_54%,#2a3642_100%)] px-6 py-6 text-white shadow-[0_40px_90px_-56px_rgba(15,23,42,0.88)] sm:px-7"
            {...revealUp(prefersReducedMotion, 0.04)}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_66%)]" />
              <div className="absolute -right-16 top-8 h-52 w-52 rounded-full bg-slate-200/10 blur-3xl" />
              <div className="absolute -left-12 bottom-6 h-48 w-48 rounded-full bg-stone-200/8 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Current
                  </span>
                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <h2 className="truncate text-[2.1rem] font-black tracking-[-0.07em] text-white sm:text-[2.5rem]">
                      {featuredAccount.displayName}
                    </h2>
                    <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/86">
                      {featuredStatus}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-white/86">
                      {featuredInsight?.roleLabel ?? "账号"}
                    </span>
                    <span className="truncate">{featuredIdentity}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={onRefreshUsage}
                    disabled={isRefreshing}
                    className="rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/12 disabled:opacity-60"
                  >
                    {isRefreshing ? "刷新中..." : "刷新全部用量"}
                  </button>
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_18px_36px_-26px_rgba(255,255,255,0.85)] transition-all hover:-translate-y-0.5"
                  >
                    添加账户
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                <div className="rounded-[32px] border border-white/10 bg-white/[0.045] px-6 py-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                    5h 已用
                  </p>
                  <div className="mt-5 flex items-end gap-3">
                    <p className="text-[4.8rem] font-black tracking-[-0.14em] text-white">
                      {typeof featuredQuota === "number" ? `${Math.round(featuredQuota)}%` : "--"}
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">
                    {featuredInsight?.hourlyQuota.detail ?? "等待同步"}
                  </p>

                  <div className="mt-8 flex items-center gap-3">
                    <button
                      onClick={() =>
                        !featuredAccount.isActive &&
                        !featuredInvalid &&
                        !isSwitching &&
                        onSwitch(featuredAccount)
                      }
                      disabled={featuredAccount.isActive || featuredInvalid || isSwitching}
                      className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed ${
                        featuredInvalid
                          ? "border border-rose-200 bg-rose-50 text-rose-600"
                          : featuredAccount.isActive
                          ? "border border-white/12 bg-white/10 text-white"
                          : "bg-white text-slate-950 shadow-[0_18px_32px_-24px_rgba(255,255,255,0.78)] disabled:bg-white/60"
                      }`}
                    >
                      {featuredInvalid
                        ? "账号失效"
                        : featuredAccount.isActive
                        ? "当前使用中"
                        : isSwitchTarget
                          ? "切换中..."
                          : "切换到此账号"}
                    </button>
                    <button
                      onClick={() => onDelete(featuredAccount.id)}
                      className="rounded-full border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white/80 transition-all hover:bg-white/12 hover:text-white"
                    >
                      删除
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.055] px-5 py-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      下一位
                    </p>
                    <p className="mt-3 text-[1.45rem] font-black tracking-[-0.05em] text-white">
                      {recommendedStandby?.displayName ?? "继续当前账号"}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {recommendedStandby ? "需要切换时，优先交给它。" : "当前账号仍然最合适。"}
                    </p>
                  </div>

                  <div className="rounded-[26px] border border-white/10 bg-white/[0.055] px-5 py-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                          本周
                        </p>
                        <p className="mt-2 text-lg font-bold tracking-[-0.04em] text-white">
                          {featuredInsight?.weeklyQuota.valueLabel ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                          待命
                        </p>
                        <p className="mt-2 text-lg font-bold tracking-[-0.04em] text-white">
                          {standbyAccounts.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                          账户数
                        </p>
                        <p className="mt-2 text-lg font-bold tracking-[-0.04em] text-white">
                          {sorted.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                          上次切换
                        </p>
                        <p className="mt-2 text-lg font-bold tracking-[-0.04em] text-white">
                          {formatRelativeTime(featuredAccount.lastSwitchedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1 pt-1 text-xs text-slate-400">
                    <span>
                      {featuredInvalid
                        ? `已失效 · ${getAccountStatusReason(featuredAccount) ?? "请重新登录该账号"}`
                        : `最近更新 ${featuredInsight?.syncLabel ?? "--"}`}
                    </span>
                    <button
                      onClick={() => void onRefreshAccount(featuredAccount.id)}
                      disabled={refreshingAccountIds.includes(featuredAccount.id) || isRefreshing}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 font-semibold text-white/80 transition-all hover:bg-white/12 disabled:opacity-60"
                    >
                      刷新
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.article>

          <motion.aside
            className="apple-panel-muted flex flex-col rounded-[30px] p-5"
            {...revealUp(prefersReducedMotion, 0.08)}
            whileHover={hoverLift(prefersReducedMotion)}
          >
            <p className="section-kicker">Next</p>
            <p className="mt-3 text-[1.5rem] font-black tracking-[-0.05em] text-slate-950">
              {recommendedStandby?.displayName ?? "继续当前账号"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {recommendedStandby ? "需要切换时，优先交给它。" : "当前账号仍然最合适。"}
            </p>

            <div className="apple-divider my-5 border-t" />

            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  当前识别
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{featuredIdentity}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    5h 已用
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                    {typeof featuredQuota === "number" ? `${Math.round(featuredQuota)}%` : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    待命
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                    {standbyAccounts.length}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    账户数
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                    {sorted.length}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    上次切换
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                    {featuredAccount.lastSwitchedAt
                      ? formatRelativeTime(featuredAccount.lastSwitchedAt)
                      : "--"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button
                onClick={() => setAddModalOpen(true)}
                className="primary-action w-full rounded-full px-4 py-3 text-sm font-semibold text-white"
              >
                添加账户
              </button>
            </div>
          </motion.aside>
        </div>
      )}

      <motion.section
        className="apple-panel-muted rounded-[30px] p-4 sm:p-4.5"
        {...revealUp(prefersReducedMotion, 0.14)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
          <div>
            <p className="section-kicker">Standby</p>
            <h3 className="mt-1 text-[1.1rem] font-black tracking-[-0.04em] text-slate-950">
              待命队列
            </h3>
          </div>
          <span className="text-sm font-medium text-slate-500">{standbyAccounts.length} 个账号</span>
        </div>

        <div className="mt-4 space-y-2.5">
          {standbyAccounts.map((account, index) => (
            <motion.div
              key={account.id}
              {...revealUp(prefersReducedMotion, 0.02 * index)}
            >
              <AccountCard
                account={account}
                isRecommended={account.id === recommendedId}
                isRefreshing={isRefreshing}
                isRefreshingSelf={refreshingAccountIds.includes(account.id)}
                onDelete={onDelete}
                onRefresh={() => onRefreshAccount(account.id)}
                onRename={onRename}
                onSwitch={onSwitch}
                variant="compact"
              />
            </motion.div>
          ))}

          {standbyAccounts.length === 0 && (
            <div className="apple-panel-muted rounded-[24px] px-5 py-7 text-center text-sm text-slate-500">
              当前还没有待命账号。
            </div>
          )}
        </div>
      </motion.section>
    </section>
  );
};

export default AccountList;
