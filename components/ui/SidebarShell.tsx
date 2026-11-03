"use client";

import { ProfilePanel, SubscriptionsOverviewCard } from "@minty/shared/profile";
import type { ReactNode } from "react";

import { useToast } from "@/components/Toast";
import { SidebarProvider } from "@/components/ui/Sidebar";
import { loadSubscriptions, profileApi } from "@/lib/profileApi";

/**
 * The shared sidebar around the wizard, in the classic look every `development` branch draws (the
 * owner, 2026-10-20). My Profile is its second view - the shared panel over the page, never a page
 * of its own (owner, 2026-11-03) - reading through minty-onboarding-api (lib/profileApi.ts).
 */
export function SidebarShell({ children }: { children: ReactNode }) {
  const toast = useToast();
  const profile = (
    <ProfilePanel
      api={profileApi}
      notify={(message, kind) => toast.show(message, kind)}
      subscriptions={<SubscriptionsOverviewCard load={loadSubscriptions} />}
    />
  );
  return (
    <SidebarProvider look="classic" profile={profile}>
      {children}
    </SidebarProvider>
  );
}
