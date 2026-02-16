import type { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  accent?: string;
}

const KPICard = ({ title, value, icon, accent }: KPICardProps) => (
  <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={`mt-1 text-3xl font-bold ${accent || "text-foreground"}`}>
          {value}
        </p>
      </div>
      <div className="rounded-lg bg-secondary p-3">{icon}</div>
    </div>
  </div>
);

export default KPICard;
