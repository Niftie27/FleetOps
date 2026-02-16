import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
}

const EmptyState = ({ icon, title, description }: EmptyStateProps) => (
  <div className="flex h-60 flex-col items-center justify-center rounded-xl border border-border bg-card text-center px-6">
    <div className="mb-3 text-muted-foreground">
      {icon ?? <Inbox className="h-10 w-10" />}
    </div>
    <p className="text-lg font-medium">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
  </div>
);

export default EmptyState;
