"use client";
import { Job } from "@/type";
import React, { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import { job_service } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import JobCard from "@/components/job-card";

const ALL = "__all__";

const locations: string[] = [
  "Delhi",
  "Mumbai",
  "Banglore",
  "Hyderabad",
  "Pune",
  "Kolkata",
  "Chennai",
  "Remote",
];

const JobCardSkeleton = () => (
  <Card className="h-[19rem] animate-pulse gap-4 p-6">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 space-y-2">
        <div className="h-5 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>
      <div className="size-12 shrink-0 rounded-xl bg-muted" />
    </div>
    <div className="h-6 w-28 rounded-full bg-muted" />
    <div className="h-5 w-32 rounded bg-muted" />
    <div className="mt-auto flex gap-2 border-t pt-4">
      <div className="h-10 flex-1 rounded-lg bg-muted" />
      <div className="h-10 flex-1 rounded-lg bg-muted" />
    </div>
  </Card>
);

const JobsPage = () => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  // `search` is what the user types; `title` is the debounced value we query with.
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");

  const token = Cookies.get("token");

  // Debounce keystrokes so we aren't firing a request per character.
  useEffect(() => {
    const id = setTimeout(() => setTitle(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function fetchJobs() {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${job_service}/api/job?title=${title}&location=${location}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!cancelled) setJobs(data as Job[]);
      } catch (error) {
        console.log(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchJobs();
    return () => {
      cancelled = true;
    };
  }, [title, location, token]);

  const hasActiveFilters = useMemo(
    () => Boolean(title || location),
    [title, location]
  );

  const clearFilters = () => {
    setSearch("");
    setTitle("");
    setLocation("");
  };

  return (
    <div className="hh-page">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <Badge variant="brand" shape="pill" className="mb-3 gap-1.5">
            <Briefcase size={13} />
            Open roles
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Explore opportunities
          </h1>
          <p className="mt-2 text-muted-foreground">
            {loading
              ? "Finding roles for you…"
              : `${jobs.length} ${jobs.length === 1 ? "role" : "roles"} available`}
          </p>
        </header>

        {/* Filter bar */}
        <Card variant="elevated" className="mb-8 gap-0 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="icon-style" />
              <Input
                type="text"
                placeholder="Search by job title or role…"
                className="h-11 pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search jobs by title"
              />
            </div>

            <Select
              value={location || ALL}
              onValueChange={(v) => setLocation(v === ALL ? "" : v)}
            >
              <SelectTrigger
                className="h-11 w-full md:w-56"
                aria-label="Filter by location"
              >
                <span className="flex items-center gap-2 truncate">
                  <MapPin size={15} className="shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="All locations" />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem value={loc} key={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                className="h-11 gap-2 md:w-auto"
                onClick={clearFilters}
              >
                <X size={16} /> Clear
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <SlidersHorizontal size={14} /> Filters:
              </span>
              {title && (
                <Badge variant="brand" shape="pill" className="gap-1.5 pr-1">
                  <Search size={12} />
                  {title}
                  <button
                    onClick={() => setSearch("")}
                    className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                    aria-label="Clear title filter"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}
              {location && (
                <Badge variant="brand" shape="pill" className="gap-1.5 pr-1">
                  <MapPin size={12} />
                  {location}
                  <button
                    onClick={() => setLocation("")}
                    className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                    aria-label="Clear location filter"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </Card>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <JobCardSkeleton key={i} />
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard job={job} key={job.job_id} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-5 inline-flex size-20 items-center justify-center rounded-2xl bg-muted">
              <Briefcase size={34} className="text-muted-foreground" />
            </div>
            <h3 className="mb-1.5 text-xl font-semibold">No jobs found</h3>
            <p className="mb-6 max-w-sm text-muted-foreground">
              {hasActiveFilters
                ? "Try widening your search — fewer filters usually surface more roles."
                : "There are no open roles right now. Check back soon."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="gap-2">
                <X size={16} /> Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsPage;
