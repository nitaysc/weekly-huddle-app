import boxingImg from "@/assets/boxing.jpg";
import caliImg from "@/assets/calisthenics.jpg";
import basketImg from "@/assets/basketball.jpg";
import volleyImg from "@/assets/volleyball.jpg";

export type SportId = "boxing" | "cali" | "basket" | "volley";

export interface Sport {
  id: SportId;
  name: string;
  shortName: string;
  tagline: string;
  image: string;
  colorVar: string; // css var token suffix used with bg-{token}
  duration: number; // minutes
  difficulty: "Easy" | "Medium" | "Hard";
  location: string;
  equipment: string[];
  description: string;
  warmup: string[];
  outdoor: boolean;
  workout: WorkoutBlock[];
}

export interface WorkoutBlock {
  title: string;
  detail: string;
}

export const SPORTS: Record<SportId, Sport> = {
  boxing: {
    id: "boxing",
    name: "Boxing",
    shortName: "Box",
    tagline: "Heavy bag & pad work",
    image: boxingImg,
    colorVar: "boxing",
    duration: 75,
    difficulty: "Hard",
    location: "Iron House Gym",
    equipment: ["Hand wraps", "16oz gloves", "Mouthguard", "Water"],
    description:
      "Technical pad and bag rounds focused on the 1-2-3, defensive slips and lateral movement. Three-minute rounds with a one-minute rest.",
    warmup: ["5 min jump rope", "Shoulder mobility", "Neck rolls", "Shadow box x 2 rounds"],
    outdoor: false,
    workout: [
      { title: "Round 1", detail: "Jab / Cross — find the range" },
      { title: "Round 2", detail: "1-2-3, slip, 2-3" },
      { title: "Round 3", detail: "Bodyshots, double hook" },
      { title: "Round 4", detail: "Free flow on the bag" },
    ],
  },
  cali: {
    id: "cali",
    name: "Calisthenics",
    shortName: "Cali",
    tagline: "Bars, push, pull, core",
    image: caliImg,
    colorVar: "cali",
    duration: 60,
    difficulty: "Medium",
    location: "Riverside Park Bars",
    equipment: ["Chalk", "Resistance band", "Water"],
    description:
      "Bodyweight strength circuit at the outdoor bars. Push, pull and core in a triset, scaled to your level.",
    warmup: ["Wrist & shoulder prep", "Scapular pulls x 10", "Hollow holds x 30s"],
    outdoor: true,
    workout: [
      { title: "Pull-ups", detail: "5 x max reps" },
      { title: "Dips", detail: "5 x max reps" },
      { title: "Push-ups", detail: "5 x 20" },
      { title: "Hanging leg raise", detail: "4 x 12" },
    ],
  },
  basket: {
    id: "basket",
    name: "Basketball",
    shortName: "Ball",
    tagline: "Shoot, drive, scrimmage",
    image: basketImg,
    colorVar: "basket",
    duration: 90,
    difficulty: "Medium",
    location: "Court 4, North Park",
    equipment: ["Court shoes", "Ball (provided)", "Water"],
    description:
      "Warm up with shooting drills, then 4v4 half court to 21. Bring your A-game and your jumper.",
    warmup: ["Layup line", "Form shooting x 50", "Around the world"],
    outdoor: true,
    workout: [
      { title: "Spot shooting", detail: "5 spots x 10 shots" },
      { title: "Pick & roll", detail: "Run the action 10x" },
      { title: "Scrimmage", detail: "4v4 to 21, win by 2" },
    ],
  },
  volley: {
    id: "volley",
    name: "Volleyball",
    shortName: "Vol",
    tagline: "Serve, set, spike",
    image: volleyImg,
    colorVar: "volley",
    duration: 90,
    difficulty: "Medium",
    location: "Beach Court B",
    equipment: ["Kneepads", "Court shoes", "Sunscreen", "Water"],
    description:
      "Pepper drills, jump serves, then a full match. We rotate teams every set.",
    warmup: ["Arm swings", "Approach jumps x 5", "Pepper x 5 min"],
    outdoor: true,
    workout: [
      { title: "Serving", detail: "Float and jump x 20 each" },
      { title: "Pass-set-spike", detail: "Three-touch drill" },
      { title: "Match", detail: "Best of 3 to 21" },
    ],
  },
};

// Weekly rotation: week A vs week B
// A: Mon/Thu = Boxing, Tue/Fri = Cali
// B: Mon/Thu = Basket, Tue/Fri = Volley
const WEEK_A: Record<number, SportId | null> = {
  1: "boxing", // Mon
  2: "cali",   // Tue
  3: null,
  4: "boxing", // Thu
  5: "cali",   // Fri
  6: null,
  0: null,
};
const WEEK_B: Record<number, SportId | null> = {
  1: "basket",
  2: "volley",
  3: null,
  4: "basket",
  5: "volley",
  6: null,
  0: null,
};

// ISO week-number based rotation so it stays consistent across the year.
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
}

export function rotationFor(date: Date): "A" | "B" {
  return isoWeek(date) % 2 === 0 ? "B" : "A";
}

export function sportFor(date: Date): SportId | null {
  const rotation = rotationFor(date);
  const map = rotation === "A" ? WEEK_A : WEEK_B;
  return map[date.getDay()] ?? null;
}

// Start of week (Monday-aligned)
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

export function weekDates(from: Date): Date[] {
  const start = startOfWeek(from);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// Daily session time = 18:30 local
export function sessionTime(date: Date): Date {
  const d = new Date(date);
  d.setHours(18, 30, 0, 0);
  return d;
}

export function nextSession(from: Date = new Date()): { date: Date; sport: Sport } | null {
  for (let i = 0; i < 14; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const sId = sportFor(d);
    if (!sId) continue;
    const start = sessionTime(d);
    if (start.getTime() > from.getTime() - 60 * 60 * 1000) {
      return { date: start, sport: SPORTS[sId] };
    }
  }
  return null;
}

// Friends (mock)
export interface Friend {
  id: string;
  name: string;
  initials: string;
  color: string;
  status: "going" | "maybe" | "out" | "unknown";
  streak: number;
  attended: number;
}

export const FRIENDS: Friend[] = [
  { id: "you", name: "You", initials: "YO", color: "hsl(45 90% 50%)", status: "going", streak: 12, attended: 48 },
  { id: "marc", name: "Marcus", initials: "MA", color: "hsl(15 75% 55%)", status: "going", streak: 9, attended: 41 },
  { id: "kai",  name: "Kai", initials: "KA", color: "hsl(195 70% 55%)", status: "going", streak: 14, attended: 52 },
  { id: "leo",  name: "Leo", initials: "LE", color: "hsl(140 50% 50%)", status: "maybe", streak: 4, attended: 22 },
  { id: "ava",  name: "Ava", initials: "AV", color: "hsl(310 65% 60%)", status: "going", streak: 7, attended: 33 },
  { id: "sam",  name: "Sam", initials: "SA", color: "hsl(260 60% 65%)", status: "out", streak: 2, attended: 18 },
  { id: "noa",  name: "Noa", initials: "NO", color: "hsl(45 70% 55%)", status: "going", streak: 6, attended: 27 },
];

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "LIVE NOW";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h >= 24) {
    const days = Math.floor(h / 24);
    const hr = h % 24;
    return `${days}D ${hr.toString().padStart(2, "0")}H`;
  }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "You don't have to be extreme, just consistent.",
  "Hard work beats talent when talent doesn't work hard.",
  "The body achieves what the mind believes.",
  "Show up. Even when it's raining.",
];
