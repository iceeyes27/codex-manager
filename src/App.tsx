import React, { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import AccountList from "./components/AccountList";
import SwitchProgress from "./components/SwitchProgress";
import AddAccountModal from "./components/AddAccountModal";
import SettingsModal from "./components/SettingsModal";
import Toast from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import { useAccountStore } from "./store/accountStore";
import { api } from "./utils/invoke";
import { hydrateAccounts } from "./utils/accounts";
import { importBackupBundle } from "./utils/backup";

const App: React.FC = () => {
  const {
    setAccounts,
    updateAccount,
    isAddModalOpen,
    isSettingsOpen,
    accounts,
    setSettings,
    setSettingsSaveState,
    showToast,
    settings,
  } = useAccountStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingAccountIds, setRefreshingAccountIds] = useState<string[]>([]);
  const refreshingRef = useRef(false);
  const settingsLoadedRef = useRef(false);
  const lastSavedSettingsRef = useRef<string | null>(null);

  const refreshAccounts = async (silent = false) => {
    if (refreshingRef.current) return;

    refreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const store = await api.loadAccounts();
      const hydrated = await hydrateAccounts(store.accounts);
      setAccounts(hydrated);
      const rateLimitFailures = hydrated.filter(
        (account) => !account.rateLimits && account.rateLimitsError,
      );
      const activeChanged = hydrated.some(
        (account, index) => account.isActive !== store.accounts[index]?.isActive,
      );
      if (activeChanged) {
        await api.saveAccounts({ version: store.version, accounts: hydrated });
      }
      if (!silent) {
        if (rateLimitFailures.length === hydrated.length && hydrated.length > 0) {
          showToast(`刷新失败: ${rateLimitFailures[0].rateLimitsError}`);
        } else if (rateLimitFailures.length > 0) {
          showToast(
            `部分账号刷新失败（${rateLimitFailures.length}/${hydrated.length}）: ${rateLimitFailures[0].rateLimitsError}`,
          );
        } else {
          showToast("用量已刷新");
        }
      }
    } catch (error) {
      if (!silent) {
        showToast(
          `刷新失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  };

  const refreshAccount = async (accountId: string) => {
    if (refreshingRef.current || refreshingAccountIds.includes(accountId)) {
      return;
    }

    const target = accounts.find((account) => account.id === accountId);
    if (!target) {
      return;
    }

    setRefreshingAccountIds((current) => [...current, accountId]);
    try {
      const [hydrated] = await hydrateAccounts([target]);
      if (!hydrated) {
        throw new Error("未获取到账号数据");
      }

      updateAccount(accountId, hydrated);

      if (!hydrated.rateLimits && hydrated.rateLimitsError) {
        showToast(`刷新失败: ${hydrated.rateLimitsError}`);
      } else {
        showToast(`${hydrated.displayName} 配额已刷新`);
      }
    } catch (error) {
      showToast(`刷新失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRefreshingAccountIds((current) => current.filter((id) => id !== accountId));
    }
  };

  useEffect(() => {
    api.loadSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
      lastSavedSettingsRef.current = JSON.stringify(loadedSettings);
    }).finally(() => {
      settingsLoadedRef.current = true;
    });
    void refreshAccounts(true);
  }, [setSettings]);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = settings.theme === "dark" || (settings.theme === "system" && prefersDark);

    root.classList.toggle("dark", shouldUseDark);
    root.style.colorScheme = shouldUseDark ? "dark" : "light";
  }, [settings.theme]);

  useEffect(() => {
    if (settings.autoRefreshInterval <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void refreshAccounts(true);
    }, settings.autoRefreshInterval * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [settings.autoRefreshInterval]);

  useEffect(() => {
    if (!settingsLoadedRef.current) {
      return;
    }

    const serialized = JSON.stringify(settings);
    if (serialized === lastSavedSettingsRef.current) {
      return;
    }

    setSettingsSaveState("saving");
    const timer = window.setTimeout(() => {
      api.saveSettings(settings)
        .then(() => {
          lastSavedSettingsRef.current = serialized;
          setSettingsSaveState("saved");
          window.setTimeout(() => setSettingsSaveState("idle"), 1200);
        })
        .catch((error) => {
          setSettingsSaveState("error");
          showToast(`设置保存失败: ${error instanceof Error ? error.message : String(error)}`);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [settings, setSettingsSaveState, showToast]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteAccountCredentials(deleteId);
      await api.deleteAccountSessions(deleteId);
      const next = accounts.filter((a) => a.id !== deleteId);
      setAccounts(next);
      await api.saveAccounts({ version: "1.0", accounts: next });
      showToast("账户已删除");
    } catch (err: unknown) {
      showToast(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleteId(null);
    }
  };

  const handleImportConfig = async (file: File) => {
    try {
      const imported = await importBackupBundle(file, accounts);
      setSettings(imported.settings);
      const hydrated = await hydrateAccounts(imported.accounts);
      setAccounts(hydrated);
      showToast("配置已导入");
    } catch (error) {
      showToast(`导入失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleRename = async (id: string, displayName: string) => {
    const name = displayName.trim();
    if (!name) {
      showToast("名称不能为空");
      return;
    }

    const next = accounts.map((account) =>
      account.id === id ? { ...account, displayName: name } : account,
    );

    try {
      setAccounts(next);
      await api.saveAccounts({ version: "1.0", accounts: next });
      showToast("名称已更新");
    } catch (error) {
      showToast(`名称保存失败: ${error instanceof Error ? error.message : String(error)}`);
      await refreshAccounts(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.1),_transparent_22%),linear-gradient(180deg,_#f6f8ff_0%,_#ffffff_42%,_#f9fbff_100%)] text-slate-900">
      <Header onImportConfig={handleImportConfig} />
      <main className="flex-1 overflow-auto px-4 pb-8 pt-4 sm:px-6 sm:pt-3 lg:px-8">
        <AccountList
          isRefreshing={isRefreshing}
          refreshingAccountIds={refreshingAccountIds}
          onDelete={(id) => setDeleteId(id)}
          onRefreshAccount={refreshAccount}
          onRefreshUsage={() => refreshAccounts(false)}
          onRename={handleRename}
        />
      </main>
      <SwitchProgress />
      {isAddModalOpen && <AddAccountModal />}
      {isSettingsOpen && <SettingsModal />}
      <Toast />
      {deleteId && (
        <ConfirmDialog
          title="删除账户"
          message="确定要删除此账户吗？其保存的历史会话也将被移除。"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
};

export default App;
