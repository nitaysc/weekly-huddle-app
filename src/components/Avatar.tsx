import type { Friend } from "@/lib/data";

type Common = { size?: number; ring?: string; imageUrl?: string | null };
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
  const imageUrl = props.imageUrl;

  return (
    <div
      className={`rounded-full border-2 ${ring} grid place-items-center font-mono text-[10px] font-bold text-background overflow-hidden`}
      style={{ width: size, height: size, background: imageUrl ? "transparent" : color }}
      title={title}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={title ?? initials} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
