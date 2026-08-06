import LoadingSpinner from "./components/ui/LoadingSpinner";

// Next.js App Router's automatic route-level loading UI — shown via
// Suspense while a route segment's JS chunk/data is still loading, e.g.
// navigating into a heavier page for the first time. No app/**/loading.tsx
// existed before, so route transitions showed nothing until this.
export default function Loading() {
  return <LoadingSpinner size={44} fullScreen />;
}
