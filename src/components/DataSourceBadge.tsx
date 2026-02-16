import { Database, Wifi } from "lucide-react";

interface DataSourceBadgeProps {
  source: "mock" | "live";
}

const DataSourceBadge = ({ source }: DataSourceBadgeProps) => {
  const isMock = source === "mock";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isMock
          ? "bg-status-idle/15 text-status-idle"
          : "bg-status-moving/15 text-status-moving"
      }`}
    >
      {isMock ? (
        <Database className="h-3 w-3" />
      ) : (
        <Wifi className="h-3 w-3" />
      )}
      {isMock ? "Mock data" : "Live API"}
    </span>
  );
};

export default DataSourceBadge;
