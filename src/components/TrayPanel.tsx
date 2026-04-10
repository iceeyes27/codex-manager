import React from "react";
import { clsx } from "clsx";
import { Window, getCurrentWindow } from "@tauri-apps/api/window";
import { useAccountStore } from "../store/accountStore";
import {
  formatRelativeTime,
  getAccountInsight,
  getAccountStatusReason,
  getRecommendedAccountId,
  isAccountInvalid,
} from "../utils/dashboard";

interface TrayPanelProps {
  unmanagedCurrentAuthLabel: string | null;
}

const TrayPanel: React.FC<TrayPanelProps> = ({ unmanagedCurrentAuthLabel }) => {
  const { accounts } = useAccountStore();
  const recommendedId = getRecommendedAccountId(accounts);
  const activeAccount = accounts.find((account) => account.isActive) ?? null;
  const recommendedAccount =
    accounts.find((account) => account.id === recommendedId) ?? null;
  const isTauriRuntime =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  const openMainWindow = async () => {
    if (!isTauriRuntime) {
      return;
    }

    const mainWindow = await Window.getByLabel("main");
    if (!mainWindow) {
      return;
    }

    await getCurrentWindow().hide();
    await mainWindow.unminimize();
    await mainWindow.show();
    await mainWindow.setFocus();
  };

  return (
    <section
      className={clsx(
        "h-full w-full bg-transparent text-stone-100",
        isTauriRuntime && "cursor-pointer",
      )}
      onClick={() => void openMainWindow()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void openMainWindow();
        }
      }}
      role={isTauriRuntime ? "button" : undefined}
      tabIndex={isTauriRuntime ? 0 : undefined}
    >
      <div className="dark-glass-panel relative flex h-full flex-col overflow-hidden rounded-[34px] px-4 pb-4 pt-4 text-white shadow-[0_30px_90px_-42px_rgba(0,0,0,0.84)]">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_68%)]" />
          <div className="absolute -right-10 top-8 h-44 w-44 rounded-full bg-stone-200/10 blur-3xl" />
          <div className="absolute -left-12 bottom-8 h-40 w-40 rounded-full bg-slate-200/8 blur-3xl" />
        </div>

        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-stone-200/72">
              Quick
            </p>
            <h2 className="mt-1 text-[1.45rem] font-black tracking-[-0.06em] text-white/96">
              状态概览
            </h2>
          </div>
          <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/78">
            {accounts.length} 个账户
          </div>
        </div>

        {unmanagedCurrentAuthLabel && (
          <div className="relative mt-4 rounded-[24px] border border-amber-200/16 bg-amber-300/10 px-4 py-3.5 text-amber-50 shadow-[0_22px_50px_-36px_rgba(245,158,11,0.48)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/72">
              Current
            </p>
            <p className="mt-1 text-sm font-semibold">
              当前 auth 属于 {unmanagedCurrentAuthLabel}
            </p>
          </div>
        )}

        <div className="relative mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-[22px] border border-white/12 bg-white/8 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/44">
              Current
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white/94">
              {activeAccount?.displayName ?? "暂无当前账户"}
            </p>
            <p className="mt-1 truncate text-[11px] text-white/54">
              {activeAccount?.email ?? activeAccount?.userId ?? "请在主窗口完成导入或切换"}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/12 bg-white/8 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/44">
              Recommendation
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white/94">
              {recommendedAccount?.displayName ?? "暂无建议"}
            </p>
            <p className="mt-1 text-[11px] text-white/54">
              {recommendedAccount && activeAccount?.id !== recommendedAccount.id
                ? "详细操作请在主窗口完成"
                : accounts.some((account) => isAccountInvalid(account))
                  ? "检测到失效账号"
                  : "当前状态正常"}
            </p>
          </div>
        </div>

        <div className="relative mt-4 grid flex-1 auto-rows-max grid-cols-2 gap-3.5 overflow-y-auto pr-1">
          {accounts.length === 0 && (
            <div className="col-span-2 rounded-[24px] border border-dashed border-white/12 bg-white/8 px-4 py-8 text-center text-sm text-white/60">
              还没有账户，请在主窗口完成导入或添加。
            </div>
          )}

          {accounts.map((account) => {
            const insight = getAccountInsight(account);
            const isActive = account.isActive;
            const isInvalid = isAccountInvalid(account);
            const invalidReason = getAccountStatusReason(account);

            return (
              <article
                key={account.id}
                className={clsx(
                  "overflow-hidden rounded-[26px] border px-3.5 py-3.5 shadow-[0_24px_50px_-34px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-transform duration-200",
                  isInvalid
                    ? "border-rose-200/26 bg-[linear-gradient(180deg,rgba(127,29,29,0.32),rgba(40,16,16,0.28))]"
                    : isActive
                    ? "border-sky-300/32 bg-[linear-gradient(180deg,rgba(18,69,114,0.45),rgba(25,33,52,0.42))]"
                    : recommendedId === account.id
                      ? "border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))]"
                      : "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[13px] font-bold tracking-[-0.03em] text-white/95">
                        {account.displayName}
                      </h3>
                      {recommendedId === account.id && !isActive && !isInvalid && (
                        <span className="rounded-full border border-white/18 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/84">
                          推荐
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-white/60">
                      {account.email ?? account.userId ?? "未绑定邮箱"}
                    </p>
                  </div>

                  <span
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
                      isInvalid
                        ? "border-rose-200/24 bg-rose-500/14 text-rose-100"
                        : isActive
                        ? "border-stone-200/18 bg-stone-200/12 text-stone-100"
                        : "border-white/10 bg-white/10 text-white/72",
                    )}
                  >
                    {isInvalid ? "失效" : isActive ? "当前" : insight.roleLabel}
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-[20px] border border-white/7 bg-black/10 p-2.5">
                  {[insight.hourlyQuota, insight.weeklyQuota].map((metric) => (
                    <div key={metric.label}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                        {metric.label.includes("5") ? "5H" : "WEEK"}
                      </div>
                      <div className="mt-1 text-[12px] font-bold text-white/92">
                        {metric.valueLabel}
                      </div>
                      <div
                        className="mt-0.5 truncate text-[10px] leading-4 text-white/50"
                        title={metric.detail}
                      >
                        {metric.detail}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-white/42">
                  <span className="truncate">
                    {isInvalid
                      ? `已失效 · ${invalidReason ?? "请在主窗口重新登录"}`
                      : `最近切换 ${formatRelativeTime(account.lastSwitchedAt)}`}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-white/62">
                    只读概览
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="relative mt-4 rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 text-[12px] leading-5 text-white/62">
          小窗仅用于悬浮概览。点击小窗即可打开主窗口，导入、刷新、切换、添加账号等操作请在主窗口完成。
        </div>
      </div>
    </section>
  );
};

export default TrayPanel;
