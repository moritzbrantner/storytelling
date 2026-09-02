import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { Button, cn } from "../../src/ui";

export { Button, cn };

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline";
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        variant === "default" && "border-primary bg-primary text-primary-foreground",
        variant === "secondary" && "border-secondary bg-secondary text-secondary-foreground",
        variant === "outline" && "border-border bg-transparent text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-1.5 p-5 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("m-0 text-base font-semibold", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function LoadingState({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-lg border border-border bg-card p-8 text-muted-foreground",
        className,
      )}
      role="status"
    >
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-lg border border-[#d7826b] bg-[#fff5f1] p-8 text-[#7b2f1f]",
        className,
      )}
      role="alert"
    >
      {children}
    </div>
  );
}

type ToggleGroupContextValue = {
  onValueChange?: (value: string) => void;
  value: string;
};

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

type ToggleGroupProps = HTMLAttributes<HTMLDivElement> & {
  onValueChange?: (value: string) => void;
  type: "single";
  value: string;
};

export function ToggleGroup({
  className,
  onValueChange,
  type: _type,
  value,
  ...props
}: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange }}>
      <div className={cn("flex flex-wrap items-center gap-1", className)} role="group" {...props} />
    </ToggleGroupContext.Provider>
  );
}

type ToggleGroupItemProps = ButtonHTMLAttributes<HTMLButtonElement> & { value: string };

export function ToggleGroupItem({ className, onClick, value, ...props }: ToggleGroupItemProps) {
  const context = useContext(ToggleGroupContext);
  if (!context) throw new Error("ToggleGroupItem must be rendered inside ToggleGroup");
  const active = context.value === value;

  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "h-8 rounded-md border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-transparent bg-transparent text-foreground hover:bg-muted",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.onValueChange?.(active ? "" : value);
      }}
      {...props}
    />
  );
}

export function TooltipProvider({ children }: { children?: ReactNode; delayDuration?: number }) {
  return <>{children}</>;
}

export function Tooltip({ children }: { children?: ReactNode }) {
  return <span className="group relative inline-flex">{children}</span>;
}

export function TooltipTrigger({ asChild, children }: { asChild?: boolean; children?: ReactNode }) {
  if (asChild) {
    const child = Children.only(children);
    return isValidElement(child) ? cloneElement(child as ReactElement) : null;
  }
  return <button type="button">{children}</button>;
}

export function TooltipContent({
  className,
  children,
  side: _side,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg group-hover:block group-focus-within:block",
        className,
      )}
      role="tooltip"
      {...props}
    >
      {children}
    </span>
  );
}
