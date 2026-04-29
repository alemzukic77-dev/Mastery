"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Nešto je pošlo po zlu</h2>
        <p className="text-sm text-muted-foreground">
          Došlo je do neočekivane greške. Možeš pokušati ponovo, a ako se
          ponovi, osvježi stranicu.
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} variant="default">
          <RotateCcw className="h-4 w-4" />
          Pokušaj ponovo
        </Button>
        <Button onClick={() => window.location.reload()} variant="outline">
          Osvježi stranicu
        </Button>
      </div>
    </div>
  );
}
