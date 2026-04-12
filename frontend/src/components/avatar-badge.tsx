"use client";

import Image from "next/image";
import { useState } from "react";

import { API_BASE } from "@/lib/api";

const PRESET_GRADIENTS = [
  "from-sky-500 to-blue-700",
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-700",
  "from-fuchsia-500 to-violet-700",
];

function getInitials(name?: string) {
  const safe = (name || "?").trim();
  return safe.length >= 2 ? safe.slice(-2) : safe.slice(0, 1).toUpperCase();
}

function getGradient(seed: string) {
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PRESET_GRADIENTS[total % PRESET_GRADIENTS.length];
}

export function AvatarBadge({
  name,
  avatarPath,
  size = "md",
}: {
  name?: string;
  avatarPath?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failedAvatarPath, setFailedAvatarPath] = useState<string | null>(null);
  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-24 w-24 text-2xl" : "h-11 w-11 text-sm";
  const isRemote = Boolean(avatarPath && avatarPath.startsWith("/api/") && failedAvatarPath !== avatarPath);

  if (isRemote) {
    return (
      <Image
        src={`${API_BASE}${avatarPath}`}
        alt={name || "avatar"}
        width={96}
        height={96}
        unoptimized
        className={`${sizeClass} rounded-full border border-white/70 object-cover shadow-sm`}
        onError={() => setFailedAvatarPath(avatarPath ?? null)}
      />
    );
  }
  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-br ${getGradient(name || avatarPath || "avatar")} font-bold text-white shadow-sm`}>
      {getInitials(name)}
    </div>
  );
}
