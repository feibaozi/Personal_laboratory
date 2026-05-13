interface ColorDotProps {
  color: string;
  filled?: boolean;
  size?: number;
}

export function ColorDot({ color, filled = true, size = 8 }: ColorDotProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: filled ? color : 'transparent',
        border: `1.5px solid ${color}`,
        flexShrink: 0,
      }}
    />
  );
}
