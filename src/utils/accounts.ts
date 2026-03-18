import { Account } from "../types";
import { api } from "./invoke";

function parseAuthIdentity(content: string): {
  accountId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  email: string | null;
  userId: string | null;
} {
  const decodeJwtPayload = (token: string | null | undefined): Record<string, unknown> | null => {
    if (!token) {
      return null;
    }

    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    try {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const json = atob(padded);
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const extractAccountId = (payload: Record<string, unknown> | null): string | null => {
    if (!payload) {
      return null;
    }

    const direct = payload.chatgpt_account_id;
    if (typeof direct === "string" && direct.trim()) {
      return direct;
    }

    const nested = payload["https://api.openai.com/auth"];
    if (nested && typeof nested === "object" && "chatgpt_account_id" in nested) {
      const value = (nested as Record<string, unknown>).chatgpt_account_id;
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }

    return null;
  };

  const extractEmail = (payload: Record<string, unknown> | null): string | null => {
    if (!payload) {
      return null;
    }

    const direct = payload.email;
    if (typeof direct === "string" && direct.trim()) {
      return direct;
    }

    const profile = payload["https://api.openai.com/profile"];
    if (profile && typeof profile === "object" && "email" in profile) {
      const value = (profile as Record<string, unknown>).email;
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }

    return null;
  };

  const extractUserId = (payload: Record<string, unknown> | null): string | null => {
    if (!payload) {
      return null;
    }

    const direct = payload.user_id;
    if (typeof direct === "string" && direct.trim()) {
      return direct;
    }

    const nested = payload["https://api.openai.com/auth"];
    if (nested && typeof nested === "object") {
      const authClaims = nested as Record<string, unknown>;
      const chatgptUserId = authClaims.chatgpt_user_id;
      if (typeof chatgptUserId === "string" && chatgptUserId.trim()) {
        return chatgptUserId;
      }
      const userId = authClaims.user_id;
      if (typeof userId === "string" && userId.trim()) {
        return userId;
      }
    }

    const sub = payload.sub;
    if (typeof sub === "string" && sub.trim()) {
      return sub;
    }

    return null;
  };

  try {
    const parsed = JSON.parse(content) as {
      tokens?: {
        account_id?: string | null;
        access_token?: string | null;
        refresh_token?: string | null;
        id_token?: string | null;
      };
    };

    const accessToken = parsed.tokens?.access_token ?? null;
    const idToken = parsed.tokens?.id_token ?? null;
    const accessPayload = decodeJwtPayload(accessToken);
    const idPayload = decodeJwtPayload(idToken);
    const accountId =
      parsed.tokens?.account_id ??
      extractAccountId(accessPayload) ??
      extractAccountId(idPayload);

    return {
      accountId,
      accessToken,
      refreshToken: parsed.tokens?.refresh_token ?? null,
      idToken,
      email: extractEmail(accessPayload) ?? extractEmail(idPayload),
      userId: extractUserId(accessPayload) ?? extractUserId(idPayload),
    };
  } catch {
    return {
      accountId: null,
      accessToken: null,
      refreshToken: null,
      idToken: null,
      email: null,
      userId: null,
    };
  }
}

function authMatches(currentAuth: string, savedAuth: string): boolean {
  const current = parseAuthIdentity(currentAuth);
  const saved = parseAuthIdentity(savedAuth);

  if (current.accountId && saved.accountId) {
    return current.accountId === saved.accountId;
  }
  if (current.refreshToken && saved.refreshToken) {
    return current.refreshToken === saved.refreshToken;
  }
  if (current.accessToken && saved.accessToken) {
    return current.accessToken === saved.accessToken;
  }
  if (current.idToken && saved.idToken) {
    return current.idToken === saved.idToken;
  }

  return currentAuth.trim() === savedAuth.trim();
}

async function resolveActiveAccountId(accounts: Account[]): Promise<string | null> {
  const currentAuth = await api.readAuthJson().catch(() => null);
  if (!currentAuth) {
    return accounts.find((account) => account.isActive)?.id ?? null;
  }

  const currentIdentity = parseAuthIdentity(currentAuth);

  if (currentIdentity.email) {
    const emailMatch = accounts.find(
      (account) =>
        account.email &&
        account.email.trim().toLowerCase() === currentIdentity.email?.trim().toLowerCase(),
    );
    if (emailMatch) {
      return emailMatch.id;
    }
  }

  if (currentIdentity.userId) {
    const userIdMatch = accounts.find(
      (account) =>
        account.userId &&
        account.userId.trim().toLowerCase() === currentIdentity.userId?.trim().toLowerCase(),
    );
    if (userIdMatch) {
      return userIdMatch.id;
    }
  }

  for (const account of accounts) {
    const savedAuth = await api.readAccountCredentials(account.id).catch(() => null);
    if (savedAuth && authMatches(currentAuth, savedAuth)) {
      return account.id;
    }
  }

  return null;
}

export async function hydrateAccounts(accounts: Account[]): Promise<Account[]> {
  const activeAccountId = await resolveActiveAccountId(accounts);
  const activeSessionInfo = activeAccountId
    ? await api.getCurrentSessionsInfo().catch(() => null)
    : null;

  return Promise.all(
    accounts.map(async (account) => {
      const rateLimitResult = await api
        .readAccountRateLimits(account.id)
        .then((rateLimits) => ({
          rateLimits,
          rateLimitsError: null,
        }))
        .catch((error: unknown) => ({
          rateLimits: null,
          rateLimitsError: error instanceof Error ? error.message : String(error),
        }));
      const isActive = activeAccountId ? account.id === activeAccountId : account.isActive;

      if (isActive) {
        return {
          ...account,
          isActive,
          sessionInfo: activeSessionInfo ?? account.sessionInfo,
          rateLimits: rateLimitResult.rateLimits,
          rateLimitsError: rateLimitResult.rateLimitsError,
        };
      }

      const snapshotInfo = await api
        .listAccountSessionInfo(account.id)
        .catch(() => account.sessionInfo);

      return {
        ...account,
        isActive,
        sessionInfo: snapshotInfo ?? account.sessionInfo,
        rateLimits: rateLimitResult.rateLimits,
        rateLimitsError: rateLimitResult.rateLimitsError,
      };
    }),
  );
}
