import type { Friend } from "@/lib/data";

type Common = { size?: number; ring?: string };
type FromFriend = Common & { friend: Friend };
type FromProfile = Common & {
  initials: string;
  color: string;
  name?: string;
};

export function Avatar(props: FromFriend | FromProfile) {
  const size = props.size ?? 32;
  const ring = props.ring ?? "border-background";
  const initials = "friend" in props ? props.friend.initials : props.initials;
  const color = "friend" in props ? props.friend.color : props.color;
  const title = "friend" in props ? props.friend.name : props.name;
  return (
    <div
      className={`rounded-full border-2 ${ring} grid place-items-center font-mono text-[10px] font-bold text-background`}
      style={{ width: size, height: size, background: color }}
      title={title}
    >
      {initials}
    </div>
  );
}
