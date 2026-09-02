"use client";

import { useId, useState } from "react";

import { Button, cn } from "./ui";

export type StoryMinimapItem = {
  id: string;
  title: string;
  eyebrow?: string;
  menuLabel?: string;
};

export type StoryMinimapProps = {
  items?: StoryMinimapItem[];
  activeIndex?: number;
  onSelect?: (index: number) => void;
  className?: string;
  ariaLabel?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function StoryMinimap({
  items = [],
  activeIndex = 0,
  onSelect,
  className,
  ariaLabel = "Story minimap",
  collapsible = false,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}: StoryMinimapProps) {
  const listId = useId();
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = controlledCollapsed ?? internalCollapsed;

  if (items.length < 2) {
    return null;
  }

  const setCollapsed = (nextCollapsed: boolean) => {
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(nextCollapsed);
    }

    onCollapsedChange?.(nextCollapsed);
  };

  return (
    <nav className={cn("rounded-lg border bg-background p-3", className)} aria-label={ariaLabel}>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Minimap
        </p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {activeIndex + 1} / {items.length}
          </p>
          {collapsible ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              aria-expanded={!collapsed}
              aria-controls={listId}
              aria-label={collapsed ? "Show minimap" : "Minimize minimap"}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "Show" : "Hide"}
            </Button>
          ) : null}
        </div>
      </div>

      {collapsed ? null : (
        <ol
          id={listId}
          className="story-steps-scrollbar-hidden flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const isComplete = index < activeIndex;

            return (
              <li key={item.id} className="shrink-0 lg:shrink">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "flex h-auto min-w-[10rem] items-start justify-start gap-3 whitespace-normal rounded-md border px-3 py-3 text-left lg:min-w-0 lg:w-full",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground",
                  )}
                  onClick={() => onSelect?.(index)}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Go to scene ${index + 1}: ${item.title}`}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                      isActive
                        ? "border-background/30 text-background"
                        : isComplete
                          ? "border-foreground/25 text-foreground"
                          : "border-border text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-xs uppercase tracking-[0.14em]",
                        isActive ? "text-background/75" : "text-muted-foreground",
                      )}
                    >
                      {item.menuLabel ?? item.eyebrow ?? `Scene ${index + 1}`}
                    </span>
                    <span className="mt-1 block text-sm font-medium leading-5">{item.title}</span>
                  </span>
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
