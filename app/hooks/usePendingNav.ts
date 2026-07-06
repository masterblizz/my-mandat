"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

// Wraps router.push in a React transition so a CTA button can show a
// pending/loading state until the destination page has actually rendered,
// instead of looking unresponsive during heavy page mounts.
export function usePendingNav() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(path: string, before?: () => void) {
    before?.();
    startTransition(() => {
      router.push(path);
    });
  }

  return { isPending, navigate };
}
