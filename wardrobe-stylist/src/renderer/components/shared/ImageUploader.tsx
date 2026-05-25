import { useState, useCallback } from 'react';
import { Upload, X } from 'lucide-react';

interface Props {
  onImageSelected: (imagePath: string, stickerPath?: string | null) => void;
  preview?: string | null;
}

export function ImageUploader({ onImageSelected, preview }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.importImage('');
      if (result) {
        onImageSelected(result.original, result.sticker);
      }
    } catch (e) {
      console.error('Failed to import image:', e);
    } finally {
      setLoading(false);
    }
  }, [onImageSelected]);

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
        dragOver ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border-light)] hover:border-gray-400'
      }`}
      style={{ aspectRatio: '3/4' }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
      onClick={handleClick}
    >
      {preview ? (
        <>
          <img src={`file://${preview}`} alt="Preview" className="w-full h-full object-cover rounded-xl" />
          <button
            className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
            onClick={(e) => { e.stopPropagation(); onImageSelected(''); }}
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
          {loading ? (
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          ) : (
            <>
              <Upload size={28} className="mb-2" />
              <p className="text-sm">点击或拖拽上传图片</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
