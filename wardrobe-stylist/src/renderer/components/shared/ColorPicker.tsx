import type { Color } from '../../lib/types';

const COLOR_OPTIONS: { value: Color; label: string; hex: string }[] = [
  { value: 'white', label: '白', hex: '#FFFFFF' },
  { value: 'black', label: '黑', hex: '#1A1A1A' },
  { value: 'gray', label: '灰', hex: '#9CA3AF' },
  { value: 'navy', label: '藏青', hex: '#1E3A5F' },
  { value: 'beige', label: '米色', hex: '#F5E6D3' },
  { value: 'red', label: '红', hex: '#DC2626' },
  { value: 'pink', label: '粉', hex: '#EC4899' },
  { value: 'orange', label: '橙', hex: '#F97316' },
  { value: 'yellow', label: '黄', hex: '#EAB308' },
  { value: 'green', label: '绿', hex: '#16A34A' },
  { value: 'blue', label: '蓝', hex: '#2563EB' },
  { value: 'purple', label: '紫', hex: '#9333EA' },
  { value: 'brown', label: '棕', hex: '#78350F' },
  { value: 'khaki', label: '卡其', hex: '#C4A97D' },
  { value: 'denim', label: '牛仔', hex: '#5B7FA5' },
  { value: 'multicolor', label: '多色', hex: 'linear-gradient(90deg, red, orange, yellow, green, blue, purple)' },
];

interface Props {
  selected: Color[];
  onChange: (colors: Color[]) => void;
}

export function ColorPicker({ selected, onChange }: Props) {
  const toggle = (color: Color) => {
    if (selected.includes(color)) {
      onChange(selected.filter((c) => c !== color));
    } else {
      onChange([...selected, color]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map(({ value, label, hex }) => {
        const isSelected = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center text-[10px] ${
              isSelected ? 'border-[var(--accent)] scale-110 shadow-md' : 'border-transparent hover:scale-105'
            } ${value === 'white' ? 'ring-1 ring-gray-200' : ''}`}
            style={{
              background: hex.startsWith('linear') ? 'conic-gradient(red, orange, yellow, green, blue, purple, red)' : hex,
            }}
            title={label}
          >
            {value === 'white' ? '' : isSelected ? '✓' : ''}
            {value === 'white' && isSelected ? '✓' : ''}
          </button>
        );
      })}
    </div>
  );
}
