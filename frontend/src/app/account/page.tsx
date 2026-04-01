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
  ChevronLeft,
  ChevronRight,
  Users,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const sidebarItems: SidebarItem[] = [
  {
    id: "profile",
    label: "Profile",
    icon: <User size={20} />,
    roles: ["recruiter", "jobseeker"],
  },
  {
    id: "companies",
    label: "Companies",
    icon: <Building2 size={20} />,
    roles: ["recruiter"],
  },
  {
    id: "blogs",
    label: "My Blogs",
    icon: <FileText size={20} />,
    roles: ["recruiter"],
  },
  {
    id: "jobs",
    label: "My Jobs",
    icon: <Briefcase size={20} />,
    roles: ["recruiter"],
  },
  {
    id: "applicants",
    label: "Applicants",
    icon: <Users size={20} />,
    roles: ["recruiter"],
  },
  {
    id: "skills",
    label: "Skills",
    icon: <Award size={20} />,
    roles: ["jobseeker"],
  },
  {
    id: "applied-jobs",
    label: "Applied Jobs",
    icon: <Briefcase size={20} />,
    roles: ["jobseeker"],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <BarChart3 size={20} />,
    roles: ["jobseeker"],
  },
  {
    id: "chats",
    label: "Chats",
    icon: <MessageSquare size={20} />,
    roles: ["recruiter", "jobseeker"],
  },
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
      case "chats":
        // Redirect to chat page
        router.push("/chat");
        return null;
      default:
        return <Info user={user} isYourAccount={true} />;
    }
  };

  return (
    <>
      {user && (
        <div className="flex min-h-[calc(100vh-64px)]">
          {/* Sidebar */}
          <aside
            className={`sticky top-16 h-[calc(100vh-64px)] border-r bg-background/95 backdrop-blur-sm transition-all duration-300 flex flex-col ${sidebarCollapsed ? "w-[72px]" : "w-64"
              }`}
          >
            {/* User mini card */}
            <div className={`p-4 border-b ${sidebarCollapsed ? "px-3" : ""}`}>
              <div className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
                <div className="h-10 w-10 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900 shrink-0 ring-2 ring-blue-500/20">
                  <img
                    src={user.profile_pic ? (user.profile_pic as string) : "/user.png"}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 p-3 space-y-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${sidebarCollapsed ? "justify-center" : ""
                    } ${activeTab === item.id
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className={`shrink-0 ${activeTab === item.id ? "text-blue-600 dark:text-blue-400" : ""}`}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              ))}
            </nav>

            {/* Collapse toggle */}
            <div className="p-3 border-t">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <ChevronRight size={18} />
                ) : (
                  <>
                    <ChevronLeft size={18} />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 bg-muted/30">
            {/* Header bar */}
            <div className="sticky top-16 z-10 bg-background/80 backdrop-blur-md border-b px-6 py-4">
              <h1 className="text-xl font-semibold capitalize">
                {filteredItems.find((i) => i.id === activeTab)?.label || "Dashboard"}
              </h1>
            </div>

            {/* Content area */}
            <div className="p-6">
              {renderContent()}
            </div>
          </main>
        </div>
      )}
    </>
  );
};

export default AccountPage;
