import type { HTMLAttributes, ReactNode } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article" | "aside";
  children: ReactNode;
}

export function GlassPanel({ as: Tag = "div", className, children, ...rest }: GlassPanelProps) {
  return (
    <Tag {...rest} className={`glass rounded-[var(--radius-panel)] shadow-[0_12px_40px_#00000055] ${className ?? ""}`}>
      {children}
    </Tag>
  );
}
