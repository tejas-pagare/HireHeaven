import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";
import { ArrowRight, Handshake, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const values = [
  {
    icon: <Target size={22} />,
    title: "Meaningful matches",
    body: "We connect people to roles that fit their skills and ambition — not just whatever is open.",
  },
  {
    icon: <Sparkles size={22} />,
    title: "AI that helps",
    body: "Resume intelligence, ATS scoring and practice interviews, so you walk in prepared.",
  },
  {
    icon: <Handshake size={22} />,
    title: "Built for both sides",
    body: "Job seekers and recruiters share one platform, so hiring stays a conversation.",
  },
];

const About = () => {
  return (
    <div className="hh-page">
      {/* Mission */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="brand" shape="pill" className="mb-5 gap-1.5">
            <Sparkles size={13} />
            About us
          </Badge>

          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Our mission at{" "}
            <span className="hh-wordmark">HireHeaven</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            We&apos;re dedicated to revolutionising the job search experience.
            Our mission is to create meaningful connections between talented
            individuals and forward-thinking companies, fostering growth and
            success for both.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-2xl border shadow-soft-lg">
          <img
            src="/about.jpg"
            className="aspect-[16/7] w-full object-cover"
            alt="A workspace with a laptop, notebook and coffee"
          />
        </div>

        {/* Values */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft-lg"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-subtle text-brand-subtle-foreground">
                {v.icon}
              </div>
              <h3 className="mb-2 font-semibold">{v.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/40 py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to find your dream job?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join thousands of job seekers on HireHeaven.
          </p>
          <div className="mt-8">
            <Link href="/jobs">
              <Button size="xl" className="gap-2">
                Get started
                <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
