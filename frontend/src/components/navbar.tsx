"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  BookOpen,
  Briefcase,
  Home,
  Info,
  LogOut,
  Menu,
  MessageSquare,
  PenTool,
  User,
  X,
  LayoutDashboard,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ModeToggle } from "./mode-toggle";
import { useAppData } from "@/context/AppContext";
import { useSocket } from "@/context/SocketContext";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** undefined = always visible */
  requiresAuth?: boolean;
  role?: "jobseeker" | "recruiter";
};

const primaryLinks: NavLink[] = [
  { href: "/jobs", label: "Jobs", icon: <Briefcase size={16} /> },
  { href: "/blog", label: "Blog", icon: <BookOpen size={16} /> },
  { href: "/about", label: "About", icon: <Info size={16} /> },
];

const UnreadDot = ({ count }: { count: number }) =>
  count > 0 ? (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
      {count > 9 ? "9+" : count}
    </span>
  ) : null;

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const { isAuth, user, loading, logoutUser } = useAppData();
  const { unreadCount } = useSocket();

  const toggleMenu = () => setIsOpen((v) => !v);
  const closeMenu = () => setIsOpen(false);

  const visibleLinks = primaryLinks.filter((link) => {
    if (link.requiresAuth && !isAuth) return false;
    if (link.role && user?.role !== link.role) return false;
    return true;
  });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-brand">
              <Briefcase size={18} />
            </span>
            <span className="hh-wordmark text-xl font-extrabold tracking-tight">
              HireHeaven
            </span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-1 md:flex">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side actions */}
          <div className="hidden items-center gap-2 md:flex">
            {loading ? null : isAuth ? (
              <>
                <Link href="/chat" aria-label="Chat">
                  <Button variant="ghost" size="icon" className="relative">
                    <MessageSquare size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
                    )}
                  </Button>
                </Link>

                <Link href="/account">
                  <Button size="sm" className="gap-2">
                    <LayoutDashboard size={15} /> Dashboard
                  </Button>
                </Link>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="rounded-full transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      aria-label="Account menu"
                    >
                      <Avatar className="size-9 cursor-pointer ring-2 ring-primary/20 ring-offset-2 ring-offset-background transition-all hover:ring-primary/50">
                        <AvatarImage
                          src={user ? (user.profile_pic as string) : ""}
                          alt={user ? user.name : ""}
                        />
                        <AvatarFallback className="bg-brand-subtle font-semibold text-brand-subtle-foreground">
                          {user?.name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </PopoverTrigger>

                  <PopoverContent className="w-60 p-1.5" align="end">
                    <div className="mb-1 border-b px-3 py-2.5">
                      <p className="truncate text-sm font-semibold">
                        {user?.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user?.email}
                      </p>
                      {user?.role && (
                        <Badge
                          variant="brand"
                          size="sm"
                          shape="pill"
                          className="mt-2 capitalize"
                        >
                          {user.role}
                        </Badge>
                      )}
                    </div>

                    <Link href="/">
                      <Button
                        className="w-full justify-start gap-2.5"
                        variant="ghost"
                        size="sm"
                      >
                        <Home size={15} /> Home
                      </Button>
                    </Link>

                    <Link href="/account">
                      <Button
                        className="w-full justify-start gap-2.5"
                        variant="ghost"
                        size="sm"
                      >
                        <User size={15} /> My Profile
                      </Button>
                    </Link>

                    <Link href="/chat">
                      <Button
                        className="w-full justify-start gap-2.5"
                        variant="ghost"
                        size="sm"
                      >
                        <MessageSquare size={15} /> Chat
                        <UnreadDot count={unreadCount} />
                      </Button>
                    </Link>

                    {user?.role === "recruiter" && (
                      <Link href="/recruiter/blog/create">
                        <Button
                          className="w-full justify-start gap-2.5"
                          variant="ghost"
                          size="sm"
                        >
                          <PenTool size={15} /> Post Blog
                        </Button>
                      </Link>
                    )}

                    <div className="my-1 border-t" />

                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-sm text-muted-foreground">
                        Theme
                      </span>
                      <ModeToggle />
                    </div>

                    <Button
                      className="w-full justify-start gap-2.5 text-destructive hover:bg-destructive-subtle hover:text-destructive"
                      variant="ghost"
                      size="sm"
                      onClick={logoutUser}
                    >
                      <LogOut size={15} /> Logout
                    </Button>
                  </PopoverContent>
                </Popover>
              </>
            ) : (
              <>
                <ModeToggle />
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            <ModeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMenu}
              aria-label="Toggle menu"
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "overflow-hidden border-t transition-[max-height,opacity] duration-300 ease-in-out md:hidden",
          isOpen ? "max-h-[32rem] opacity-100" : "max-h-0 border-t-0 opacity-0"
        )}
      >
        <div className="space-y-1 bg-background/95 px-3 py-3 backdrop-blur-md">
          <Link href="/" onClick={closeMenu}>
            <Button
              variant={isActive("/") ? "subtle" : "ghost"}
              className="h-11 w-full justify-start gap-3"
            >
              <Home size={18} /> Home
            </Button>
          </Link>

          {visibleLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={closeMenu}>
              <Button
                variant={isActive(link.href) ? "subtle" : "ghost"}
                className="h-11 w-full justify-start gap-3"
              >
                {link.icon} {link.label}
              </Button>
            </Link>
          ))}

          {isAuth && (
            <Link href="/chat" onClick={closeMenu}>
              <Button
                variant={isActive("/chat") ? "subtle" : "ghost"}
                className="h-11 w-full justify-start gap-3"
              >
                <MessageSquare size={18} /> Chat
                <UnreadDot count={unreadCount} />
              </Button>
            </Link>
          )}

          {isAuth && user?.role === "recruiter" && (
            <Link href="/recruiter/blog/create" onClick={closeMenu}>
              <Button
                variant="ghost"
                className="h-11 w-full justify-start gap-3"
              >
                <PenTool size={18} /> Post Blog
              </Button>
            </Link>
          )}

          <div className="!mt-3 space-y-1 border-t pt-3">
            {isAuth ? (
              <>
                <Link href="/account" onClick={closeMenu}>
                  <Button
                    variant="ghost"
                    className="h-11 w-full justify-start gap-3"
                  >
                    <User size={18} /> My Profile
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="h-11 w-full justify-start gap-3 text-destructive hover:bg-destructive-subtle hover:text-destructive"
                  onClick={() => {
                    logoutUser();
                    closeMenu();
                  }}
                >
                  <LogOut size={18} /> Logout
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" onClick={closeMenu} className="flex-1">
                  <Button variant="outline" className="h-11 w-full">
                    Sign in
                  </Button>
                </Link>
                <Link href="/register" onClick={closeMenu} className="flex-1">
                  <Button className="h-11 w-full">Get started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
