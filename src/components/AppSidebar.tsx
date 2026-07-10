import { Link, useRouterState } from "@tanstack/react-router";
import { LibraryBig, Search, UploadCloud, PanelLeftClose, PanelLeftOpen, Sparkles, Home } from "lucide-react";
import { useState } from "react";

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "Upload", url: "/upload", icon: UploadCloud },
  { title: "Library", url: "/library", icon: LibraryBig },
  { title: "Search", url: "/search", icon: Search },
];


export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-active">
          <Sparkles className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold leading-tight">
              Magenta
            </p>
            <p className="truncate text-[11px] text-sidebar-muted">Multimodal Knowledge</p>
          </div>
        )}
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-2">
        {items.map((item) => {
          const active =
            item.url === "/" ? currentPath === "/" : currentPath.startsWith(item.url);
          return (
            <Link
              key={item.title}
              to={item.url}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-active text-sidebar-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
              title={item.title}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-2 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
