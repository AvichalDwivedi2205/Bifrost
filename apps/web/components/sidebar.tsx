"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { WalletStatus } from "./wallet-status";

const groups = [
  {
    label: "Overview",
    items: [{ href: "/", icon: "⬡", label: "Dashboard" }],
  },
  {
    label: "Missions",
    items: [
      { href: "/create", icon: "+", label: "New Mission" },
      { href: "/live", icon: "◉", label: "Live Execution" },
      { href: "/history", icon: "≡", label: "History" },
    ],
  },
  {
    label: "Agents",
    items: [
      { href: "/registry", icon: "◈", label: "Registry" },
      { href: "/profile", icon: "◍", label: "Profile" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/analytics", icon: "∿", label: "Analytics" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <div className="nav-logo">
        <div className="wordmark">
          Mission<em>Mesh</em>
        </div>
        <div className="sub">Solana Frontier</div>
      </div>

      {groups.map((group) => (
        <div key={group.label} className="nav-section">
          <div className="nl">{group.label}</div>
          {group.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`ni ${active ? "on" : ""}`}>
                <span className="ni-ico">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="nav-foot">
        <WalletStatus />
      </div>
    </nav>
  );
}
