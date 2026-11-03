/* ---------- Navigation ---------- */

export const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Work", href: "#work" },
  { label: "About", href: "#about" },
  { label: "Play", href: "#play" },
  { label: "Ask", href: "#ask" },
];

/* ---------- Hero ---------- */

export const HERO = {
  kicker: "Custom ROMs · Apps · Root modules",
  pill: "LunarisOS 3.12 · Zephyr",
  lines: ["I build custom ROMs,", "apps and, sometimes,", "root"] as const,
  emphasis: "modules",
  age: "18",
  gender: "M",
  flag: "🇮🇳",
  country: "India",
  ctaPrimary: "Get LunarisOS 3.12",
  ctaSecondary: "Ask me anything",
};

/* ---------- FIG. 1 partitions ---------- */

export const PARTITIONS = [
  { key: "boot", label: "BOOT", note: "kernel + ramdisk · where Magisk patches in" },
  { key: "system", label: "SYSTEM", note: "the OS image · read-only, overlaid by modules" },
  { key: "vendor", label: "VENDOR", note: "blobs + HALs · different on every device" },
  { key: "userdata", label: "USERDATA", note: "your apps and data · back this up first" },
] as const;

export type PartitionKey = (typeof PARTITIONS)[number]["key"];

/* ---------- Work ---------- */

export type RomLink = { label: string; url: string; primary?: boolean };

export const ROM_POST = {
  title: "LunarisOS 3.12",
  codename: "Zephyr",
  variant: "GMS Variant",
  date: "2026-09-27",
  dateLabel: "27 September 2026",
  maintainer: "@v3rsi0n",
  maintainerUrl: "https://t.me/v3rsi0n",
  thumbnail: "/work/lunaris-3.12.jpg",
  thumbnailWidth: 1672,
  thumbnailHeight: 941,
  thumbnailAlt: "LunarisOS AOSP banner: v3rsi0n, QPR 02, Stable · Secure · Refined",
  /** Links with an empty url are not shown. */
  links: [
    { label: "Download (Telegram)", url: "https://t.me/RealmeGTNeo3discussion/153674", primary: true },
    { label: "Support", url: "https://t.me/RealmeGTNeo3discussion" },
    { label: "Gofile", url: "" },
    { label: "Screenshots", url: "" },
    { label: "SusFS", url: "" },
    { label: "Source changelog", url: "" },
  ] as RomLink[],
  changelog: [
    "About Device Info updated",
    "Added Viper4FX",
    "FP Flashbang fixed",
    "Some optimisations, a few useless apps removed and battery optimisations added",
  ],
  tip: "To fix the transition lag: Settings → Singularity → User Interface → System animation style, then pick any of the 4 styles except the default.",
  notesLead: "Read the notes. Don't blame me afterwards.",
  notes: [
    "The ROM can be flashed from any Zephyr build. Coming from vanilla Lunaris with a local install, it will bootloop: clean flash only. Coming from a GMS-variant Lunaris, a local install works.",
    "If flashing from a port, flash the 10R stock ROM first.",
  ],
  warning: "When flashing from 10R stock, delete preloader_raw.img. Flashing from GT stock or old AOSP will break audio.",
};

export const APP = {
  name: "ArchiveTune",
  repo: "4nx3b/ArchiveTune",
  sector: "Android · Kotlin",
  title: "The cutest Material 3 Expressive music player on Android",
  desc: "Local files and YouTube Music in one queue, wrapped in M3 Expressive motion, with a parser core, a lyrics library and a Rhino-powered deobfuscator split into their own engines.",
  tags: ["Kotlin", "YouTube Music", "Local files", "Material 3"],
  link: "https://github.com/4nx3b/ArchiveTune",
  linkLabel: "View the repo",
};

/* ---------- About ---------- */

export const ABOUT = {
  facts: { age: "18", gender: "M", flag: "🇮🇳", country: "India", line: "Custom ROMs, apps and, sometimes, root modules." },
  interests: [
    { title: "Anime", desc: "Tracked on AniList, every episode logged." },
    { title: "Story games", desc: "Story games over competitive FPS. I'm bad at those and I've made peace with it." },
    { title: "Music", desc: "Anything my ears like, mostly J-pop, EDM and white girl music." },
  ],
  devices: [
    { role: "Primary", device: "Realme GT Neo 3 (8/128)", detail: "RMX3561 · lisaa" },
    { role: "Secondary", device: "Samsung Galaxy J7 Prime", detail: "G610F" },
    { role: "Laptop", device: "Lenovo IdeaPad 320", detail: "4 GB RAM, 1 TB HDD, i3-6006U, Intel HD 520", aside: "it tries its best" },
  ] as { role: string; device: string; detail: string; aside?: string }[],
  gamesLead: "Played daily, or close to it",
  games: ["Crystal of Atlan", "Punishing: Gray Raven", "Racing Master SEA", "Delta Force Mobile (Global)", "MiSide"],
};

export const MUSIC = {
  handle: "zensxin",
  url: "https://www.last.fm/user/zensxin",
  now: { track: "in the pool", artist: "kensuke ushio", vol: 85 },
  genres: ["city pop", "lo-fi", "ambient", "jazz fusion", "OST"],
};

