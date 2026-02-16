import { useState, useEffect } from "react";
import { Clock, RefreshCw } from "lucide-react";

interface RefreshCountdownProps {
  lastUpdated: string | null;
  intervalMs: number;
  onRefresh: () => void;
}

const RefreshCountdown = ({ lastUpdated, intervalMs, onRefresh }: RefreshCountdownProps) => {
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(intervalMs / 1000));

  useEffect(() => {
    setSecondsLeft(Math.floor(intervalMs / 1000));
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return Math.floor(intervalMs / 1000);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [intervalMs, lastUpdated]);

  const timeAgo = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {timeAgo}
      </span>
      <span className="text-border">|</span>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        {secondsLeft}s
      </button>
    </div>
  );
};

export default RefreshCountdown;
