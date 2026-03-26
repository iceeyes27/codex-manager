import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { hoverLift, revealUp } from "../utils/motion";

interface EmptyStateProps {
  onAdd: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onAdd }) => {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      className="apple-panel-strong relative mx-auto flex max-w-5xl flex-col items-center justify-center overflow-hidden rounded-[40px] px-8 py-22 text-center sm:px-12"
      {...revealUp(prefersReducedMotion, 0.04)}
    >
      <div className="pointer-events-none absolute inset-0 shell-grid opacity-30" />
      <div className="pointer-events-none absolute left-[-4rem] top-[-2rem] h-44 w-44 rounded-full bg-sky-100/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-5rem] right-[-2rem] h-52 w-52 rounded-full bg-cyan-50/60 blur-3xl" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-[30px] bg-[linear-gradient(155deg,#0b1220_0%,#18314f_55%,#7daaf5_100%)] text-white shadow-[0_30px_64px_-38px_rgba(15,23,42,0.8)]">
        <svg className="h-11 w-11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
      <span className="relative mt-8 eyebrow-chip">Workspace</span>
      <h3 className="relative mt-5 max-w-4xl text-[2.55rem] font-black tracking-[-0.08em] text-slate-950 sm:text-[3.2rem]">
        先接入一个账户
      </h3>
      <p className="relative mt-4 max-w-2xl text-sm leading-8 text-slate-600 sm:text-[1.02rem]">
        接入后，这里会显示当前账号、待命队列和切换建议。
      </p>
      <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
        <motion.button
          onClick={onAdd}
          className="primary-action rounded-full px-6 py-3 text-sm font-semibold text-white"
          whileHover={hoverLift(prefersReducedMotion)}
        >
          添加账户
        </motion.button>
        <span className="glass-pill rounded-full px-4 py-2.5 text-sm font-medium text-slate-600">
          接入后即可开始切换与判断
        </span>
      </div>
    </motion.div>
  );
};

export default EmptyState;
