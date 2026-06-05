"use client";

interface GearButtonProps {
  onClick: () => void;
}

export default function GearButton({ onClick }: GearButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 w-[34px] h-[34px] rounded-full bg-sidebar border border-white/10 text-text-muted text-base flex items-center justify-center cursor-pointer opacity-35 hover:opacity-85 transition-opacity z-10"
      aria-label="Parent settings"
    >
      ⚙
    </button>
  );
}
