"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAppData } from "@/context/AppContext";
import { AccontProps } from "@/type";
import {
  AlertTriangle,
  Briefcase,
  Camera,
  CheckCircle2,
  Crown,
  Edit,
  FileText,
  Mail,
  NotepadText,
  Phone,
  RefreshCcw,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { ChangeEvent, useRef, useState } from "react";

/** Section wrapper — keeps the profile page a flow of sections, not a stack of boxes. */
const Section = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <section>
    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
      <span className="text-primary">{icon}</span>
      {title}
    </h2>
    {children}
  </section>
);

const ContactRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center gap-4">
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand-subtle-foreground">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  </div>
);

const Info: React.FC<AccontProps> = ({ user, isYourAccount }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resumeRef = useRef<HTMLInputElement | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");

  const { updateProfilePic, updateResume, btnLoading, updateUser } =
    useAppData();
  const router = useRouter();

  const changeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      updateProfilePic(formData);
    }
  };

  const openEdit = () => {
    setName(user.name);
    setPhoneNumber(user.phone_number);
    setBio(user.bio || "");
    setEditOpen(true);
  };

  const updateProfileHandler = async () => {
    await updateUser(name, phoneNumber, bio);
    setEditOpen(false);
  };

  const changeResume = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        alert("Please upload a pdf file");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      updateResume(formData);
    }
  };

  const subscriptionActive =
    user.subscription && new Date(user.subscription).getTime() > Date.now();

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Banner + avatar */}
      <div className="relative mb-4">
        <div className="h-32 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary to-[var(--chart-4)]/70 sm:h-40" />

        <div className="absolute -bottom-12 left-6 flex items-end gap-5 sm:-bottom-14 sm:left-10">
          <div className="relative">
            <div className="size-28 overflow-hidden rounded-full border-4 border-background bg-muted shadow-soft-md sm:size-32">
              <img
                src={user.profile_pic || "/user.png"}
                alt={user.name}
                className="size-full object-cover"
              />
            </div>
            {isYourAccount && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => inputRef.current?.click()}
                  className="absolute bottom-1 right-1 size-9 rounded-full border shadow-soft-md"
                  aria-label="Change profile photo"
                >
                  <Camera className="size-4" />
                </Button>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  ref={inputRef}
                  onChange={changeHandler}
                />
              </>
            )}
          </div>

          <div className="hidden pb-3 sm:block">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
              {isYourAccount && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={openEdit}
                  className="rounded-full text-muted-foreground"
                  aria-label="Edit profile"
                >
                  <Edit size={16} />
                </Button>
              )}
            </div>
            <Badge variant="brand" shape="pill" className="mt-1.5 gap-1.5 capitalize">
              <Briefcase size={12} />
              {user.role}
            </Badge>
          </div>
        </div>
      </div>

      {/* Mobile name/role */}
      <div className="mb-8 mt-16 sm:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          {isYourAccount && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={openEdit}
              className="rounded-full text-muted-foreground"
              aria-label="Edit profile"
            >
              <Edit size={16} />
            </Button>
          )}
        </div>
        <Badge variant="brand" shape="pill" className="mt-2 gap-1.5 capitalize">
          <Briefcase size={12} />
          {user.role}
        </Badge>
      </div>

      <div className="space-y-10 sm:mt-24">
        {user.role === "jobseeker" && user.bio && (
          <Section icon={<UserIcon size={18} />} title="About">
            <p className="leading-relaxed text-muted-foreground">{user.bio}</p>
          </Section>
        )}

        <Section icon={<Mail size={18} />} title="Contact information">
          <div className="grid gap-6 sm:grid-cols-2">
            <ContactRow icon={<Mail size={18} />} label="Email" value={user.email} />
            <ContactRow
              icon={<Phone size={18} />}
              label="Phone"
              value={user.phone_number || "—"}
            />
          </div>
        </Section>

        {user.role === "jobseeker" && user.resume && (
          <Section icon={<NotepadText size={18} />} title="Resume">
            <div className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand-subtle-foreground">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Resume document</p>
                  <Link
                    href={user.resume}
                    target="_blank"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View PDF
                  </Link>
                </div>
              </div>

              {isYourAccount && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resumeRef.current?.click()}
                    className="w-full sm:w-auto"
                  >
                    Update resume
                  </Button>
                  <input
                    type="file"
                    ref={resumeRef}
                    className="hidden"
                    accept="application/pdf"
                    onChange={changeResume}
                  />
                </>
              )}
            </div>
          </Section>
        )}

        {isYourAccount && user.role === "jobseeker" && (
          <Section icon={<Crown size={18} />} title="Subscription">
            {!user.subscription ? (
              <div className="flex flex-col justify-between gap-5 rounded-xl border bg-card p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="mb-1 font-semibold">No active subscription</p>
                  <p className="text-sm text-muted-foreground">
                    Subscribe to unlock premium features and benefits.
                  </p>
                </div>
                <Button
                  className="w-full shrink-0 gap-2 sm:w-auto"
                  onClick={() => router.push("/subscribe")}
                >
                  <Crown size={16} />
                  Subscribe now
                </Button>
              </div>
            ) : subscriptionActive ? (
              <div className="flex flex-col justify-between gap-5 rounded-xl border border-success/25 bg-success-subtle/40 p-5 sm:flex-row sm:items-center">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <CheckCircle2
                      size={18}
                      className="text-success-subtle-foreground"
                    />
                    <p className="font-semibold text-success-subtle-foreground">
                      Active subscription
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Valid until{" "}
                    <span className="font-medium text-foreground">
                      {new Date(user.subscription).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </p>
                </div>
                <Badge variant="success" shape="pill" size="lg" className="gap-1.5">
                  <CheckCircle2 size={14} />
                  Subscribed
                </Badge>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-5 rounded-xl border border-destructive/25 bg-destructive-subtle/40 p-5 sm:flex-row sm:items-center">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <AlertTriangle
                      size={18}
                      className="text-destructive-subtle-foreground"
                    />
                    <p className="font-semibold text-destructive-subtle-foreground">
                      Subscription expired
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Expired on{" "}
                    <span className="font-medium text-foreground">
                      {new Date(user.subscription).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </p>
                </div>
                <Button
                  className="w-full shrink-0 gap-2 sm:w-auto"
                  onClick={() => router.push("/subscribe")}
                >
                  <RefreshCcw size={16} />
                  Renew
                </Button>
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                <UserIcon size={15} className="text-muted-foreground" /> Full name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                <Phone size={15} className="text-muted-foreground" /> Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="Enter your phone number"
                className="h-11"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            {user.role === "jobseeker" && (
              <div className="space-y-2">
                <Label htmlFor="bio">
                  <FileText size={15} className="text-muted-foreground" /> Bio
                </Label>
                <Textarea
                  id="bio"
                  placeholder="A short bio about yourself"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={btnLoading}
              onClick={updateProfileHandler}
              size="lg"
              className="w-full"
            >
              {btnLoading ? "Saving changes…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Info;
