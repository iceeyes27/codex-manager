import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useAccountStore } from "../store/accountStore";
import { isAccountInvalid } from "../utils/dashboard";
import { api } from "../utils/invoke";
import { revealUp } from "../utils/motion";
import { buildQuotaCompassSummary, getCycleStartDate } from "../utils/quotaCompass";
import type { Account, DailyWorkspaceUsageResponse } from "../types";

interface UsageStatsPageProps {
  isRefreshing: boolean;
  onRefreshUsage: () => Promise<void>;
}

function formatCredits(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function formatUsd(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return `$${value.toFixed(2)}`;
}

function formatCompassPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function AccountQuotaSummary({
  account,
  dailyUsage,
  error,
  isLoading,
  prefersReducedMotion,
  index,
}: {
  account: Account;
  dailyUsage: DailyWorkspaceUsageResponse | null;
  error: string | null;
  isLoading: boolean;
  prefersReducedMotion: boolean;
  index: number;
}) {
  const fallbackDate =
    dailyUsage?.startDate ||
    dailyUsage?.data[0]?.date ||
    new Date().toISOString().split("T")[0];
  const cycleStartDate = dailyUsage
    ? getCycleStartDate(account.rateLimits?.secondary, fallbackDate)
    : null;
  const summary =
    dailyUsage && cycleStartDate
      ? buildQuotaCompassSummary(dailyUsage.data, cycleStartDate, account.rateLimits?.secondary)
      : null;
  const cards = [
    {
      label: "已用比例",
      value: summary ? formatCompassPercent(summary.usedPercent) : "--",
      suffix: "",
      highlight: false,
    },
    {
      label: "本周已用",
      value: summary ? formatCredits(summary.currentStats.credits, 1) : "--",
      suffix: "Credits",
      highlight: false,
    },
    {
      label: "推算总额",
      value: summary ? formatCredits(summary.estimatedTotalCredits, 1) : "--",
      suffix: "Credits",
      highlight: true,
    },
    {
      label: "周价值 (估算)",
      value: summary ? formatUsd(summary.estimatedTotalUsd) : "--",
      suffix: "",
      highlight: false,
    },
  ];

  return (
    <motion.article
      className="space-y-3"
      {...revealUp(prefersReducedMotion, 0.03 + index * 0.02)}
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-black tracking-[-0.03em] text-slate-950">
              {account.displayName}
            </h3>
            {account.isActive && (
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                当前
              </span>
            )}
            {isAccountInvalid(account) && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700">
                失效
              </span>
            )}
          </div>
          {account.email && <p className="mt-1 truncate text-xs text-slate-500">{account.email}</p>}
        </div>
        {isLoading && <span className="text-xs font-medium text-slate-500">读取中...</span>}
      </div>

      {error && (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          每日用量读取失败：{error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`min-h-[124px] rounded-[18px] border px-5 py-5 ${
              card.highlight
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-500">{card.label}</p>
            <p className="mt-7 whitespace-nowrap text-[2rem] font-black leading-none tracking-[-0.04em] text-emerald-700">
              {card.value}
              {card.suffix && (
                <span className="ml-1 text-sm font-semibold tracking-normal">{card.suffix}</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </motion.article>
  );
}

const UsageStatsPage: React.FC<UsageStatsPageProps> = ({ isRefreshing, onRefreshUsage }) => {
  const { accounts, setAddModalOpen } = useAccountStore();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [dailyUsageByAccount, setDailyUsageByAccount] = useState<
    Record<string, DailyWorkspaceUsageResponse>
  >({});
  const [dailyUsageErrors, setDailyUsageErrors] = useState<Record<string, string>>({});
  const [loadingDailyAccountIds, setLoadingDailyAccountIds] = useState<Record<string, boolean>>({});
  const accountIdsKey = accounts.map((account) => account.id).join("|");

  const refreshDailyUsage = async (targetAccounts: Account[]) => {
    if (targetAccounts.length === 0) {
      setDailyUsageByAccount({});
      setDailyUsageErrors({});
      setLoadingDailyAccountIds({});
      return;
    }

    setLoadingDailyAccountIds(
      Object.fromEntries(targetAccounts.map((account) => [account.id, true])),
    );

    const results = await Promise.all(
      targetAccounts.map(async (account) => {
        try {
          const response = await api.readAccountDailyWorkspaceUsage(account.id, 30);
          return { accountId: account.id, response, error: null };
        } catch (error) {
          return {
            accountId: account.id,
            response: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    setDailyUsageByAccount(
      Object.fromEntries(
        results
          .filter((result) => result.response)
          .map((result) => [result.accountId, result.response as DailyWorkspaceUsageResponse]),
      ),
    );
    setDailyUsageErrors(
      Object.fromEntries(
        results
          .filter((result) => result.error)
          .map((result) => [result.accountId, result.error as string]),
      ),
    );
    setLoadingDailyAccountIds({});
  };

  const handleRefreshStats = async () => {
    await onRefreshUsage();
    await refreshDailyUsage(useAccountStore.getState().accounts.slice(0, 4));
  };

  useEffect(() => {
    let cancelled = false;
    const syncDailyUsage = async () => {
      const targetAccounts = accounts.slice(0, 4);
      if (targetAccounts.length === 0) {
        setDailyUsageByAccount({});
        setDailyUsageErrors({});
        setLoadingDailyAccountIds({});
        return;
      }

      setLoadingDailyAccountIds(
        Object.fromEntries(targetAccounts.map((account) => [account.id, true])),
      );
      const results = await Promise.all(
        targetAccounts.map(async (account) => {
          try {
            const response = await api.readAccountDailyWorkspaceUsage(account.id, 30);
            return { accountId: account.id, response, error: null };
          } catch (error) {
            return {
              accountId: account.id,
              response: null,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      if (!cancelled) {
        setDailyUsageByAccount(
          Object.fromEntries(
            results
              .filter((result) => result.response)
              .map((result) => [result.accountId, result.response as DailyWorkspaceUsageResponse]),
          ),
        );
        setDailyUsageErrors(
          Object.fromEntries(
            results
              .filter((result) => result.error)
              .map((result) => [result.accountId, result.error as string]),
          ),
        );
        setLoadingDailyAccountIds({});
      }
    };

    void syncDailyUsage();

    return () => {
      cancelled = true;
    };
  }, [accountIdsKey, accounts]);

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

  const displayedAccounts = accounts.slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-[1480px] space-y-6">
      <motion.div
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        {...revealUp(prefersReducedMotion, 0.02)}
      >
        <div>
          <span className="eyebrow-chip">Usage</span>
          <h2 className="mt-3 text-[1.8rem] font-black tracking-[-0.07em] text-slate-950 sm:text-[2.15rem]">
            账号周统计
          </h2>
        </div>
        <button
          onClick={() => void handleRefreshStats()}
          disabled={isRefreshing}
          className="primary-action rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isRefreshing ? "刷新中..." : "刷新统计"}
        </button>
      </motion.div>

      <div className="space-y-7">
        {displayedAccounts.map((account, index) => (
          <AccountQuotaSummary
            key={account.id}
            account={account}
            dailyUsage={dailyUsageByAccount[account.id] ?? null}
            error={dailyUsageErrors[account.id] ?? null}
            isLoading={loadingDailyAccountIds[account.id] ?? false}
            prefersReducedMotion={prefersReducedMotion}
            index={index}
          />
        ))}
      </div>
    </section>
  );
};

export default UsageStatsPage;
