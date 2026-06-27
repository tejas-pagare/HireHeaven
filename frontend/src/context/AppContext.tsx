"use client";

import { AppContextType, Application, AppProviderProps, User } from "@/type";
import React, { createContext, useContext, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import Cookies from "js-cookie";
import axios from "axios";

// ── Unified Backend URL ────────────────────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// Re-exported for backward-compat — all point to the same unified backend
export const utils_service = BACKEND_URL;
export const auth_service = BACKEND_URL;
export const user_service = BACKEND_URL;
export const job_service = BACKEND_URL;
export const payment_service = BACKEND_URL;

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);

  const token = Cookies.get("token");

  async function fetchUser() {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/user/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUser(data);
      setIsAuth(true);
    } catch (error) {
      console.log(error);
      setIsAuth(false);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfilePic(fromData: any) {
    setLoading(true);
    try {
      const { data } = await axios.put(
        `${BACKEND_URL}/api/user/update-pic`,
        fromData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(data.message);
      fetchUser();
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateResume(fromData: any) {
    setLoading(true);
    try {
      const { data } = await axios.put(
        `${BACKEND_URL}/api/user/update-resume`,
        fromData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(data.message);
      fetchUser();
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(name: string, phoneNumber: string, bio: string) {
    setBtnLoading(true);
    try {
      const { data } = await axios.put(
        `${BACKEND_URL}/api/user/update`,
        { name, phoneNumber, bio },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success(data.message);
      fetchUser();
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setBtnLoading(false);
    }
  }

  async function logoutUser() {
    Cookies.set("token", "");
    setUser(null);
    setIsAuth(false);
    toast.success("Logged out successfully");
  }

  async function addSkill(
    skill: string,
    setSkill: React.Dispatch<React.SetStateAction<string>>
  ) {
    setBtnLoading(true);
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/user/skill`,
        { skillName: skill },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success(data.message);
      setSkill("");
      fetchUser();
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setBtnLoading(false);
    }
  }

  async function removeSkill(skill: string) {
    try {
      const { data } = await axios.delete(`${BACKEND_URL}/api/user/skill`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { skillName: skill },
      });
      toast.success(data.message);
      fetchUser();
    } catch (error: any) {
      toast.error(error.response.data.message);
    }
  }

  async function applyJob(job_id: number) {
    setBtnLoading(true);
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/user/apply`,
        { job_id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(data.message);
      fetchApplications();
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setBtnLoading(false);
    }
  }

  const [applications, setApplications] = useState<Application[]>([]);

  async function fetchApplications() {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/user/applications/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setApplications(data);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    fetchUser();
    fetchApplications();
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        btnLoading,
        setUser,
        isAuth,
        setIsAuth,
        setLoading,
        logoutUser,
        updateProfilePic,
        updateResume,
        updateUser,
        addSkill,
        removeSkill,
        applyJob,
        applications,
        fetchApplications,
      }}
    >
      {children}
      <Toaster />
    </AppContext.Provider>
  );
};

export const useAppData = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppData must be used within AppProvider");
  }
  return context;
};
