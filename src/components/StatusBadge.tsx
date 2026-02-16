import { type VehicleStatus } from "@/data/mockData";

interface StatusBadgeProps {
  status: VehicleStatus;
  size?: "sm" | "md";
}

const statusConfig: Record<VehicleStatus, { label: string; className: string }> = {
  moving: { label: "V pohybu", className: "bg-status-moving/15 text-status-moving" },
  idle: { label: "Nečinný", className: "bg-status-idle/15 text-status-idle" },
  offline: { label: "Offline", className: "bg-status-offline/15 text-status-offline" },
};

const StatusBadge = ({ status, size = "sm" }: StatusBadgeProps) => {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      } ${config.className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "moving"
            ? "bg-status-moving animate-pulse-dot"
            : status === "idle"
            ? "bg-status-idle"
            : "bg-status-offline"
        }`}
      />
      {config.label}
    </span>
  );
};

export default StatusBadge;
