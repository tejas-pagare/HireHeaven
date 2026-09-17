import AiInterview from "@/components/interview/AiInterview";

export default async function AiInterviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const resolvedParams = await params;
  return (
    <AiInterview applicationId={parseInt(resolvedParams.applicationId, 10)} />
  );
}
