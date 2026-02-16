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
      <span
        className={`h-2 w-2 rounded-full ${
          isMock ? "bg-status-idle" : "bg-status-moving animate-pulse-dot"
        }`}
      />
      {isMock ? (
        <>
          <Database className="h-3 w-3" />
          Mock data
        </>
      ) : (
        <>
          <Wifi className="h-3 w-3" />
          Live API
        </>
      )}
    </span>
  );
};

export default DataSourceBadge;
