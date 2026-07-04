"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "up" | "down";

const DOT: Record<Status, string> = {
  loading: "bg-ink-mute",
  up: "bg-green",
  down: "bg-ruby",
};

function Chip({ label, status }: { label: string; status: Status }) {
  return (
    <span className="chip cursor-default">
      <span className={`inline-block w-2 h-2 rounded-full ${DOT[status]}`} />
      {label}
    </span>
  );
}

export function StatusChips() {
  const [health, setHealth] = useState<Status>("loading");
  const [ready, setReady] = useState<Status>("loading");

  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => alive && setHealth(r.ok ? "up" : "down"))
      .catch(() => alive && setHealth("down"));
    fetch("/api/ready")
      .then((r) => alive && setReady(r.ok ? "up" : "down"))
      .catch(() => alive && setReady("down"));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      <Chip label="API healthy" status={health} />
      <Chip label="DB ready" status={ready} />
    </div>
  );
}
