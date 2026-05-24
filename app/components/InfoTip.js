'use client';

export default function InfoTip({ tip, label = 'More information', side = 'top' }) {
  if (!tip) return null;
  return (
    <span
      className={`ap-info-tip ap-info-tip-${side}`}
      tabIndex={0}
      role="note"
      aria-label={label}
      data-tip={tip}
    >
      i
    </span>
  );
}
