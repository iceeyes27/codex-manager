import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Account } from "../types";

export interface QuotaMetric {
  label: string;
  percent: number | null;
  detail: string;
  valueLabel: string;
  tone: "critical" | "warning" | "healthy";
  available: boolean;
}

export interface AccountInsight {
  roleLabel: string;
  roleTone: "plus" | "pro" | "team" | "enterprise" | "business" | "free" | "unknown";
  hourlyQuota: QuotaMetric;
  weeklyQuota: QuotaMetric;
  syncLabel: string;
  hasRealRateLimits: boolean;
}

export interface UsageEfficiency {
  score: number | null;
  usedPercent: number | null;
  elapsedPercent: number | null;
  status: "unavailable" | "underused" | "balanced" | "aggressive";
  label: string;
  detail: string;
}

interface RankedQuotaAccount {
  account: Account;
  primaryUsed: number;
  secondaryUsed: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function metricTone(percent: number): QuotaMetric["tone"] {
  if (percent >= 85) return "critical";
  if (percent >= 55) return "warning";
  return "healthy";
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

function deriveRole(account: Account): Pick<AccountInsight, "roleLabel" | "roleTone"> {
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

function createUnavailableMetric(label: string, suffix: string): QuotaMetric {
  return {
    label,
    percent: null,
    detail: "官方数据未获取",
    valueLabel: `未获取 / ${suffix}`,
    tone: "warning",
    available: false,
  };
}

function deriveHourlyQuota(account: Account): QuotaMetric {
  if (account.rateLimits?.primary) {
    const percent = clamp(account.rateLimits.primary.usedPercent, 0, 100);
    return {
      label: "5小时已使用配额",
      percent,
      detail: `刷新时间 ${formatResetTimestamp(account.rateLimits.primary.resetsAt)}`,
      valueLabel: `${percent}% / 5h`,
      tone: metricTone(percent),
      available: true,
    };
  }

  return createUnavailableMetric("5小时已使用配额", "5h");
}

function deriveWeeklyQuota(account: Account): QuotaMetric {
  if (account.rateLimits?.secondary) {
    const percent = clamp(account.rateLimits.secondary.usedPercent, 0, 100);
    return {
      label: "每周已使用配额",
      percent,
      detail: `刷新时间 ${formatResetTimestamp(account.rateLimits.secondary.resetsAt)}`,
      valueLabel: `${percent}% / week`,
      tone: metricTone(percent),
      available: true,
    };
  }

  return createUnavailableMetric("每周已使用配额", "week");
}

export function getHourlyUsageEfficiency(
  account: Account,
  now = Date.now(),
): UsageEfficiency {
  const primary = account.rateLimits?.primary;
  if (
    !primary ||
    typeof primary.usedPercent !== "number" ||
    typeof primary.resetsAt !== "number" ||
    typeof primary.windowDurationMins !== "number" ||
    primary.windowDurationMins <= 0
  ) {
    return {
      score: null,
      usedPercent: typeof primary?.usedPercent === "number" ? clamp(primary.usedPercent, 0, 100) : null,
      elapsedPercent: null,
      status: "unavailable",
      label: "待接入",
      detail: "缺少完整窗口数据",
    };
  }

  const usedPercent = clamp(primary.usedPercent, 0, 100);
  const windowMs = primary.windowDurationMins * 60 * 1000;
  const resetAtMs = primary.resetsAt * 1000;
  const remainingMs = clamp(resetAtMs - now, 0, windowMs);
  const elapsedPercent = clamp(((windowMs - remainingMs) / windowMs) * 100, 0, 100);

  if (elapsedPercent <= 0.5) {
    return {
      score: null,
      usedPercent,
      elapsedPercent,
      status: "unavailable",
      label: "刚开始",
      detail: "窗口刚启动，暂不计算效率",
    };
  }

  const score = clamp((usedPercent / elapsedPercent) * 100, 0, 999);

  if (score < 70) {
    return {
      score,
      usedPercent,
      elapsedPercent,
      status: "underused",
      label: `${Math.round(score)}%`,
      detail: "窗口利用偏低，当前节奏偏慢",
    };
  }

  if (score <= 120) {
    return {
      score,
      usedPercent,
      elapsedPercent,
      status: "balanced",
      label: `${Math.round(score)}%`,
      detail: "窗口利用健康，节奏比较均衡",
    };
  }

  return {
    score,
    usedPercent,
    elapsedPercent,
    status: "aggressive",
    label: `${Math.round(score)}%`,
    detail: "窗口利用激进，账号压力偏高",
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
        typeof account.rateLimits?.primary?.usedPercent === "number" ||
        typeof account.rateLimits?.secondary?.usedPercent === "number",
    )
    .map((account) => ({
      account,
      primaryUsed:
        typeof account.rateLimits?.primary?.usedPercent === "number"
          ? clamp(account.rateLimits.primary.usedPercent, 0, 100)
          : Number.POSITIVE_INFINITY,
      secondaryUsed:
        typeof account.rateLimits?.secondary?.usedPercent === "number"
          ? clamp(account.rateLimits.secondary.usedPercent, 0, 100)
          : Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => {
      if (left.primaryUsed !== right.primaryUsed) {
        return left.primaryUsed - right.primaryUsed;
      }
      if (left.secondaryUsed !== right.secondaryUsed) {
        return left.secondaryUsed - right.secondaryUsed;
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
