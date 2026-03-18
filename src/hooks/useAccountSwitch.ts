import { useAccountStore } from "../store/accountStore";
import { api } from "../utils/invoke";
import { Account } from "../types";

export const useAccountSwitch = () => {
  const { accounts, setSwitchState, showToast, setAccounts } = useAccountStore();

  const switchAccount = async (toAccount: Account) => {
    const activeAccount = accounts.find((a) => a.isActive);
    const fromId = activeAccount?.id ?? null;
    const toId = toAccount.id;

    setSwitchState({
      phase: "snapshotting",
      fromAccountId: fromId,
      toAccountId: toId,
      error: null,
      snapshotResult: null,
      restoreResult: null,
    });

    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;

    try {
      const toAuth = await api.readAccountCredentials(toId);

      // Simulate visual phase transitions while backend runs atomically
      t1 = setTimeout(() => setSwitchState({ phase: "restoring" }), 600);
      t2 = setTimeout(() => setSwitchState({ phase: "writing_auth" }), 1400);

      const result = await api.switchAccount(fromId, toId, toAuth);

      clearTimeout(t1);
      clearTimeout(t2);

      if (!result.success) {
        throw new Error(result.error ?? "Switch failed for unknown reason");
      }

      setSwitchState({
        phase: "done",
        snapshotResult: result.snapshot,
        restoreResult: result.restore,
      });

      const now = new Date().toISOString();
      const updatedAccounts = accounts.map((a) => ({
        ...a,
        isActive: a.id === toId,
        lastSwitchedAt: a.id === toId ? now : a.lastSwitchedAt,
        sessionInfo:
          a.id === toId
            ? {
                fileCount: result.restore.fileCount,
                totalBytes: result.restore.totalBytes,
                lastSnapshotAt: result.restore.restoreTime,
              }
            : a.id === fromId
            ? {
                fileCount: result.snapshot.fileCount,
                totalBytes: result.snapshot.totalBytes,
                lastSnapshotAt: result.snapshot.snapshotTime,
              }
            : a.sessionInfo,
      }));

      setAccounts(updatedAccounts);
      try {
        await api.saveAccounts({ version: "1.0", accounts: updatedAccounts });
        showToast(`已切换至 ${toAccount.displayName}`);
      } catch (persistError: unknown) {
        showToast(
          `已切换至 ${toAccount.displayName}，但本地状态保存失败: ${
            persistError instanceof Error ? persistError.message : String(persistError)
          }`,
        );
      }

      setTimeout(
        () =>
          setSwitchState({ phase: "idle", fromAccountId: null, toAccountId: null }),
        1500,
      );
    } catch (err: unknown) {
      clearTimeout(t1);
      clearTimeout(t2);
      const msg = err instanceof Error ? err.message : String(err);
      setSwitchState({ phase: "error", error: msg });
      showToast(`切换失败: ${msg}`);
    }
  };

  return { switchAccount };
};
