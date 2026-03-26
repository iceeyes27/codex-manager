import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useAccountStore } from "../store/accountStore";
import {
  formatRelativeTime,
  getBestQuotaAccount,
  getHourlyUsageEfficiency,
  getRecommendedAccountId,
} from "../utils/dashboard";
import { api } from "../utils/invoke";
import type { Account, UsageStatsSummary } from "../types";
import { hoverLift, revealUp } from "../utils/motion";
import { getAccountTokenUsage } from "../utils/tokenLedger";

interface UsageStatsPageProps {
  isRefreshing: boolean;
  onRefreshUsage: () => Promise<void>;
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "--";
  }
  return `${Math.round(value)}%`;
}

function formatTokenNumber(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "--";
  }
  return value.toLocaleString("zh-CN");
}

function efficiencyTone(status: ReturnType<typeof getHourlyUsageEfficiency>["status"]): string {
  switch (status) {
    case "balanced":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "aggressive":
      return "text-rose-700 bg-rose-50 border-rose-200";
    case "underused":
      return "text-amber-700 bg-amber-50 border-amber-200";
    default:
      return "text-slate-500 bg-slate-50 border-slate-200";
  }
}

function describeAction(account: Account, recommendedId: string | null): string {
  if (account.isActive && account.id === recommendedId) {
    return "继续";
  }
  if (account.id === recommendedId) {
    return "切换";
  }
  if (account.isActive) {
    return "观察";
  }
  return "待命";
}

function formatAccountSessionToken(
  account: Account,
  usageStats: UsageStatsSummary | null,
): string {
  const usage = getAccountTokenUsage(account, usageStats?.latestTotalTokens);
  return usage.totalTokens > 0 ? formatTokenNumber(usage.totalTokens) : "--";
}

function formatAccountSessionModel(
  account: Account,
  usageStats: UsageStatsSummary | null,
): string {
  if (!account.isActive) {
    return "--";
  }

  return usageStats?.latestModel ?? "--";
}

