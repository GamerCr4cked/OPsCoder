import { useId } from "react";
import { displayName, type UserProfile } from "../profile";

const BUBBLE = "M18 9H46A9 9 0 0 1 55 18V39A9 9 0 0 1 46 48H28L19 55V48H18A9 9 0 0 1 9 39V18A9 9 0 0 1 18 9Z";
const PROMPT = "M24 24L31 30L24 36";
const CURSOR = "M35 36H41";

export function BrandMark({ size = 30, variant = "solid", className }: { size?: number; variant?: "solid" | "outline"; className?: string }) {
 const rawId = useId();
 const gradientId = "brand" + rawId.replace(/[^a-zA-Z0-9_-]/g, "");
 const stroke = variant === "solid" ? "var(--logo-ink, #08121a)" : `url(#${gradientId})`;
 return <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label="OPsCoder">
  <defs>
   <linearGradient id={gradientId} x1="9" y1="9" x2="55" y2="55" gradientUnits="userSpaceOnUse">
    <stop style={{ stopColor: "var(--logo-a, #5fe7f2)" }} />
    <stop offset="1" style={{ stopColor: "var(--logo-b, #8b7cff)" }} />
   </linearGradient>
  </defs>
  <path d={BUBBLE} fill={variant === "solid" ? `url(#${gradientId})` : "none"} stroke={variant === "solid" ? "none" : `url(#${gradientId})`} strokeWidth="5" strokeLinejoin="round" />
  <path d={PROMPT} stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  <path d={CURSOR} stroke={stroke} strokeWidth="5" strokeLinecap="round" />
 </svg>;
}

export function ProfileAvatar({ profile, size = 30, className = "" }: { profile: UserProfile; size?: number; className?: string }) {
 const name = displayName(profile);
 if (profile.avatar) return <img className={"avatar avatar-image " + className} src={profile.avatar} alt="" title={name} style={{ width: size, height: size }} />;
 return <span className={"avatar avatar-default " + className} title={name} role="img" aria-label={name + " avatar"} style={{ width: size, height: size }}>
  <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
   <circle cx="32" cy="23.5" r="14" stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" />
   <circle cx="32" cy="23.5" r="9.4" fill="currentColor" />
   <path d="M10.5 62c2.4-13.4 11-20.2 21.5-20.2S51.1 48.6 53.5 62Z" fill="currentColor" />
  </svg>
 </span>;
}
