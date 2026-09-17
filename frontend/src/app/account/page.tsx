"use client";
import Loading from "@/components/loading";
import { useAppData } from "@/context/AppContext";
import React, { useEffect, useState } from "react";
import Info from "./components/info";
import Skills from "./components/skills";
import Company from "./components/company";
import { useRouter } from "next/navigation";
import AppliedJobs from "./components/appliedJobs";
import MyBlogs from "./components/MyBlogs";
import Applicants from "./components/Applicants";
import MyJobs from "./components/MyJobs";
import Analytics from "./components/analytics";
import {
  User,
  Building2,
  FileText,
  Briefcase,
  MessageSquare,
  Award,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  BarChart3,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const sidebarItems: SidebarItem[] = [
  { id: "profile", label: "Profile", icon: <User size={18} />, roles: ["recruiter", "jobseeker"] },
  { id: "companies", label: "Companies", icon: <Building2 size={18} />, roles: ["recruiter"] },
  { id: "blogs", label: "My Blogs", icon: <FileText size={18} />, roles: ["recruiter"] },
  { id: "jobs", label: "My Jobs", icon: <Briefcase size={18} />, roles: ["recruiter"] },
  { id: "applicants", label: "Applicants", icon: <Users size={18} />, roles: ["recruiter"] },
  { id: "skills", label: "Skills", icon: <Award size={18} />, roles: ["jobseeker"] },
  { id: "applied-jobs", label: "Applied Jobs", icon: <Briefcase size={18} />, roles: ["jobseeker"] },
  { id: "analytics", label: "Analytics", icon: <BarChart3 size={18} />, roles: ["jobseeker"] },
  { id: "chats", label: "Chats", icon: <MessageSquare size={18} />, roles: ["recruiter", "jobseeker"] },
];

const AccountPage = () => {
  const { isAuth, user, loading, applications } = useAppData();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isAuth && !loading) {
      router.push("/login");
    }
  }, [isAuth, router, loading]);

  if (loading) return <Loading />;

  const filteredItems = sidebarItems.filter((item) =>
    item.roles.includes(user?.role || "")
  );

  const activeItem = filteredItems.find((i) => i.id === activeTab);

  const selectTab = (id: string) => {
    if (id === "chats") router.push("/chat");
    else setActiveTab(id);
  };

  const renderContent = () => {
    if (!user) return null;

    switch (activeTab) {
      case "profile":
        return <Info user={user} isYourAccount={true} />;
      case "companies":
        return <Company />;
      case "blogs":
        return <MyBlogs />;
      case "jobs":
        return <MyJobs onViewApplicants={() => setActiveTab("applicants")} />;
      case "applicants":
        return <Applicants />;
      case "skills":
        return <Skills user={user} isYourAccount={true} />;
      case "applied-jobs":
        return <AppliedJobs applications={applications} />;
      case "analytics":
        return <Analytics />;
      default:
        return <Info user={user} isYourAccount={true} />;
    }
  };

  if (!user) return null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-muted/30">
      {/* ── Sidebar (desktop) ── */}
      <aside
        className={cn(
          "sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col border-r bg-sidebar transition-[width] duration-300 md:flex",
          sidebarCollapsed ? "w-[76px]" : "w-64"
        )}
      >
        {/* User card */}
        <div className="border-b p-4">
          <div
            className={cn(
              "flex items-center gap-3",
              sidebarCollapsed && "justify-center"
            )}
          >
            <Avatar className="size-10 shrink-0 ring-2 ring-primary/20">
              <AvatarImage
                src={(user.profile_pic as string) || "/user.png"}
                alt={user.name}
              />
              <AvatarFallback className="bg-brand-subtle font-semibold text-brand-subtle-foreground">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {user.name}
                </p>
                <p className="text-xs capitalize text-muted-foreground">
                  {user.role}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {filteredItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  sidebarCollapsed && "justify-center px-0",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <span className="shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse */}
        <div className="border-t p-3">
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <>
                <PanelLeftClose size={18} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="min-w-0 flex-1">
        {/* Mobile tab strip — the sidebar has no place on small screens */}
        <div className="sticky top-16 z-30 border-b bg-background/85 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar className="size-9 shrink-0 ring-2 ring-primary/20">
              <AvatarImage
                src={(user.profile_pic as string) || "/user.png"}
                alt={user.name}
              />
              <AvatarFallback className="bg-brand-subtle text-sm font-semibold text-brand-subtle-foreground">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {user.role}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filteredItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => selectTab(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section header */}
        <div className="border-b bg-background px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-subtle text-brand-subtle-foreground">
              {activeItem?.icon}
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {activeItem?.label ?? "Profile"}
              </h1>
              <Badge variant="muted" size="sm" shape="pill" className="mt-1 capitalize">
                {user.role} account
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">{renderContent()}</div>
      </main>
    </div>
  );
};

export default AccountPage;
