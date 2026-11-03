"use client";

// The packaged sidebar's provider, with THIS app's host (components/ui/sidebarHost.ts) registered
// before anything renders.
import "@/components/ui/sidebarHost";

export { SidebarProvider, useSidebar } from "@minty/shared/sidebar";
