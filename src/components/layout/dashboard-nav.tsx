"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HandCoins,
  LayoutDashboard,
  QrCode,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { canManageCollaborators, canManageGym, type LegionsRole } from "@/modules/auth/roles";
import { cn } from "@/lib/utils";

type AppMode = "super-admin" | "gym" | "user";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: "prefix" | "exact";
};

const gymNavigation: NavItem[] = [
  { href: "/dashboard/gym", label: "Panel", icon: LayoutDashboard, match: "exact" },
  { href: "/dashboard/members", label: "Miembros", icon: Users, match: "prefix" },
  { href: "/dashboard/subscriptions", label: "Suscripciones", icon: WalletCards, match: "prefix" },
  { href: "/dashboard/finance", label: "Finanzas", icon: HandCoins, match: "prefix" },
];

const gymSettingsNavigation: NavItem = {
  href: "/dashboard/settings",
  label: "Configuracion",
  icon: Settings,
  match: "prefix",
};

const superAdminNavigation: NavItem[] = [
  { href: "/dashboard/super-admin", label: "Panel general", icon: ShieldCheck, match: "exact" },
  { href: "/dashboard/super-admin/finance", label: "Finanzas SaaS", icon: HandCoins, match: "prefix" },
  { href: "/dashboard/super-admin/reminders", label: "Recordatorios", icon: WalletCards, match: "prefix" },
  { href: "/dashboard/super-admin/discounts", label: "Bonificación", icon: Settings, match: "prefix" },
  { href: "/dashboard/super-admin/tenants", label: "Gimnasios", icon: Users, match: "prefix" },
  { href: "/dashboard/super-admin/settings", label: "Configuracion", icon: Settings, match: "prefix" },
];

const userNavigation: NavItem[] = [{ href: "/dashboard/user", label: "Mi QR", icon: QrCode, match: "prefix" }];

function getGymNavigation(role?: LegionsRole): NavItem[] {
  if (!role || !canManageGym(role)) {
    return [{ href: "/dashboard/gym", label: "Panel", icon: LayoutDashboard, match: "exact" }];
  }

  const links: NavItem[] = [...gymNavigation];
  if (canManageCollaborators(role)) {
    links.push({ href: "/dashboard/collaborators", label: "Colaboradores", icon: UserRoundCog, match: "prefix" });
  }

  links.push(gymSettingsNavigation);

  return links;
}

function isActive(pathname: string, item: NavItem) {
  if (item.match === "exact") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DashboardNav({ mode, role }: { mode: AppMode; role?: LegionsRole }) {
  const pathname = usePathname();
  const links = mode === "super-admin" ? superAdminNavigation : mode === "gym" ? getGymNavigation(role) : userNavigation;

  return (
    <nav className="space-y-1">
      {links.map((item) => {
        const active = isActive(pathname, item);

        return (
          <Button
            key={item.href}
            variant="ghost"
            className={cn(
              "w-full justify-start transition-all duration-200 dark:hover:bg-white/5 dark:hover:shadow-[0_0_20px_-10px_rgba(255,255,255,0.45)]",
              active &&
                "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_0_22px_-8px_rgba(255,255,255,0.65)]",
            )}
            asChild
          >
            <Link href={item.href} aria-current={active ? "page" : undefined}>
              <item.icon className="mr-2 size-4" />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
