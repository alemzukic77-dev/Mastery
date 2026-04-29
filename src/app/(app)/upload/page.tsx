import { UploadDropzone } from "@/components/documents/UploadDropzone";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload documents</h1>
        <p className="text-sm text-muted-foreground">
          Drop PDF, image, CSV, or TXT files. We&rsquo;ll extract structured data
          and run validation automatically.
        </p>
      </div>
      <UploadDropzone />
    </div>
  );
}
