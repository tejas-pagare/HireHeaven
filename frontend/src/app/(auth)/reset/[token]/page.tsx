"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth_service, useAppData } from "@/context/AppContext";
import axios from "axios";
import Link from "next/link";
import { redirect, useParams } from "next/navigation";
import React, { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Lock } from "lucide-react";
import AuthShell from "@/components/auth-shell";

const ResetPage = () => {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [btnLoading, setbtnLoading] = useState(false);
  const { isAuth } = useAppData();

  if (isAuth) return redirect("/");

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setbtnLoading(true);
    try {
      const { data } = await axios.post(
        `${auth_service}/api/auth/reset-password/${token}`,
        { password }
      );

      toast.success((data as any).message);
      setPassword("");
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setbtnLoading(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before"
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
        >
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      }
    >
      <form onSubmit={submitHandler} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
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

        <Button disabled={btnLoading} size="lg" className="w-full">
          {btnLoading ? "Updating…" : "Reset password"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default ResetPage;
