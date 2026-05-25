"use client";

const PRESETS = [
  { label: "感到焦虑", emoji: "😰" },
  { label: "有点疲惫", emoji: "😮‍💨" },
  { label: "心情愉悦", emoji: "😊" },
  { label: "失眠难熬", emoji: "😴" },
  { label: "下雨忧郁", emoji: "🌧️" },
  { label: "刚运动完", emoji: "🏃" },
  { label: "想家了", emoji: "🏠" },
  { label: "放松治愈", emoji: "🧘" },
];

interface MoodPresetsProps {
  onSelect: (text: string) => void;
  isLoading: boolean;
}

export default function MoodPresets({
  onSelect,
  isLoading,
}: MoodPresetsProps) {
  return (
    <div className="animate-fade-in flex flex-wrap justify-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          onClick={() => onSelect(preset.label)}
          disabled={isLoading}
          className="px-4 py-2 rounded-full text-sm glass glass-hover
                     transition-all duration-300 hover:scale-105
                     disabled:opacity-40 disabled:hover:scale-100
                     text-white/70 hover:text-white/90
                     flex items-center gap-1.5"
        >
          <span className="text-base">{preset.emoji}</span>
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
}