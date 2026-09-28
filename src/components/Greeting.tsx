"use client";

import { useSyncExternalStore } from "react";

const NAME = "Gavin";

function greetingFor(hour: number) {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 60_000);
  return () => clearInterval(t);
};

export default function Greeting() {
  // Uses the browser's clock so the greeting matches your local time of day.
  const hour = useSyncExternalStore(subscribe, () => new Date().getHours(), () => -1);
  const date = useSyncExternalStore(
    subscribe,
    () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    () => "",
  );
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {hour < 0 ? "Welcome back" : greetingFor(hour)}, {NAME}
      </h1>
      <p className="mt-1 h-5 text-sm text-muted">{date}</p>
    </div>
  );
}
