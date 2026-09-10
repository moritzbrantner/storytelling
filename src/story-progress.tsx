"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "./ui";

export type StoryProgressProps = {
  value: number;
  label?: string;
  className?: string;
};

export function StoryProgress({ value, label, className }: StoryProgressProps) {
  const reducedMotion = useReducedMotion();
  const percentage = Math.max(0, Math.min(value, 1)) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      ) : null}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentage)}
      >
        <motion.div
          className="h-full rounded-full bg-foreground"
          animate={{ width: `${percentage}%` }}
          transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
