"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Brain,
  LayoutDashboard,
  Activity,
  Plug,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  FileText,
  MessageCircle,
  Building2,
} from "lucide-react";
import { getSession, getToken, clearSession, validateSession, hasCompletedOnboardingLocally } from "@/lib/auth";
import type { User } from "@/lib/types";
import { BackendStatus } from "@/components/ApiBootstrap";
import { NexaLogo } from "@/components/NexaLogo";
import { NexaChatFab } from "@/components/NexaChatFab";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", icon: Brain, label: "Brain" },
  { href: "/dashboard/chat", icon: MessageCircle, label: "Nexa Chat" },
  { href: "/dashboard/business", icon: Building2, label: "Business Hub" },
  { href: "/dashboard/command", icon: LayoutDashboard, label: "Command Center" },
  { href: "/dashboard/plan", icon: FileText, label: "Marketing Plan" },
  { href: "/dashboard/activity", icon: Activity, label: "Activity Log" },
  { href: "/dashboard/integrations", icon: Plug, label: "Integrations" },
  { href: "/dashboard/billing", icon: CreditCard, label: "Billing" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => getSession());
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    const cached = getSession();
    if (cached) setUser(cached);

    (async () => {
      const session = await validateSession();
      if (!session) {
        if (!getToken()) router.replace("/login");
        return;
      }
      setUser(session);
    })();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    if (
      !user.onboarded &&
      !hasCompletedOnboardingLocally(user.email) &&
      pathname !== "/onboarding"
    ) {
      router.replace("/onboarding");
    }
  }, [user, pathname, router]);

  const logout = () => {
    clearSession();
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center text-text-2">
        Loading…
      </div>
    );
  }

  const sidebar = (
    <>
      <div className="p-6 border-b border-border">
        <NexaLogo variant="sidebar" href="/dashboard" />
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV.map((item) => {
          const normalized = pathname?.replace(/\/$/, "") || "";
          const href = item.href.replace(/\/$/, "");
          const active = normalized === href || normalized.startsWith(`${href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-text-2 hover:bg-surface-2 hover:text-text"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
            {user.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-text-3 truncate">{user.company}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text-3 hover:text-text rounded-lg hover:bg-surface-2"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-void grid-bg flex">
      <aside className="hidden lg:flex w-64 border-r border-border bg-ink/90 backdrop-blur-xl flex-col fixed inset-y-0 left-0 z-40">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-void/80" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-ink border-r border-border flex flex-col">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-void/80 backdrop-blur-xl px-4 lg:px-6 h-14 flex items-center justify-between">
          <button className="lg:hidden p-2" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <BackendStatus />
            <span className="px-2 py-1 text-xs rounded-full bg-success/10 text-success border border-success/20 capitalize">
              {user.plan} plan
            </span>
            <span className="px-2 py-1 text-xs rounded-full bg-accent/10 text-accent border border-accent/20">
              AI Active
            </span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <NexaChatFab />
      </div>
    </div>
  );
}
