import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

const Info: React.FC<AccontProps> = ({ user, isYourAccount }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editRef = useRef<HTMLButtonElement | null>(null);
  const resumeRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");

  const { updateProfilePic, updateResume, btnLoading, updateUser } =
    useAppData();

  const handleClick = () => {
    inputRef.current?.click();
  };

  const changeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      updateProfilePic(formData);
    }
  };

  const handleEditClick = () => {
    editRef.current?.click();
    setName(user.name);
    setPhoneNumber(user.phone_number);
    setBio(user.bio || "");
  };

  const updateProfileHandler = () => {
    updateUser(name, phoneNumber, bio);
  };

  const handleResumeClick = () => {
    resumeRef.current?.click();
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

  const router = useRouter();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      
      {/* Banner & Profile Header */}
      <div className="mb-14 relative">
        <div className="h-32 sm:h-40 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm relative overflow-hidden">
           <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
        </div>
        
        <div className="absolute -bottom-12 sm:-bottom-16 left-6 sm:left-10 flex items-end gap-5">
           <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-background shadow-md overflow-hidden bg-muted">
                <img src={user.profile_pic || "/user.png"} alt={user.name} className="w-full h-full object-cover" />
              </div>
              {isYourAccount && (
                 <>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={handleClick} 
                    className="absolute bottom-1 right-1 rounded-full h-8 w-8 sm:h-10 sm:w-10 shadow-md border border-border"
                  >
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
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
           
           {/* Name and Role inside banner overlay on desktop, drops below on mobile */}
           <div className="pb-2 sm:pb-4 hidden sm:block">
              <div className="flex items-center gap-3">
                 <h1 className="text-3xl font-bold text-foreground">{user.name}</h1>
                 {isYourAccount && (
                    <Button variant="ghost" size="icon" onClick={handleEditClick} className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                       <Edit size={16} />
                    </Button>
                 )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground font-medium mt-1">
                 <Briefcase size={16} />
                 <span className="capitalize">{user.role}</span>
              </div>
           </div>
        </div>
      </div>

      {/* Mobile Name & Role (visible only on small screens) */}
      <div className="sm:hidden px-2 mb-10 pt-2">
          <div className="flex items-center justify-between">
             <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
             {isYourAccount && (
                <Button variant="ghost" size="icon" onClick={handleEditClick} className="h-8 w-8 rounded-full text-muted-foreground">
                   <Edit size={16} />
                </Button>
             )}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground font-medium mt-1">
             <Briefcase size={16} />
             <span className="capitalize">{user.role}</span>
          </div>
      </div>

      {/* Main Content Sections */}
      <div className="mt-16 sm:mt-24 space-y-10 sm:space-y-12">
        
        {/* Bio section */}
        {user.role === "jobseeker" && user.bio && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-foreground">
              <UserIcon size={18} className="text-primary" />
              About
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
               {user.bio}
            </p>
          </div>
        )}

        {/* Contact Info */}
        <div>
           <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
             <Mail size={18} className="text-blue-600" />
             Contact Information
           </h2>
           <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 shrink-0">
                   <Mail size={18} />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Email</p>
                   <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                </div>
             </div>
             
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 shrink-0">
                   <Phone size={18} />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Phone</p>
                   <p className="text-sm font-medium text-foreground truncate">{user.phone_number}</p>
                </div>
             </div>
           </div>
        </div>

        {/* Resume section */}
        {user.role === "jobseeker" && user.resume && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
              <NotepadText size={18} className="text-rose-600" />
              Resume
            </h2>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
               <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 shrink-0">
                    <FileText size={18} />
                 </div>
                 <div>
                    <p className="font-semibold text-sm text-foreground">Resume Document</p>
                    <Link href={user.resume} target="_blank" className="text-xs text-primary hover:underline font-medium">
                       View PDF Document
                    </Link>
                 </div>
               </div>
               
               <Button variant="outline" size="sm" onClick={handleResumeClick} className="w-full sm:w-auto rounded-lg">
                  Update Resume
               </Button>
               <input
                  type="file"
                  ref={resumeRef}
                  className="hidden"
                  accept="application/pdf"
                  onChange={changeResume}
               />
            </div>
          </div>
        )}

        {/* Subscription section */}
        {isYourAccount && user.role === "jobseeker" && (
          <div className="pt-6 border-t border-border/40">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2 text-foreground">
              <Crown size={18} className="text-indigo-600 dark:text-indigo-400" />
              Subscription Status
            </h2>

            <div>
              {!user.subscription ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <p className="font-semibold text-foreground mb-1">
                      No Active Subscription
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Subscribe to unlock premium features and benefits.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2 shrink-0 rounded-lg shadow-sm w-full sm:w-auto"
                    onClick={() => router.push("/subscribe")}
                  >
                    <Crown size={16} />
                    Subscribe Now
                  </Button>
                </div>
              ) : new Date(user.subscription).getTime() > Date.now() ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <p className="font-semibold text-emerald-600">
                        Active Subscription
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Valid until:{" "}
                      <span className="font-medium text-foreground">
                        {new Date(user.subscription).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-sm font-semibold border border-emerald-200 dark:border-emerald-800/30">
                    <CheckCircle2 size={16} />
                    Subscribed
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={18} className="text-red-600" />
                      <p className="font-semibold text-red-600">
                        Subscription Expired
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Expired On:{" "}
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
                    variant="destructive"
                    size="sm"
                    className="gap-2 shrink-0 rounded-lg w-full sm:w-auto"
                    onClick={() => router.push("/subscribe")}
                  >
                    <RefreshCcw size={16} />
                    Renew Subscription
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dialog box for edit */}
      <Dialog>
        <DialogTrigger asChild>
          <Button ref={editRef} variant="outline" className="hidden">
            Edit Profile
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-[425px] md:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                <UserIcon size={16} className="text-muted-foreground" /> Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                className="h-11 rounded-lg"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                <Phone size={16} className="text-muted-foreground" /> Phone
              </Label>
              <Input
                id="phone"
                type="number"
                placeholder="Enter your phone number"
                className="h-11 rounded-lg"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            {user.role === "jobseeker" && (
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-sm font-medium flex items-center gap-2">
                  <FileText size={16} className="text-muted-foreground" /> Bio
                </Label>
                <Input
                  id="bio"
                  type="text"
                  placeholder="Enter a short bio about yourself"
                  className="h-11 rounded-lg"
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
              className="w-full h-11 rounded-lg font-medium"
              type="submit"
            >
              {btnLoading ? "Saving Changes..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Info;
