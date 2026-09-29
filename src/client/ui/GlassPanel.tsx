import type { HTMLAttributes, ReactNode } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article" | "aside";
  children: ReactNode;
}

export function GlassPanel({ as: Tag = "div", className, children, ...rest }: GlassPanelProps) {
  return (
    <Tag {...rest} className={`glass rounded-[var(--radius-panel)] ${className ?? ""}`}>
      {children}
    </Tag>
  );
}
