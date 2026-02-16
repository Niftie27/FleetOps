import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  rows?: number;
}

const LoadingState = ({ message = "Načítání dat…", rows = 3 }: LoadingStateProps) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {message}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-14 animate-pulse rounded-xl bg-card" />
    ))}
  </div>
);

export default LoadingState;
