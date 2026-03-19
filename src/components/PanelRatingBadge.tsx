type Props = {
  rating: string;
  size?: 'sm' | 'md' | 'lg';
};

const ratingConfig = {
  panel_match: { label: 'パネル通り', emoji: '\u2705', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  panel_diff: { label: 'パネルと違う', emoji: '\u26a0\ufe0f', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  jirai: { label: '地雷', emoji: '\ud83d\udca3', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
};

export default function PanelRatingBadge({ rating, size = 'md' }: Props) {
  const config = ratingConfig[rating as keyof typeof ratingConfig];
  if (!config) return null;

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' :
                      size === 'lg' ? 'text-base px-4 py-2' :
                      'text-sm px-3 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}>
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}
