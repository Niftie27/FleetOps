import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card p-8 text-center">
    <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
    <p className="text-lg font-medium">Chyba při načítání</p>
    <p className="mt-1 text-sm text-muted-foreground max-w-md">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-4 flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Zkusit znovu
      </button>
    )}
  </div>
);

export default ErrorState;
