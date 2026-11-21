export type UserProfile = { name: string; avatar: string | null };

export const DEFAULT_PROFILE: UserProfile = { name: "User", avatar: null };
export const PROFILE_NAME_MAX = 48;

const STORAGE_KEY = "opscoder.profile.v1";
const AVATAR_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,/i;
const AVATAR_MAX_LENGTH = 2_500_000;

export function displayName(profile: UserProfile) {
 return profile.name.trim().slice(0, PROFILE_NAME_MAX) || DEFAULT_PROFILE.name;
}

export function loadProfile(): UserProfile {
 try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_PROFILE };
  const value = JSON.parse(raw) as Partial<UserProfile>;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, PROFILE_NAME_MAX) : "";
  const avatar = typeof value.avatar === "string" && value.avatar.length <= AVATAR_MAX_LENGTH && AVATAR_PATTERN.test(value.avatar) ? value.avatar : null;
  return { name: name || DEFAULT_PROFILE.name, avatar };
 } catch {
  return { ...DEFAULT_PROFILE };
 }
}

export function saveProfile(profile: UserProfile) {
 try {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: profile.name.slice(0, PROFILE_NAME_MAX), avatar: profile.avatar }));
 } catch { /* Storage can be unavailable or full. */ }
}

export async function imageToAvatar(file: File): Promise<string> {
 if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
 if (file.size > 12 * 1024 * 1024) throw new Error("That image is larger than 12 MB.");
 const bitmap = await createImageBitmap(file);
 try {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be prepared.");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  const avatar = canvas.toDataURL("image/webp", 0.9);
  if (!AVATAR_PATTERN.test(avatar) || avatar.length > AVATAR_MAX_LENGTH) throw new Error("That image could not be saved. Try a smaller one.");
  return avatar;
 } finally {
  bitmap.close();
 }
}
