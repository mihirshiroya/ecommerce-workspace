import { useState } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Boxes,
  Layers3,
  History,
  Settings,
  PanelLeft,
  ArrowUpRight,
  LogOut,
  ChevronDown,
  Command,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "@/lib/utils";
const links = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/accounts", label: "Ecommerce accounts", icon: Store },
  { to: "/skus", label: "Global SKUs", icon: Boxes },
  { to: "/listing", label: "Bulk listing", icon: Layers3 },
  { to: "/history", label: "Listing history", icon: History },
];
export default function Shell() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const title =
    links.find((l) => location.pathname.startsWith(l.to))?.label || "Settings";
  const nav = (
    <div className="sidebar-inner">
      <Link to="/dashboard" className="brand">
        <span className="brand-mark">
          <Layers3 size={20} />
        </span>
        <span>
          listing<span className="brand-light">studio</span>
          <span className="brand-dot">.</span>
        </span>
      </Link>
      <div className="workspace-switch">
        <span className="workspace-avatar">
          {user?.firstName?.slice(0, 1) || "W"}
        </span>
        <div>
          <strong>
            {user ? `${user.firstName}’s workspace` : "Seller workspace"}
          </strong>
          <small>Personal workspace</small>
        </div>
        <ChevronDown size={14} />
      </div>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Main navigation">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) => cn("nav-item", isActive && "active")}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {item.to === "/listing" && <span className="nav-new">NEW</span>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <ShieldCheck size={19} />
          <strong>Your catalog. One place.</strong>
          <p>Keep your SKUs connected across every seller account.</p>
          <Link to="/skus" onClick={() => setOpen(false)}>
            Manage your catalog
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <Separator />
        <NavLink
          to="/settings"
          className={({ isActive }) => cn("nav-item", isActive && "active")}
          onClick={() => setOpen(false)}
        >
          <Settings size={18} />
          Settings
        </NavLink>
        <div className="sidebar-profile">
          <span className="profile-avatar">
            {user?.firstName?.slice(0, 1)}
            {user?.lastName?.slice(0, 1)}
          </span>
          <div>
            <strong>
              {user?.firstName} {user?.lastName}
            </strong>
            <small>{user?.email}</small>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Sign out"
            onClick={() => logout.mutate(false)}
            disabled={logout.isPending}
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="workspace-app">
      <aside className="desktop-sidebar">{nav}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="mobile-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace navigation</SheetTitle>
            <SheetDescription>Navigate your seller workspace.</SheetDescription>
          </SheetHeader>
          {nav}
        </SheetContent>
      </Sheet>
      <div className="workspace-main">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              size="icon-sm"
              variant="ghost"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <PanelLeft />
            </Button>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>{title}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="connected-label">
              <i />
              Neon workspace
            </span>
            <span className="topbar-shortcut">
              <Command size={12} /> Your seller command center
            </span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Built for a more connected catalog.</span>
          <span>
            Listing Studio <span className="text-primary">/</span> Workspace
          </span>
        </footer>
      </div>
    </div>
  );
}
