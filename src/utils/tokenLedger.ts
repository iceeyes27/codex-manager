import type { Account, AccountUsageLedger, TokenUsageInfo } from "../types";

export function emptyTokenUsage(): TokenUsageInfo {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
  };
}

export function normalizeUsageLedger(account: Account): AccountUsageLedger {
  return account.usageLedger ?? {
    accumulated: emptyTokenUsage(),
    segmentStart: null,
    lastUpdatedAt: null,
  };
}

export function addTokenUsage(
  left: TokenUsageInfo | null | undefined,
  right: TokenUsageInfo | null | undefined,
): TokenUsageInfo {
  const base = left ?? emptyTokenUsage();
  const extra = right ?? emptyTokenUsage();

  return {
    inputTokens: base.inputTokens + extra.inputTokens,
    cachedInputTokens: base.cachedInputTokens + extra.cachedInputTokens,
    outputTokens: base.outputTokens + extra.outputTokens,
    reasoningOutputTokens: base.reasoningOutputTokens + extra.reasoningOutputTokens,
    totalTokens: base.totalTokens + extra.totalTokens,
  };
}

export function diffTokenUsage(
  current: TokenUsageInfo | null | undefined,
  start: TokenUsageInfo | null | undefined,
): TokenUsageInfo {
  const currentValue = current ?? emptyTokenUsage();
  const startValue = start ?? emptyTokenUsage();

  return {
    inputTokens: Math.max(0, currentValue.inputTokens - startValue.inputTokens),
    cachedInputTokens: Math.max(0, currentValue.cachedInputTokens - startValue.cachedInputTokens),
    outputTokens: Math.max(0, currentValue.outputTokens - startValue.outputTokens),
    reasoningOutputTokens: Math.max(
      0,
      currentValue.reasoningOutputTokens - startValue.reasoningOutputTokens,
    ),
    totalTokens: Math.max(0, currentValue.totalTokens - startValue.totalTokens),
  };
}

export function finalizeAccountUsage(
  account: Account,
  liveUsage: TokenUsageInfo | null | undefined,
  observedAt: string,
): Account {
  const ledger = normalizeUsageLedger(account);
  const segmentUsage = diffTokenUsage(liveUsage, ledger.segmentStart);

  return {
    ...account,
    usageLedger: {
      accumulated: addTokenUsage(ledger.accumulated, segmentUsage),
      segmentStart: null,
      lastUpdatedAt: observedAt,
    },
  };
}

export function beginAccountUsage(
  account: Account,
  liveUsage: TokenUsageInfo | null | undefined,
  observedAt: string,
): Account {
  const ledger = normalizeUsageLedger(account);

  return {
    ...account,
    usageLedger: {
      accumulated: ledger.accumulated,
      segmentStart: liveUsage ?? emptyTokenUsage(),
      lastUpdatedAt: observedAt,
    },
  };
}

export function getAccountTokenUsage(
  account: Account,
  liveUsage: TokenUsageInfo | null | undefined,
): TokenUsageInfo {
  const ledger = normalizeUsageLedger(account);
  if (!account.isActive) {
    return ledger.accumulated;
  }

  return addTokenUsage(ledger.accumulated, diffTokenUsage(liveUsage, ledger.segmentStart));
}
