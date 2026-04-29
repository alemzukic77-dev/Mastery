import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { RedirectIfAuthed } from "@/components/auth/RedirectIfAuthed";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RedirectIfAuthed />
      <div className="flex min-h-screen flex-col">
        <header className="border-b">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <FileCheck2 className="h-5 w-5" />
              <span>Mastery</span>
            </Link>
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </AuthProvider>
  );
}
