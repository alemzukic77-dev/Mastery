import { AuthProvider } from "@/components/providers/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppNav } from "@/components/layout/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>
        <div className="flex min-h-screen flex-col">
          <AppNav />
          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
            {children}
          </main>
        </div>
      </RequireAuth>
    </AuthProvider>
  );
}
