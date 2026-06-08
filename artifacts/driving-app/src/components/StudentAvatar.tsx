import { storageUrl } from "@/lib/upload";

interface StudentAvatarProps {
  fullName: string;
  headshotPath?: string | null;
  /** Tailwind size classes for the container, e.g. "w-10 h-10". */
  className?: string;
  /** Tailwind text size for the initials fallback, e.g. "text-base". */
  textClassName?: string;
}

/**
 * Profile icon for a student: shows their headshot if one was uploaded,
 * otherwise falls back to the first letter of their name.
 */
export function StudentAvatar({
  fullName,
  headshotPath,
  className = "w-10 h-10",
  textClassName = "text-sm",
}: StudentAvatarProps) {
  const url = storageUrl(headshotPath);
  const initial = fullName?.trim().charAt(0).toUpperCase() || "?";

  if (url) {
    return (
      <img
        src={url}
        alt={fullName}
        className={`${className} rounded-full object-cover border border-border flex-shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${className} rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0 ${textClassName}`}
    >
      {initial}
    </div>
  );
}
