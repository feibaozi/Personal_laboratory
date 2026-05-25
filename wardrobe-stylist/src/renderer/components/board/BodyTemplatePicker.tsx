import { useState, useEffect } from 'react';

const TEMPLATES = [
  { id: 'male-slim', label: '男-瘦削', gender: 'male' },
  { id: 'male-standard', label: '男-标准', gender: 'male' },
  { id: 'male-athletic', label: '男-健壮', gender: 'male' },
  { id: 'female-petite', label: '女-娇小', gender: 'female' },
  { id: 'female-standard', label: '女-标准', gender: 'female' },
  { id: 'female-curvy', label: '女-丰满', gender: 'female' },
];

interface Props {
  selected: string;
  onSelect: (templateId: string) => void;
}

function TemplateThumbnail({ templateId, gender }: { templateId: string; gender: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.getTemplateData(templateId).then((dataUrl) => {
      if (dataUrl) setSrc(dataUrl);
    }).catch(() => {});
  }, [templateId]);

  if (src) {
    return <img src={src} alt="" className="w-full h-full object-contain" />;
  }
  // Fallback emoji
  return <span className="text-2xl">{gender === 'male' ? '🧍‍♂️' : '🧍‍♀️'}</span>;
}

export function BodyTemplatePicker({ selected, onSelect }: Props) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">人体模板</h3>
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`flex flex-col items-center p-2 rounded-lg border-2 transition-colors text-xs ${
              selected === t.id
                ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                : 'border-[var(--border-light)] hover:border-gray-300'
            }`}
          >
            <div className="w-12 h-20 rounded mb-1 flex items-center justify-center overflow-hidden">
              <TemplateThumbnail templateId={t.id} gender={t.gender} />
            </div>
            <span className="text-[10px]">{t.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[var(--text-secondary)] mt-2">
        将 PNG 模板放入 resources/templates/ 目录
      </p>
    </div>
  );
}
