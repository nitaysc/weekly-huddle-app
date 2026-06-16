import type { Friend } from "@/lib/data";

export function Avatar({ friend, size = 32, ring = "border-background" }: { friend: Friend; size?: number; ring?: string }) {
  return (
    <div
      className={`rounded-full border-2 ${ring} grid place-items-center font-mono text-[10px] font-bold text-background`}
      style={{ width: size, height: size, background: friend.color }}
      title={friend.name}
    >
      {friend.initials}
    </div>
  );
}