const UsageStatsPage: React.FC<UsageStatsPageProps> = ({
  isRefreshing,
  onRefreshUsage,
}) => {
  const { accounts, setAddModalOpen } = useAccountStore();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [usageStats, setUsageStats] = useState<UsageStatsSummary | null>(null);

  const refreshSummary = async () => {
    try {
      const summary = await api.readUsageStatsSummary();
      setUsageStats(summary);
    } catch {
      setUsageStats(null);
    }
  };

  const handleRefreshStats = async () => {
    await onRefreshUsage();
    await refreshSummary();
  };

  useEffect(() => {
    let cancelled = false;
    const syncSummary = async () => {
      try {
        const summary = await api.readUsageStatsSummary();
        if (!cancelled) {
          setUsageStats(summary);
        }
      } catch {
        if (!cancelled) {
          setUsageStats(null);
        }
      }
    };

    const handleWindowFocus = () => {
      void syncSummary();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncSummary();
      }
    };

    void syncSummary();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncSummary();
      }
    }, 2000);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accounts]);

  if (accounts.length === 0) {
    return (
      <section className="mx-auto w-full max-w-[1480px]">
        <motion.div
          className="apple-panel rounded-[34px] px-8 py-20 text-center"
          {...revealUp(prefersReducedMotion, 0.04)}
        >
          <span className="eyebrow-chip">Usage</span>
          <h2 className="mx-auto mt-5 max-w-3xl text-[2.2rem] font-black tracking-[-0.07em] text-slate-950 sm:text-[2.8rem]">
            先接入账户，再看统计
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600">
            这里会显示当前压力、模型分布和下一位候选。
          </p>
          <button
            onClick={() => setAddModalOpen(true)}
            className="primary-action mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
          >
            添加第一个账户
          </button>
        </motion.div>
      </section>
    );
  }

  const now = Date.now();
  const sortedAccounts = [...accounts].sort((left, right) => {
    const leftPrimary = left.rateLimits?.primary?.usedPercent ?? Number.POSITIVE_INFINITY;
    const rightPrimary = right.rateLimits?.primary?.usedPercent ?? Number.POSITIVE_INFINITY;
    if (left.isActive) return -1;
    if (right.isActive) return 1;
    if (leftPrimary !== rightPrimary) {
      return leftPrimary - rightPrimary;
    }
    return left.displayName.localeCompare(right.displayName, "zh-CN");
  });

  const activeAccount = sortedAccounts.find((account) => account.isActive) ?? null;
  const bestAccount = getBestQuotaAccount(sortedAccounts);
  const recommendedId = getRecommendedAccountId(sortedAccounts);
  const efficiencyRows = sortedAccounts.map((account) => ({
    account,
    efficiency: getHourlyUsageEfficiency(account, now),
  }));

  const efficiencyValues = efficiencyRows
    .map((row) => row.efficiency.score)
    .filter((value): value is number => typeof value === "number");
  const averageEfficiency =
    efficiencyValues.length > 0
      ? Math.round(
          efficiencyValues.reduce((sum, value) => sum + value, 0) / efficiencyValues.length,
        )
      : null;
  const mostUnderused = [...efficiencyRows]
    .filter((row) => typeof row.efficiency.score === "number")
    .sort((left, right) => (left.efficiency.score ?? 0) - (right.efficiency.score ?? 0))[0];
  const hottestAccount = [...sortedAccounts].sort((left, right) => {
    const leftUsage = left.rateLimits?.primary?.usedPercent ?? -1;
    const rightUsage = right.rateLimits?.primary?.usedPercent ?? -1;
    return rightUsage - leftUsage;
  })[0];

  return (
    <section className="mx-auto w-full max-w-[1480px] space-y-4">
      <motion.div
        className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
        {...revealUp(prefersReducedMotion, 0.02)}
      >
        <div className="max-w-xl">
          <span className="eyebrow-chip">Overview</span>
          <h2 className="mt-3 text-[1.8rem] font-black tracking-[-0.07em] text-slate-950 sm:text-[2.15rem]">
            调度判断
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="glass-pill rounded-full px-4 py-2.5 text-sm font-medium text-slate-600">
            {bestAccount?.displayName ?? "暂无建议"}
            {activeAccount ? ` · 当前 ${activeAccount.displayName}` : ""}
          </span>
          <button
            onClick={() => void handleRefreshStats()}
            disabled={isRefreshing}
            className="primary-action rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isRefreshing ? "刷新中..." : "刷新统计"}
          </button>
        </div>
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_290px]">
        <motion.article
          className="relative overflow-hidden rounded-[38px] bg-[linear-gradient(145deg,#13181f_0%,#1c252f_54%,#2a3642_100%)] px-6 py-6 text-white shadow-[0_40px_90px_-56px_rgba(15,23,42,0.88)] sm:px-7"
          {...revealUp(prefersReducedMotion, 0.04)}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_66%)]" />
            <div className="absolute -right-16 top-10 h-56 w-56 rounded-full bg-slate-200/10 blur-3xl" />
            <div className="absolute -left-10 bottom-4 h-48 w-48 rounded-full bg-stone-200/8 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Recommendation
                </span>
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <h3 className="truncate text-[2.1rem] font-black tracking-[-0.07em] text-white sm:text-[2.5rem]">
                    {bestAccount?.displayName ?? "暂无建议"}
                  </h3>
                  <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/86">
                    {bestAccount?.isActive ? "当前最优" : "建议切换"}
                  </span>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  {bestAccount
                    ? bestAccount.isActive
                      ? "当前账号就是最稳的选择。"
                      : "下一轮高强度请求更适合交给它。"
                    : "刷新后再看会更准确。"}
                </p>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.055] px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  当前账号
                </p>
                <p className="mt-2 text-[1.45rem] font-black tracking-[-0.05em] text-white">
                  {activeAccount?.displayName ?? "未匹配"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {activeAccount
                    ? `最近切换 ${formatRelativeTime(activeAccount.lastSwitchedAt)}`
                    : "未匹配当前授权"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
              <div className="rounded-[32px] border border-white/10 bg-white/[0.045] px-6 py-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                  5h 效率
                </p>
                <div className="mt-5 flex items-end gap-3">
                  <p className="text-[4.6rem] font-black tracking-[-0.14em] text-white">
                    {averageEfficiency === null ? "--" : `${averageEfficiency}%`}
                  </p>
                </div>
                <p className="mt-3 text-sm text-slate-300">100% 左右最稳</p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      当前最热
                    </p>
                    <p className="mt-2 text-base font-bold tracking-[-0.03em] text-white">
                      {hottestAccount?.displayName ?? "暂无数据"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      5h 已用 {formatPercent(hottestAccount?.rateLimits?.primary?.usedPercent)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      当前主模型
                    </p>
                    <p className="mt-2 text-base font-bold tracking-[-0.03em] text-white">
                      {usageStats?.latestModel ?? "暂无数据"}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      累计 Token
                    </p>
                    <p className="mt-2 text-base font-bold tracking-[-0.03em] text-white">
                      {usageStats ? formatTokenNumber(usageStats.totalTokens.totalTokens) : "--"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[26px] border border-white/10 bg-white/[0.055] px-5 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    最空闲
                  </p>
                  <p className="mt-3 text-[1.45rem] font-black tracking-[-0.05em] text-white">
                    {mostUnderused?.account.displayName ?? "暂无数据"}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {mostUnderused?.efficiency.detail ?? "当前还没有足够数据。"}
                  </p>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/[0.055] px-5 py-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        最近一轮
                      </p>
                      <p className="mt-2 text-lg font-bold tracking-[-0.04em] text-white">
                        {usageStats?.latestTotalTokens
                          ? formatTokenNumber(usageStats.latestTotalTokens.totalTokens)
                          : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        模型数
                      </p>
                      <p className="mt-2 text-lg font-bold tracking-[-0.04em] text-white">
                        {usageStats?.models.length ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.article>

        <motion.aside
          className="apple-panel-muted rounded-[30px] p-5"
          {...revealUp(prefersReducedMotion, 0.08)}
          whileHover={hoverLift(prefersReducedMotion)}
        >
          <p className="section-kicker">Models</p>
          <div className="mt-4 space-y-4">
            {usageStats?.models.length ? (
              usageStats.models.slice(0, 4).map((model, index) => {
                const ratio =
                  usageStats.totalTokens.totalTokens > 0
                    ? (model.totalTokens / usageStats.totalTokens.totalTokens) * 100
                    : 0;
                return (
                  <div key={model.model}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-950">{model.model}</p>
                          <p className="text-xs text-slate-500">{model.sessions} 个会话</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-600">
                        {Math.round(ratio)}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#111827,#768392)]"
                        style={{ width: `${Math.max(ratio, 6)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">当前还没有模型分布数据。</p>
            )}
          </div>
        </motion.aside>
      </div>

      <motion.section
        className="apple-panel rounded-[32px] p-5 sm:p-5.5"
        {...revealUp(prefersReducedMotion, 0.14)}
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div>
            <p className="section-kicker">Matrix</p>
            <h3 className="mt-2 text-[1.45rem] font-black tracking-[-0.05em] text-slate-950">
              调度矩阵
            </h3>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {efficiencyRows.map(({ account, efficiency }, index) => (
            <motion.div
              key={account.id}
              className="rounded-[26px] border border-slate-200 bg-white/88 px-5 py-4 transition-all hover:border-slate-300 hover:shadow-[0_24px_56px_-40px_rgba(15,23,42,0.22)]"
              {...revealUp(prefersReducedMotion, 0.02 * index)}
            >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-[1.08rem] font-bold tracking-[-0.03em] text-slate-950">
                        {account.displayName}
                      </h4>
                      {account.isActive && (
                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
                          当前
                        </span>
                      )}
                      {account.id === recommendedId && !account.isActive && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                          推荐
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {account.email ?? account.userId ?? "未识别身份"}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[420px]">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        模型
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatAccountSessionModel(account, usageStats)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Token
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatAccountSessionToken(account, usageStats)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        5h 已用
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatPercent(account.rateLimits?.primary?.usedPercent)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        建议
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {describeAction(account, recommendedId)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${efficiencyTone(
                        efficiency.status,
                      )}`}
                    >
                      5h 效率 {efficiency.label}
                    </span>
                    <span className="text-xs text-slate-500">{efficiency.detail}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    最近切换 {formatRelativeTime(account.lastSwitchedAt)}
                  </div>
                </div>
            </motion.div>
            ))}
        </div>
      </motion.section>
    </section>
  );
};

export default UsageStatsPage;
