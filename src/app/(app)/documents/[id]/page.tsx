import { DocumentReview } from "@/components/documents/DocumentReview";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentReview documentId={id} />;
}
