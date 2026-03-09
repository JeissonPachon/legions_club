import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { Sedgwick_Ave_Display } from "next/font/google";
import type { LegionsRole } from "@/modules/auth/roles";

const sedgwick = Sedgwick_Ave_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

type AppShellProps = {
  children: React.ReactNode;
  mode: "super-admin" | "gym" | "user";
  tenantSlug?: string;
  role?: LegionsRole;
};

export function AppShell({ children, mode, tenantSlug, role }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Dumbbell className="size-6 text-primary" />
            <Link href="/" className={`${sedgwick.className} text-xl tracking-wider text-primary drop-shadow-sm`}>
              LEGIONS CLUB
            </Link>
            {mode !== "user" && tenantSlug ? (
              <span className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tenantSlug}
              </span>
            ) : null}
          </div>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border p-3">
          <DashboardNav mode={mode} role={role} />
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}