export const ANIME = {
  handle: "zensxin",
  url: "https://anilist.co/user/zensxin/",
  count: 586,
  episodes: 5805,
  minutes: 144204,
  mean: 87.8,
};

/* ---------- Play ---------- */

export type Game = { id: string; icon: "snake" | "pong" | "quiz" | "flappy" | "mines" | "reaction" | "dodge"; name: string; desc: string; playable: boolean };

export const GAMES: Game[] = [
  { id: "snake", icon: "snake", name: "Snake", desc: "Classic game. High chance of self-sabotage.", playable: true },
  { id: "pong", icon: "pong", name: "Ping Pong", desc: "You vs an AI paddle. First to 5 wins.", playable: true },
  { id: "quiz", icon: "quiz", name: "Roast Quiz", desc: "A personality test but every answer is a personal attack.", playable: true },
  { id: "flappy", icon: "flappy", name: "Flappy", desc: "Infuriating physics. Avoid the pipes.", playable: false },
  { id: "mines", icon: "mines", name: "Minesweeper", desc: "Classic logic. Avoid the mines.", playable: false },
  { id: "reaction", icon: "reaction", name: "Reaction Test", desc: "Click when it turns green.", playable: true },
  { id: "dodge", icon: "dodge", name: "Dodge", desc: "Survive against angry geometry.", playable: false },
];

export const QUIZ = [
  { q: "Pick a debugging style.", opts: ["Logs everywhere", "Read docs", "Blame vendor"], roasts: ["Chaotic but effective.", "Rare discipline.", "Valid, sadly."] },
  { q: "Your debugging style?", opts: ["Scientific", "Panic console logs", "Blame vendor blobs"], roasts: ["Responsible. Suspicious.", "A classic gremlin.", "Correct, honestly."] },
  { q: "Pick a superpower.", opts: ["Fastboot never fails", "Infinite battery", "No merge conflicts"], roasts: ["Impossible dream.", "Rooted monk energy.", "Too powerful."] },
];

/* ---------- Ask ---------- */

export type SeedQuestion = { id: string; text: string; author: string; votes: number; ts: number; seeded?: boolean };

export const SEED_QUESTIONS: SeedQuestion[] = [
  {
    id: "seed-1",
    text: "Daily driver or test bench — which device gets the experimental builds first?",
    author: "anon",
    votes: 12,
    ts: 1751328000000,
    seeded: true,
  },
  {
    id: "seed-2",
    text: "Magisk or KernelSU for a fresh install in 2026? Pick one.",
    author: "anon",
    votes: 9,
    ts: 1752537600000,
    seeded: true,
  },
  {
    id: "seed-3",
    text: "What's the hardest device you've ever ported a ROM to, and why?",
    author: "anon",
    votes: 7,
    ts: 1753747200000,
    seeded: true,
  },
];

/* ---------- Links ---------- */

export type Social = { name: string; handle: string; url: string };

export const SOCIALS: Social[] = [
  { name: "GitHub", handle: "@4nx3b", url: "https://github.com/4nx3b" },
  { name: "Telegram", handle: "@v3rsi0n", url: "https://t.me/v3rsi0n" },
  { name: "Instagram", handle: "@extrr4ction", url: "https://www.instagram.com/extrr4ction" },
  { name: "Discord", handle: "v3rsi0n", url: "https://discord.com/users/1128166734604537949" },
  { name: "YouTube Music", handle: "channel", url: "https://music.youtube.com/channel/UCzCt_fdj0vtv6U3bpVrHNzA" },
  { name: "Last.fm", handle: "zensxin", url: "https://www.last.fm/user/zensxin" },
  { name: "AniList", handle: "zensxin", url: "https://anilist.co/user/zensxin/" },
  { name: "Snapchat", handle: "@zensxin", url: "https://www.snapchat.com/@zensxin" },
  { name: "Pinterest", handle: "zensxin", url: "https://www.pinterest.com/zensxin/" },
  { name: "Facebook", handle: "v3rsi0n", url: "https://www.facebook.com/therealreze" },
  { name: "Trakt", handle: "zensxin", url: "https://trakt.tv/users/zensxin" },
  { name: "Email", handle: "say hello", url: "#ask" },
];

export const LIVE_SITE = "https://therealreze.vercel.app";

/* ---------- AMA backend (ported from the previous build, keys preserved) ---------- */

export const FIREBASE = {
  apiKey: "AIzaSyCUG-oxLlGWKulnV8E0PwSEmr_s0EyCRUk",
  projectId: "therealreze-2a3bf",
};
export const ADMIN_EMAIL = "asaxxhiii@gmail.com";
export const FORMSPREE_ENDPOINT = "https://formspree.io/f/mwvdqnyn";
export const AMA_COLLECTION = "amaQuestions";
export const AMA_KEYS = {
  ownerAuth: "ama_owner_auth_v4",
  publicAuth: "ama_public_anon_auth_v4",
  queue: "ama_pending_questions_v4",
  voted: "ama_voted_question_ids_v6",
  sort: "ama_public_sort_v6",
};

/* ---------- Signal radio (real audio streams) ---------- */

export const RADIO_TRACKS = [
  { id: "01", title: "in the pool", artist: "kensuke ushio", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "02", title: "night drive", artist: "signal radio", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
  { id: "03", title: "zephyr loop", artist: "signal radio", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
];
