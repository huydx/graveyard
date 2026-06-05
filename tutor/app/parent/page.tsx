"use client";

import { useState } from "react";
import PinGate from "@/components/parent/PinGate";
import Dashboard from "@/components/parent/Dashboard";

export default function ParentPage() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <Dashboard />;
}
