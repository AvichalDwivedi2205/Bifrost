import type { ReactNode } from "react";

export function TopBar({
  title,
  actions,
}: {
  title: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="bar">
      <div className="bar-t">{title}</div>
      <div className="bar-r">{actions}</div>
    </div>
  );
}

