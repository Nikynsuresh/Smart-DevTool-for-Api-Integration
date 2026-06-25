"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  Terminal, 
  MessageSquare, 
  Compass, 
  History, 
  Cpu, 
  ChevronRight,
  Code2
} from "lucide-react";
import { listIntegrations, Integration } from "@/lib/api";

export function Sidebar() {
  const pathname = usePathname();
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    async function loadRecent() {
      try {
        const data = await listIntegrations();
        setIntegrations(data.slice(0, 5)); // Get top 5 recent integrations
      } catch (err) {
        console.error("Failed to load integrations in sidebar:", err);
      }
    }
    loadRecent();
    
    // Refresh sidebar list every 10 seconds if integrations are running
    const interval = setInterval(loadRecent, 10000);
    return () => clearInterval(interval);
  }, [pathname]);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "New Integration", href: "/analyze", icon: Cpu },
  ];

  // Helper to extract active id from paths like /code/[id], /chat/[id] or /explorer/[id]
  const pathParts = pathname.split("/");
  const activeId = (pathParts[1] === "code" || pathParts[1] === "chat" || pathParts[1] === "explorer") ? pathParts[2] : null;

  return (
    <aside className="w-64 bg-[#0a0b10] border-r border-[#1f202c] text-slate-300 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Brand Logo */}
      <div className="p-6 border-b border-[#1f202c]">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all">
            <Terminal className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-white tracking-tight text-base block group-hover:text-indigo-400 transition-colors">
              Smart DevTool
            </span>
            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider block">
              API Integrator
            </span>
          </div>
        </Link>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 py-6 px-4 overflow-y-auto space-y-7">
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
            Workspace
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-indigo-500/5"
                    : "hover:bg-[#13141f] hover:text-white border border-transparent"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Current Integration Options */}
        {activeId && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-left-4 duration-300">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
              Current API ({activeId})
            </p>
            <Link
              href={`/code/${activeId}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname.startsWith("/code")
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-indigo-500/5"
                  : "hover:bg-[#13141f] hover:text-white border border-transparent"
              }`}
            >
              <Code2 className="h-4.5 w-4.5 text-slate-400" />
              Generated Code
            </Link>
            <Link
              href={`/explorer/${activeId}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname.startsWith("/explorer")
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-indigo-500/5"
                  : "hover:bg-[#13141f] hover:text-white border border-transparent"
              }`}
            >
              <Compass className="h-4.5 w-4.5 text-slate-400" />
              API Endpoint Explorer
            </Link>
            <Link
              href={`/chat/${activeId}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname.startsWith("/chat")
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-indigo-500/5"
                  : "hover:bg-[#13141f] hover:text-white border border-transparent"
              }`}
            >
              <MessageSquare className="h-4.5 w-4.5 text-slate-400" />
              Chat Assistant
            </Link>
          </div>
        )}

        {/* Recent Crawls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <History className="h-3 w-3" />
              Recents
            </p>
          </div>
          {integrations.length === 0 ? (
            <div className="text-[12px] text-slate-500 italic px-3 py-2">
              No recent integrations
            </div>
          ) : (
            <div className="space-y-1">
              {integrations.map((integration) => {
                const parsedUrl = new URL(integration.url);
                const hostName = parsedUrl.hostname;
                const isSelected = activeId === String(integration.id);
                return (
                  <Link
                    key={integration.id}
                    href={`/code/${integration.id}`}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-[#181926] text-white border-l-2 border-indigo-500"
                        : "hover:bg-[#13141f] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="truncate max-w-[130px]">{hostName}</span>
                    <span className={`h-2 w-2 rounded-full shrink-0 ${
                      integration.status === "completed" 
                        ? "bg-emerald-500 shadow-sm shadow-emerald-500/30" 
                        : integration.status === "failed" 
                        ? "bg-rose-500 shadow-sm shadow-rose-500/30" 
                        : "bg-amber-500 animate-pulse shadow-sm shadow-amber-500/30"
                    }`} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-[#1f202c] bg-[#07080b] flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-[#1b1c2b] flex items-center justify-center border border-[#2b2c3d]">
          <span className="text-[11px] font-bold text-indigo-400">DEV</span>
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-slate-200 truncate">Sandbox User</p>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Backend Connected
          </span>
        </div>
      </div>
    </aside>
  );
}
