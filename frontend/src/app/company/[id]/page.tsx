"use client";
import { useParams } from "next/navigation";
import Cookies from "js-cookie";
import React, { useEffect, useRef, useState } from "react";
import { job_service, useAppData } from "@/context/AppContext";
import { Company, Job } from "@/type";
import axios from "axios";
import Loading from "@/components/loading";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Globe,
  Laptop,
  MapPin,
  ListOrdered,
  Pencil,
  Plus,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Dynamic round-name inputs for the Add Job dialog — collected client-side
 *  and submitted together with the rest of the job at creation time. */
function CreateRoundsEditor({
  rounds,
  setRounds,
}: {
  rounds: string[];
  setRounds: (rounds: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        <ListOrdered size={16} /> Interview Rounds
      </Label>
      <div className="space-y-2">
        {rounds.map((name, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="h-10"
              placeholder={`Round ${i + 1} name (e.g. Technical Screen)`}
              value={name}
              onChange={(e) => {
                const next = [...rounds];
                next[i] = e.target.value;
                setRounds(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setRounds(rounds.filter((_, idx) => idx !== i))}
            >
              <Trash2 size={16} className="text-red-500" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setRounds([...rounds, ""])}
      >
        <Plus size={14} /> Add Round
      </Button>
      <p className="text-xs opacity-60">
        Optional — define the interview stages for this job (e.g. Technical Round, HR Round). Rounds can be added or removed later too.
      </p>
    </div>
  );
}

/** Round editor for the Edit Job dialog — an existing job may already have
 *  applicants, so changes here are applied immediately via their own API
 *  calls rather than bundled into the "Update Job" submit. */
function EditRoundsEditor({ jobId, token }: { jobId: number; token?: string }) {
  const [rounds, setRounds] = useState<{ round_id: number; round_number: number; name: string }[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios
      .get(`${job_service}/api/job/${jobId}/rounds`)
      .then(({ data }) => setRounds(data))
      .catch(() => {});
  }, [jobId]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.post(
        `${job_service}/api/job/${jobId}/rounds`,
        { name: newName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRounds((prev) => [...prev, data.round]);
      setNewName("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add round");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (roundId: number) => {
    setBusy(true);
    try {
      await axios.delete(`${job_service}/api/job/${jobId}/rounds/${roundId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRounds((prev) => prev.filter((r) => r.round_id !== roundId));
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove round");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        <ListOrdered size={16} /> Interview Rounds
      </Label>
      <div className="space-y-2">
        {rounds.map((r) => (
          <div key={r.round_id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-background">
            <span className="text-sm">
              Round {r.round_number}: {r.name}
            </span>
            <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={() => handleRemove(r.round_id)}>
              <Trash2 size={16} className="text-red-500" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          className="h-10"
          placeholder="New round name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleAdd} className="gap-2 shrink-0">
          <Plus size={14} /> Add
        </Button>
      </div>
      <p className="text-xs opacity-60">Changes here take effect immediately. Rounds with scheduled interviews can't be removed.</p>
    </div>
  );
}

const CompanyPage = () => {
  const { id } = useParams();
  const token = Cookies.get("token");

  const { user, isAuth } = useAppData();
  const [loading, setLoading] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);

  async function fetchCompany() {
    try {
      setLoading(true);
      const { data } = await axios.get(`${job_service}/api/job/company/${id}`);
      setCompany(data as any);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCompany();
  }, [id]);

  const isRecruiterOwner =
    user && company && user.user_id === company.recruiter_id;

  const [isUpdatedModalOpen, setIsUpdatedModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const addModalRef = useRef<HTMLButtonElement>(null);
  const updateModalRef = useRef<HTMLButtonElement>(null);

  const [title, settitle] = useState("");
  const [description, setdescription] = useState("");
  const [role, setrole] = useState("");
  const [salary, setsalary] = useState("");
  const [location, setlocation] = useState("");
  const [openings, setopenings] = useState("");
  const [job_type, setjob_type] = useState("");
  const [work_location, setwork_location] = useState("");
  const [is_active, setis_active] = useState(true);
  const [rounds, setRounds] = useState<string[]>([]);

  const clearInput = () => {
    settitle("");
    setdescription("");
    setrole("");
    setsalary("");
    setlocation("");
    setopenings("");
    setjob_type("");
    setwork_location("");
    setis_active(true);
    setRounds([]);
  };

  const addJobHandler = async () => {
    setBtnLoading(true);
    try {
      const jobData = {
        title,
        description,
        role,
        salary: Number(salary),
        location,
        openings: Number(openings),
        job_type,
        work_location,
        company_id: id,
        rounds: rounds.map((r) => r.trim()).filter(Boolean),
      };

      await axios.post(`${job_service}/api/job`, jobData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      toast.success("New job posted successfully");
      fetchCompany();
      clearInput();
      addModalRef.current?.click();
    } catch (error: any) {
      console.log(error);
      toast.error(error.response.data.message);
    } finally {
      setBtnLoading(false);
    }
  };

  const deleteHandler = async (jobId: number) => {
    if (confirm("Are you sure you want to delete this job?")) {
      setBtnLoading(true);
      try {
        await axios.delete(`${job_service}/api/job/${jobId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        toast.success("Job has been deleted");
        fetchCompany();
      } catch (error: any) {
        toast.error(error.response.data.message);
      } finally {
        setBtnLoading(false);
      }
    }
  };

  const handleOpenUpdateModal = (job: Job) => {
    setSelectedJob(job);
    settitle(job.title);
    setdescription(job.description);
    setrole(job.role);
    setsalary(String(job.salary || ""));
    setlocation(job.location || "");
    setopenings(String(job.openings));
    setjob_type(job.job_type);
    setwork_location(job.work_location);
    setis_active(job.is_active);
    setIsUpdatedModalOpen(true);
  };

  const handleCloseUpdateModal = () => {
    setIsUpdatedModalOpen(false);
    setSelectedJob(null);
    clearInput();
  };

  const updateJobHandler = async () => {
    if (!selectedJob) return;

    setBtnLoading(true);
    try {
      const updateData = {
        title,
        description,
        role,
        salary: Number(salary),
        location,
        openings: Number(openings),
        job_type,
        work_location,
        is_active,
      };

      await axios.put(
        `${job_service}/api/job/${selectedJob.job_id}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success("Job updated successfully");
      fetchCompany();
      handleCloseUpdateModal();
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setBtnLoading(false);
    }
  };

  if (loading) return <Loading />;
  return (
    <div className="min-h-screen bg-secondary/30">
      {company && (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
          {/* Hero — a single rounded banner shape, not a box wrapping the page */}
          <div>
            <div className="h-36 md:h-44 rounded-3xl bg-gradient-to-r from-blue-700 to-blue-800" />
            <div className="px-2 md:px-6">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-14 md:-mt-16">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl border-4 border-background overflow-hidden shadow-xl bg-background shrink-0">
                  <img
                    src={company.logo}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 md:mb-4">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{company.name}</h1>
                  <p className="text-base leading-relaxed text-muted-foreground max-w-3xl">
                    {company.description}
                  </p>
                </div>
                <Link
                  href={company.website}
                  target="_blank"
                  className="md:mb-4"
                >
                  <Button className="gap-2 rounded-xl shadow-sm">
                    <Globe size={18} />
                    Visit Website
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <Dialog>
            {/* Job section — flat, no outer card chrome */}
            <div>
              <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                    <Briefcase size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">
                      Open Positions
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {company.jobs?.length || 0} active job
                      {company.jobs?.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {isRecruiterOwner && (
                  <DialogTrigger asChild>
                    <Button className="gap-2 rounded-xl shadow-sm">
                      <Plus size={18} />
                      Post New Job
                    </Button>
                  </DialogTrigger>
                )}
              </div>

              {isRecruiterOwner && (
                  <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl flex items-center gap-2">
                        Post a new Job
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="title"
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          <Briefcase size={16} /> Job Title
                        </Label>
                        <Input
                          id="title"
                          type="text"
                          placeholder="Enter Job title"
                          className="h-11"
                          value={title}
                          onChange={(e) => settitle(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="description"
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          <FileText size={16} /> Description
                        </Label>
                        <Input
                          id="description"
                          type="text"
                          placeholder="Enter Description"
                          className="h-11"
                          value={description}
                          onChange={(e) => setdescription(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="role"
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          <Building2 size={16} /> Role/Department
                        </Label>
                        <Input
                          id="role"
                          type="text"
                          placeholder="Enter Job Role"
                          className="h-11"
                          value={role}
                          onChange={(e) => setrole(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="salary"
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          <DollarSign size={16} /> Salary
                        </Label>
                        <Input
                          id="salary"
                          type="number"
                          placeholder="Enter salary"
                          className="h-11 cursor-pointer"
                          value={salary}
                          onChange={(e) => setsalary(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="openings"
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          <Users size={16} /> Openings
                        </Label>
                        <Input
                          id="openings"
                          type="number"
                          placeholder="Eg. 5"
                          className="h-11 cursor-pointer"
                          value={openings}
                          onChange={(e) => setopenings(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="location"
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          <MapPin size={16} /> Location
                        </Label>
                        <Input
                          id="location"
                          type="text"
                          placeholder="Enter location"
                          className="h-11 cursor-pointer"
                          value={location}
                          onChange={(e) => setlocation(e.target.value)}
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="job_type"
                            className="text-sm font-medium flex items-center gap-1"
                          >
                            <Clock size={16} /> Job Type
                          </Label>
                          <Select value={job_type} onValueChange={setjob_type}>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select job type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Full-time">
                                Full-time
                              </SelectItem>
                              <SelectItem value="Part-time">
                                Part-time
                              </SelectItem>
                              <SelectItem value="Contract">Contract</SelectItem>
                              <SelectItem value="Internship">
                                Internship
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="work_location"
                            className="text-sm font-medium flex items-center gap-1"
                          >
                            <Laptop size={16} /> Work Location
                          </Label>
                          <Select
                            value={work_location}
                            onValueChange={setwork_location}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select Work Location" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="On-site">On-site</SelectItem>
                              <SelectItem value="Remote">Remote</SelectItem>
                              <SelectItem value="Hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <CreateRoundsEditor rounds={rounds} setRounds={setRounds} />
                    </div>

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button ref={addModalRef} variant={"outline"}>
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button
                        disabled={btnLoading}
                        onClick={addJobHandler}
                        className="gap-2"
                      >
                        {btnLoading ? "Posting job..." : "Post Job"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
              )}

              <div>
                {company.jobs && company.jobs.length > 0 ? (
                  <div className="space-y-3">
                    {company.jobs.map((j) => (
                      <div
                        key={j.job_id}
                        className="group p-5 rounded-xl border border-border/60 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200 bg-background"
                      >
                        <div className="flex items-start gap-4 flex-wrap">
                          <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                            <Briefcase size={20} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                              <h3 className="text-lg font-semibold tracking-tight">
                                {j.title}
                              </h3>

                              <span
                                className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${j.is_active
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600"
                                  }`}
                              >
                                {j.is_active ? (
                                  <CheckCircle size={14} />
                                ) : (
                                  <XCircle size={14} />
                                )}
                                {j.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Building2 size={15} />
                                <span>{j.role}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <DollarSign size={15} />
                                <span>
                                  {j.salary
                                    ? `₹ ${j.salary.toLocaleString()}`
                                    : "Not Disclosed"}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <MapPin size={15} />
                                <span>{j.location}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Laptop size={15} />
                                <span>
                                  {j.work_location} ({j.job_type})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users size={15} />
                                <span>{j.openings} openings</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link href={`/jobs/${j.job_id}`}>
                              <Button
                                variant={"outline"}
                                size={"sm"}
                                className="gap-2 rounded-lg"
                              >
                                <Eye size={16} /> View
                              </Button>
                            </Link>

                            {isRecruiterOwner && (
                              <Button
                                onClick={() => handleOpenUpdateModal(j)}
                                variant={"outline"}
                                size={"sm"}
                                className="gap-2 rounded-lg"
                              >
                                <Pencil size={16} />
                                Edit
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="text-center py-14 border-2 border-dashed border-border/50 rounded-xl bg-muted/30">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <Briefcase size={32} className="text-muted-foreground opacity-60" />
                      </div>
                      <p className="text-base text-muted-foreground mb-2">
                        No jobs posted yet
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Dialog>

          <Dialog
            open={isUpdatedModalOpen}
            onOpenChange={setIsUpdatedModalOpen}
          >
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  Update Job
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="title"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <Briefcase size={16} /> Job Title
                  </Label>
                  <Input
                    id="title"
                    type="text"
                    placeholder="Enter Job title"
                    className="h-11"
                    value={title}
                    onChange={(e) => settitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="description"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <FileText size={16} /> Description
                  </Label>
                  <Input
                    id="description"
                    type="text"
                    placeholder="Enter Description"
                    className="h-11"
                    value={description}
                    onChange={(e) => setdescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="role"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <Building2 size={16} /> Role/Department
                  </Label>
                  <Input
                    id="role"
                    type="text"
                    placeholder="Enter Job Role"
                    className="h-11"
                    value={role}
                    onChange={(e) => setrole(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="salary"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <DollarSign size={16} /> Salary
                  </Label>
                  <Input
                    id="salary"
                    type="number"
                    placeholder="Enter salary"
                    className="h-11 cursor-pointer"
                    value={salary}
                    onChange={(e) => setsalary(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="openings"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <Users size={16} /> Openings
                  </Label>
                  <Input
                    id="openings"
                    type="number"
                    placeholder="Eg. 5"
                    className="h-11 cursor-pointer"
                    value={openings}
                    onChange={(e) => setopenings(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="location"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <MapPin size={16} /> Location
                  </Label>
                  <Input
                    id="location"
                    type="text"
                    placeholder="Enter location"
                    className="h-11 cursor-pointer"
                    value={location}
                    onChange={(e) => setlocation(e.target.value)}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="job_type"
                      className="text-sm font-medium flex items-center gap-1"
                    >
                      <Clock size={16} /> Job Type
                    </Label>
                    <Select value={job_type} onValueChange={setjob_type}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select job type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full-time">Full-time</SelectItem>
                        <SelectItem value="Part-time">Part-time</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                        <SelectItem value="Internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="work_location"
                      className="text-sm font-medium flex items-center gap-1"
                    >
                      <Laptop size={16} /> Work Location
                    </Label>
                    <Select
                      value={work_location}
                      onValueChange={setwork_location}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select Work Location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="On-site">On-site</SelectItem>
                        <SelectItem value="Remote">Remote</SelectItem>
                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="update-is_active"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      {is_active ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <XCircle size={16} className="text-gray-50" />
                      )}
                    </Label>

                    <Select
                      value={is_active ? "true" : "false"}
                      onValueChange={(value) => setis_active(value === "true")}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedJob && <EditRoundsEditor jobId={selectedJob.job_id} token={token} />}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button ref={addModalRef} variant={"outline"}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  disabled={btnLoading}
                  onClick={updateJobHandler}
                  className="gap-2"
                >
                  {btnLoading ? "Updating job..." : "Update Job"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};

export default CompanyPage;
