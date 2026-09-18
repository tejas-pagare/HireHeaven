"use client";
import { useAppData } from "@/context/AppContext";
import { Job } from "@/type";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
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

  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (applications && job.job_id) {
      setApplied(
        applications.some((item: any) => item.job_id === job.job_id)
      );
    }
  }, [applications, job.job_id]);

  const isClosed = job.is_active === false;

  return (
    <Card
      interactive
      className="group flex h-full w-full flex-col gap-0 overflow-hidden py-0"
    >
      <CardHeader className="flex flex-col gap-0 space-y-4 p-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="mb-1.5 line-clamp-2 text-lg font-bold transition-colors group-hover:text-primary">
              {job.title}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 size={15} className="shrink-0" />
              <span className="truncate">{job.company_name}</span>
            </div>
          </div>

          <Link
            href={`/company/${job.company_id}`}
            className="shrink-0"
            aria-label={`View ${job.company_name}`}
          >
            <div className="size-12 overflow-hidden rounded-xl border bg-muted/40 transition-transform hover:scale-105">
              <img
                src={job.company_logo}
                alt=""
                className="size-full object-cover"
              />
            </div>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="muted" shape="pill" className="gap-1.5 font-medium">
            <MapPin size={13} />
            {job.location}
          </Badge>
          {isClosed && (
            <Badge variant="destructive" shape="pill">
              Closed
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 text-base font-semibold">
          <IndianRupee size={16} className="text-muted-foreground" />
          <span>{job.salary}</span>
          <span className="text-sm font-normal text-muted-foreground">P.A</span>
        </div>
      </CardHeader>

      <CardContent className="mt-auto flex flex-col gap-3 border-t p-6 pt-4">
        <div className="flex w-full gap-2">
          <Link href={`/jobs/${job.job_id}`} className="flex-1">
            <Button variant="outline" className="group/btn w-full gap-2">
              View Details
              <ArrowRight
                size={16}
                className="transition-transform group-hover/btn:translate-x-0.5"
              />
            </Button>
          </Link>

          {user?.role === "jobseeker" &&
            (applied ? (
              <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-success-subtle px-3 py-2 text-sm font-semibold text-success-subtle-foreground">
                <CheckCircle2 size={15} />
                Applied
              </div>
            ) : (
              !isClosed && (
                <Button
                  disabled={btnLoading}
                  onClick={() => applyJob(job.job_id)}
                  className="flex-1 gap-2"
                >
                  <Briefcase size={16} />
                  Easy Apply
                </Button>
              )
            ))}
        </div>

        {isClosed && (
          <p className="w-full rounded-lg bg-destructive-subtle px-3 py-2 text-center text-sm font-medium text-destructive-subtle-foreground">
            This position is no longer accepting applications
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default JobCard;
