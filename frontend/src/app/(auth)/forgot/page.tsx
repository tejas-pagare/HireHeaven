"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth_service, useAppData } from "@/context/AppContext";
import axios from "axios";
import Link from "next/link";
import { redirect } from "next/navigation";
import React, { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Mail } from "lucide-react";
import AuthShell from "@/components/auth-shell";

const ForgotPage = () => {
  const [email, setemail] = useState("");
  const [btnLoading, setbtnLoading] = useState(false);
  const { isAuth } = useAppData();

  if (isAuth) return redirect("/");

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setbtnLoading(true);
    try {
      const { data } = await axios.post(
        `${auth_service}/api/auth/forgot-password`,
        { email }
      );

      toast.success((data as any).message);
      setemail("");
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setbtnLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link"
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
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="icon-style" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setemail(e.target.value)}
              required
              autoComplete="email"
              className="h-11 pl-10"
            />
          </div>
        </div>

        <Button disabled={btnLoading} size="lg" className="w-full">
          {btnLoading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default ForgotPage;
