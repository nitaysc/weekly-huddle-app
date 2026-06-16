import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/data";

export function Countdown({ target, className }: { target: Date; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{formatCountdown(target.getTime() - now)}</span>;
}
