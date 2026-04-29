import Link from "next/link";
import { ArrowRight, FileCheck2, ScanText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <FileCheck2 className="h-5 w-5" />
            <span>Mastery</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-24 text-center">
          <span className="mb-6 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            Smart Document Processing System
          </span>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Extract, validate, and review business documents in seconds.
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Upload invoices and purchase orders in PDF, image, CSV or TXT format.
            Our system extracts structured data, validates totals and dates, and
            flags inconsistencies for review.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Start processing <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
          <Feature
            icon={<ScanText className="h-5 w-5" />}
            title="Multi-format ingestion"
            body="PDF, image (PNG/JPG), CSV, and TXT — all handled by one pipeline."
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Validation engine"
            body="Detects total mismatches, missing fields, invalid dates, and duplicates."
          />
          <Feature
            icon={<FileCheck2 className="h-5 w-5" />}
            title="Review interface"
            body="Side-by-side preview with editable extracted data and per-field validation."
          />
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Mastery</span>
          <a
            href="https://github.com/alemzukic77-dev/Mastery"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-3 inline-flex rounded-md bg-primary/10 p-2 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
