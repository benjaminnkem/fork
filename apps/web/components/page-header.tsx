import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end", className)}>
      <div className="grid gap-2">
        {eyebrow ? (
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-heading text-3xl tracking-tight text-pretty sm:text-4xl">{title}</h1>
        {description ? (
          <div className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}
