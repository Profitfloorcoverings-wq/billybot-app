export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import JobHeader from "./components/JobHeader";
import JobTabs from "./components/JobTabs";
import SidebarCards from "./components/SidebarCards";
import { getJobBundle } from "@/lib/jobs/getJobBundle";
import { createServerClient } from "@/utils/supabase/server";

type JobDetailPageProps = {
  params: Promise<{ id: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return (
      <div className="page-container">
        <div className="empty-state stack items-center">
          <h2 className="section-title">Invalid job link</h2>
          <p className="section-subtitle">This job ID is invalid. Return to Jobs and open a valid record.</p>
          <Link href="/jobs" className="btn btn-primary">Back to Jobs</Link>
        </div>
      </div>
    );
  }

  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    redirect("/auth/login");
  }

  const currentClientId = user.id;
  const bundle = await getJobBundle({ jobId: id, currentClientId });

  if (!bundle) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[jobs/[id]] job not accessible", { jobId: id, currentClientId });
    }

    return (
      <div className="page-container">
        <div className="empty-state stack items-center">
          <h2 className="section-title">Job not found</h2>
          <p className="section-subtitle">The job was not found, or you no longer have access to it.</p>
          <Link href="/jobs" className="btn btn-primary">Back to Jobs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container gap-5">
      <JobHeader job={bundle.job} quotesCount={bundle.quotes.length} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0">
          <JobTabs data={bundle} />
        </main>
        <aside>
          <SidebarCards data={bundle} />
        </aside>
      </div>
    </div>
  );
}
