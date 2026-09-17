"use client";
import { useAppData } from "@/context/AppContext";
import { Job } from "@/type";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "./ui/card";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle,
  IndianRupee,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";

interface JobCardProps {
  job: Job;
}

const JobCard: React.FC<JobCardProps> = ({ job }) => {
  const { user, btnLoading, applyJob, applications } = useAppData();

  const applyJobHandler = (id: number) => {
    applyJob(id);
  };

  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (applications && job.job_id) {
      applications.forEach((item: any) => {
        if (item.job_id === job.job_id) setApplied(true);
      });
    }
  }, [applications, job.job_id]);

  return (
    <Card className="w-full max-w-[380px] bg-background border border-border/40 hover:shadow-lg transition-all duration-300 hover:border-primary/30 rounded-2xl group flex flex-col">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
              {job.title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 size={16} />
              <span>{job.company_name}</span>
            </div>
          </div>

          <Link href={`/company/${job.company_id}`} className="shrink-0">
            <div className="w-12 h-12 rounded-xl border overflow-hidden hover:scale-105 transition-transform bg-muted/20">
              <img
                src={job.company_logo}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          </Link>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-muted/40 text-muted-foreground">
              <MapPin size={14} />
              <span className="font-medium">{job.location}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <IndianRupee size={16} className="text-muted-foreground" />
            <span>{job.salary} P.A</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-4 mt-auto border-t border-border/40">
        <div className="flex w-full gap-2">
          <Link href={`/jobs/${job.job_id}`} className="flex-1">
            <Button variant={"outline"} className="w-full gap-2 group/btn rounded-xl">
              View Details{" "}
              <ArrowRight
                size={16}
                className="group-hover/btn:translate-x-1 transition-transform"
              />
            </Button>
          </Link>

          {user && user.role === "jobseeker" && (
            <>
              {applied ? (
                <div className="flex-1 flex items-center justify-center gap-2 text-emerald-600 font-medium text-sm bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2 border border-emerald-100 dark:border-emerald-900/30">
                  <CheckCircle size={15} />
                  Applied
                </div>
              ) : (
                <>
                  {job.is_active !== false && (
                    <Button
                      disabled={btnLoading}
                      onClick={() => applyJobHandler(job.job_id)}
                      className="flex-1 gap-2 rounded-xl"
                    >
                      <Briefcase size={16} />
                      Easy Apply
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {job.is_active === false && (
          <div className="w-full text-center text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2 font-medium border border-red-100 dark:border-red-900/30">
            Position Closed
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JobCard;
