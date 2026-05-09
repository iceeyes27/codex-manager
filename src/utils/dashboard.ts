import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Account, RateLimitWindow } from "../types";

export interface QuotaMetric {
  label: string;
  percent: number | null;
  detail: string;
  valueLabel: string;
  resetLabel: string | null;
  tone: "critical" | "warning" | "healthy";
  available: boolean;
}

export interface AccountInsight {
  roleLabel: string;
  roleTone:
    | "plus"
    | "pro"
    | "team"
    | "enterprise"
    | "business"
    | "free"
    | "unknown"
    | "invalid";
  hourlyQuota: QuotaMetric;
  weeklyQuota: QuotaMetric;
  syncLabel: string;
  hasRealRateLimits: boolean;
}

export interface UsageEfficiency {
  score: number | null;
  remainingPercent: number | null;
  usedPercent: number | null;
  elapsedPercent: number | null;
  status: "unavailable" | "underused" | "balanced" | "aggressive";
  label: string;
  detail: string;
}

interface RankedQuotaAccount {
  account: Account;
  primaryRemaining: number;
  secondaryRemaining: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function metricTone(percent: number): QuotaMetric["tone"] {
  if (percent <= 15) return "critical";
  if (percent <= 45) return "warning";
  return "healthy";
}

export function getRemainingPercent(
  window: RateLimitWindow | null | undefined,
): number | null {
  if (!window) {
    return null;
  }
  if (typeof window.remainingPercent === "number") {
    return clamp(window.remainingPercent, 0, 100);
  }
  return null;
}

function formatResetTimestamp(timestampSeconds: number | null | undefined): string {
  if (!timestampSeconds) {
    return "时间待定";
  }

  try {
    return format(new Date(timestampSeconds * 1000), "yyyy-MM-dd HH:mm");
  } catch {
    return "时间待定";
  }
}

function formatResetShort(timestampSeconds: number | null | undefined, mode: "time" | "date"): string {
  if (!timestampSeconds) {
    return "时间待定";
  }

  try {
    return format(new Date(timestampSeconds * 1000), mode === "time" ? "HH:mm" : "M月d日", {
      locale: zhCN,
    });
  } catch {
    return "时间待定";
  }
}

function formatSyncTime(iso: string | null): string {
  if (!iso) {
    return "暂无同步记录";
  }

  try {
    const date = new Date(iso);
    if (isToday(date)) {
      return `今天 ${format(date, "HH:mm")}`;
    }
    if (isYesterday(date)) {
      return `昨天 ${format(date, "HH:mm")}`;
    }
    return format(date, "yyyy-MM-dd HH:mm");
  } catch {
    return "时间未知";
  }
}

export function isAccountInvalid(account: Account): boolean {
  return account.accountStatus === "invalid";
}

export function getAccountStatusReason(account: Account): string | null {
  return account.accountStatusReason ?? account.rateLimitsError ?? null;
}

function deriveRole(account: Account): Pick<AccountInsight, "roleLabel" | "roleTone"> {
  if (isAccountInvalid(account)) {
    return { roleLabel: "失效", roleTone: "invalid" };
  }

  const normalized = account.rateLimits?.planType?.trim().toLowerCase() ?? "";

  switch (normalized) {
    case "plus":
      return { roleLabel: "Plus", roleTone: "plus" };
    case "pro":
      return { roleLabel: "Pro", roleTone: "pro" };
    case "team":
      return { roleLabel: "Team", roleTone: "team" };
    case "enterprise":
      return { roleLabel: "Enterprise", roleTone: "enterprise" };
    case "business":
      return { roleLabel: "Business", roleTone: "business" };
    case "free":
      return { roleLabel: "Free", roleTone: "free" };
    default:
      return { roleLabel: "Unknown", roleTone: "unknown" };
  }
}

function createUnavailableMetric(account: Account, label: string, suffix: string): QuotaMetric {
  if (isAccountInvalid(account)) {
    return {
      label,
      percent: null,
      detail: getAccountStatusReason(account) ?? "账号已失效或不可用",
      valueLabel: `失效 / ${suffix}`,
      resetLabel: null,
      tone: "critical",
      available: false,
    };
  }

  return {
    label,
    percent: null,
    detail: "官方数据未获取",
    valueLabel: `未获取 / ${suffix}`,
    resetLabel: null,
    tone: "warning",
    available: false,
  };
}

function deriveHourlyQuota(account: Account): QuotaMetric {
  const primary = account.rateLimits?.primary;
  const percent = getRemainingPercent(primary);
  if (percent !== null) {
    const resetLabel = formatResetShort(primary?.resetsAt, "time");
    return {
      label: "5小时剩余额度",
      percent,
      detail: `重置时间 ${formatResetTimestamp(primary?.resetsAt)}`,
      valueLabel: `${percent}% · ${resetLabel}`,
      resetLabel,
      tone: metricTone(percent),
      available: true,
    };
  }

  return createUnavailableMetric(account, "5小时剩余额度", "5h");
}

function deriveWeeklyQuota(account: Account): QuotaMetric {
  const secondary = account.rateLimits?.secondary;
  const percent = getRemainingPercent(secondary);
  if (percent !== null) {
    const resetLabel = formatResetShort(secondary?.resetsAt, "date");
    return {
      label: "每周剩余额度",
      percent,
      detail: `重置时间 ${formatResetTimestamp(secondary?.resetsAt)}`,
      valueLabel: `${percent}% · ${resetLabel}`,
      resetLabel,
      tone: metricTone(percent),
      available: true,
    };
  }

  return createUnavailableMetric(account, "每周剩余额度", "week");
}

export function getHourlyUsageEfficiency(
  account: Account,
  now = Date.now(),
): UsageEfficiency {
  const primary = account.rateLimits?.primary;
  const remainingPercent = getRemainingPercent(primary);
  if (
    !primary ||
    remainingPercent === null ||
    typeof primary.resetsAt !== "number" ||
    typeof primary.windowDurationMins !== "number" ||
    primary.windowDurationMins <= 0
  ) {
    return {
      score: null,
      remainingPercent,
      usedPercent: remainingPercent === null ? null : 100 - remainingPercent,
      elapsedPercent: null,
      status: "unavailable",
      label: "待接入",
      detail: "缺少完整窗口数据",
    };
  }

  const usedPercent = 100 - remainingPercent;
  const windowMs = primary.windowDurationMins * 60 * 1000;
  const resetAtMs = primary.resetsAt * 1000;
  const remainingMs = clamp(resetAtMs - now, 0, windowMs);
  const elapsedPercent = clamp(((windowMs - remainingMs) / windowMs) * 100, 0, 100);

  if (elapsedPercent <= 0.5) {
    return {
      score: null,
      remainingPercent,
      usedPercent,
      elapsedPercent,
      status: "unavailable",
      label: "刚开始",
      detail: "窗口刚启动，暂不计算效率",
    };
  }

  const paceRatio = usedPercent / elapsedPercent;
  const score = clamp((1 - Math.min(Math.abs(paceRatio - 1), 1)) * 100, 0, 100);

  if (paceRatio < 0.75) {
    return {
      score,
      remainingPercent,
      usedPercent,
      elapsedPercent,
      status: "underused",
      label: `${Math.round(score)}%`,
      detail: "剩余额度消耗低于时间进度，节奏偏慢",
    };
  }

  if (paceRatio <= 1.25) {
    return {
      score,
      remainingPercent,
      usedPercent,
      elapsedPercent,
      status: "balanced",
      label: `${Math.round(score)}%`,
      detail: "剩余额度消耗与时间进度基本同步",
    };
  }

  return {
    score,
    remainingPercent,
    usedPercent,
    elapsedPercent,
    status: "aggressive",
    label: `${Math.round(score)}%`,
    detail: "剩余额度消耗高于时间进度，账号压力偏高",
  };
}

export function getAccountInsight(account: Account): AccountInsight {
  const role = deriveRole(account);
  const hourlyQuota = deriveHourlyQuota(account);
  const weeklyQuota = deriveWeeklyQuota(account);
  const syncSource = account.isActive
    ? account.lastSwitchedAt ?? account.createdAt
    : account.sessionInfo?.lastSessionObservedAt ?? account.lastSwitchedAt ?? account.createdAt;

  return {
    ...role,
    hourlyQuota,
    weeklyQuota,
    syncLabel: account.isActive ? "刚刚 (实时)" : formatSyncTime(syncSource),
    hasRealRateLimits: Boolean(account.rateLimits?.primary || account.rateLimits?.secondary),
  };
}

function getRankedQuotaAccounts(accounts: Account[]): RankedQuotaAccount[] {
  return accounts
    .filter(
      (account) =>
        !isAccountInvalid(account) &&
        (getRemainingPercent(account.rateLimits?.primary) !== null ||
          getRemainingPercent(account.rateLimits?.secondary) !== null),
    )
    .map((account) => ({
      account,
      primaryRemaining:
        getRemainingPercent(account.rateLimits?.primary) ?? Number.NEGATIVE_INFINITY,
      secondaryRemaining:
        getRemainingPercent(account.rateLimits?.secondary) ?? Number.NEGATIVE_INFINITY,
    }))
    .sort((left, right) => {
      if (left.primaryRemaining !== right.primaryRemaining) {
        return right.primaryRemaining - left.primaryRemaining;
      }
      if (left.secondaryRemaining !== right.secondaryRemaining) {
        return right.secondaryRemaining - left.secondaryRemaining;
      }
      return left.account.createdAt.localeCompare(right.account.createdAt);
    });
}

export function getRecommendedAccountId(accounts: Account[]): string | null {
  return (
    getRankedQuotaAccounts(accounts)
      .find(({ account }) => !account.isActive)
      ?.account.id ?? null
  );
}

export function getBestQuotaAccount(accounts: Account[]): Account | null {
  return getRankedQuotaAccounts(accounts)[0]?.account ?? null;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) {
    return "暂无记录";
  }

  try {
    return formatDistanceToNowStrict(new Date(iso), {
      addSuffix: true,
      locale: zhCN,
    });
  } catch {
    return "暂无记录";
  }
}
