import type {
  DailyWorkspaceUsage,
  DailyWorkspaceUsageTotals,
  RateLimitWindow,
} from "../types";

export const USD_PER_CODEX_CREDIT = 40 / 1000;

export interface QuotaCompassStats {
  credits: number;
  turns: number;
  tokens: number;
  usd: number;
}

export interface QuotaCompassSummary {
  currentCycleList: DailyWorkspaceUsage[];
  historyList: DailyWorkspaceUsage[];
  currentStats: QuotaCompassStats;
  historyStats: QuotaCompassStats;
  usedPercent: number | null;
  estimatedTotalCredits: number | null;
  estimatedTotalUsd: number | null;
}

function numberOrZero(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function dayTime(date: string): number {
  const time = new Date(`${date}T00:00:00Z`).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function getDailyTokenTotal(totals: DailyWorkspaceUsageTotals | null | undefined): number {
  if (!totals) {
    return 0;
  }

  const explicitTotal = numberOrZero(totals.textTotalTokens);
  if (explicitTotal > 0) {
    return explicitTotal;
  }

  return (
    numberOrZero(totals.cachedTextInputTokens) +
    numberOrZero(totals.uncachedTextInputTokens) +
    numberOrZero(totals.textOutputTokens)
  );
}

export function getQuotaCompassStats(list: DailyWorkspaceUsage[]): QuotaCompassStats {
  const totals = list.reduce(
    (sum, day) => ({
      credits: sum.credits + numberOrZero(day.totals?.credits),
      turns: sum.turns + numberOrZero(day.totals?.turns),
      tokens: sum.tokens + getDailyTokenTotal(day.totals),
    }),
    { credits: 0, turns: 0, tokens: 0 },
  );

  return {
    ...totals,
    usd: totals.credits * USD_PER_CODEX_CREDIT,
  };
}

export function getWindowUsedPercent(window: RateLimitWindow | null | undefined): number | null {
  if (!window) {
    return null;
  }

  if (typeof window.usedPercent === "number" && Number.isFinite(window.usedPercent)) {
    return Math.max(0, Math.min(100, window.usedPercent));
  }

  return Math.max(0, Math.min(100, 100 - window.remainingPercent));
}

export function getCycleStartDate(
  weeklyWindow: RateLimitWindow | null | undefined,
  fallbackStartDate: string,
): string {
  if (!weeklyWindow?.resetsAt || !weeklyWindow.windowDurationMins) {
    return fallbackStartDate;
  }

  return new Date((weeklyWindow.resetsAt - weeklyWindow.windowDurationMins * 60) * 1000)
    .toISOString()
    .split("T")[0];
}

export function buildQuotaCompassSummary(
  dailyList: DailyWorkspaceUsage[],
  cycleStartDate: string,
  weeklyWindow: RateLimitWindow | null | undefined,
): QuotaCompassSummary {
  const cycleStartTime = dayTime(cycleStartDate);
  const currentCycleList: DailyWorkspaceUsage[] = [];
  const historyList: DailyWorkspaceUsage[] = [];

  [...dailyList]
    .sort((left, right) => dayTime(left.date) - dayTime(right.date))
    .forEach((item) => {
      if (dayTime(item.date) >= cycleStartTime) {
        currentCycleList.push(item);
      } else {
        historyList.push(item);
      }
    });

  const currentStats = getQuotaCompassStats(currentCycleList);
  const historyStats = getQuotaCompassStats(historyList);
  const usedPercent = getWindowUsedPercent(weeklyWindow);
  const estimatedTotalCredits =
    usedPercent && usedPercent > 0 ? currentStats.credits / (usedPercent / 100) : null;

  return {
    currentCycleList,
    historyList,
    currentStats,
    historyStats,
    usedPercent,
    estimatedTotalCredits,
    estimatedTotalUsd:
      estimatedTotalCredits === null ? null : estimatedTotalCredits * USD_PER_CODEX_CREDIT,
  };
}

export function formatCompactTokenNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toLocaleString("zh-CN");
}
