"use client";
import { auth_service, useAppData } from "@/context/AppContext";
import axios from "axios";
import { redirect } from "next/navigation";
import React, { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Briefcase,
  FileText,
  Lock,
  Mail,
  Phone,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Loading from "@/components/loading";
import AuthShell from "@/components/auth-shell";
import { cn } from "@/lib/utils";

const roles = [
  {
    value: "jobseeker",
    label: "Find a job",
    description: "Browse roles and apply",
    icon: <Search size={20} />,
  },
  {
    value: "recruiter",
    label: "Hire talent",
    description: "Post roles and review applicants",
    icon: <Briefcase size={20} />,
  },
] as const;

const RegisterPage = () => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [btnLoading, setBtnLoading] = useState(false);

  const { isAuth, setUser, loading, setIsAuth } = useAppData();

  if (loading) return <Loading />;

  if (isAuth) return redirect("/");

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setBtnLoading(true);
    const formData = new FormData();

    formData.append("role", role);
    formData.append("name", name);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("phoneNumber", phoneNumber);

    if (role === "jobseeker") {
      formData.append("bio", bio);
      if (resume) {
        formData.append("file", resume);
      }
    }
    try {
      const { data } = await axios.post(
        `${auth_service}/api/auth/register`,
        formData
      );

      toast.success((data as any).message);

      Cookies.set("token", (data as any).token, {
        expires: 15,
        secure: false,
        path: "/",
      });
      setUser((data as any).registeredUser);
      setIsAuth(true);
    } catch (error: any) {
      console.log(error);
      toast.error(error.response.data.message);
      setIsAuth(false);
    } finally {
      setBtnLoading(false);
    }
  };

  return (
    <AuthShell
      wide
      title="Join HireHeaven"
      subtitle="Create your account to start a new journey"
      footer={
        <>
          <span className="text-muted-foreground">
            Already have an account?{" "}
          </span>
          <Link
            href="/login"
            className="font-semibold text-primary hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submitHandler} className="space-y-6">
        {/* Role picker — cards read better than a bare <select> here */}
        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm font-medium">I want to</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {roles.map((option) => {
              const selected = role === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setRole(option.value)}
                  aria-pressed={selected}
                  aria-label={`${option.label} — ${option.description}`}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    selected
                      ? "border-primary bg-brand-subtle shadow-soft"
                      : "border-border hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {option.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {role && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5 border-t pt-6 duration-300">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="icon-style" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="icon-style" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="icon-style" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <div className="relative">
                <Phone className="icon-style" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  autoComplete="tel"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            {role === "jobseeker" && (
              <div className="space-y-5 border-t pt-5">
                <div className="space-y-2">
                  <Label htmlFor="resume">
                    <FileText size={15} className="text-muted-foreground" />
                    Resume (PDF)
                  </Label>
                  <Input
                    id="resume"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setResume(e.target.files[0]);
                      }
                    }}
                    className="h-11 cursor-pointer py-2.5 file:mr-3 file:rounded-md file:bg-brand-subtle file:px-3 file:py-1 file:font-semibold file:text-brand-subtle-foreground"
                  />
                  {resume && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {resume.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself — your experience, what you're looking for…"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    required
                    rows={3}
                  />
                </div>
              </div>
            )}

            <Button disabled={btnLoading} size="lg" className="w-full">
              {btnLoading ? "Creating account…" : "Create account"}
              <ArrowRight size={18} />
            </Button>
          </div>
        )}
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
