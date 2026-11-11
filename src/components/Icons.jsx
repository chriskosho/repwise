// Small line icons for the tab bar and header. Decorative: the text label next to each
// one is what screen readers announce.
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };

export const WorkoutIcon = () => (
  <svg {...base}>
    <path d="M3 10v4M6.5 7.5v9M17.5 7.5v9M21 10v4M6.5 12h11" />
  </svg>
);
export const InfoIcon = () => (
  <svg {...base} width={18} height={18}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.6v.1" />
  </svg>
);
export const HistoryIcon = () => (
  <svg {...base}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
    <path d="M3.5 4.5V8H7M12 7.5V12l3 2" />
  </svg>
);
export const ProgressIcon = () => (
  <svg {...base}>
    <path d="M3.5 20.5h17M5 16l4.5-5 3.5 3 6-7" />
    <path d="M15 7h4v4" />
  </svg>
);
export const BodyIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M5 9.5h14M12 9.5v5M12 14.5l-3 6M12 14.5l3 6" />
  </svg>
);
export const SettingsIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

// The app mark: the same dumbbell as the home-screen icon.
export const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
    <rect width="512" height="512" rx="120" fill="var(--accent)" />
    <g fill="var(--accent-ink)">
      <rect x="96" y="208" width="48" height="96" rx="10" />
      <rect x="152" y="176" width="48" height="160" rx="10" />
      <rect x="200" y="240" width="112" height="32" />
      <rect x="312" y="176" width="48" height="160" rx="10" />
      <rect x="368" y="208" width="48" height="96" rx="10" />
    </g>
  </svg>
);
export const FoodIcon = () => (
  <svg {...base}>
    <path d="M7 3v8a2 2 0 0 0 2 2v8M7 3v5M11 3v5a2 2 0 0 1-2 2M17 21V3c-2.2 1.2-3 4-3 7 0 1.6 1.2 3 3 3" />
  </svg>
);

// Week-strip day marks: one icon set (same stroke as the tab bar), colour carries the state.
const mark = { ...base, width: 18, height: 18 };
export const DayIcon = ({ kind }) => {
  if (kind === 'done')
    return (
      <svg {...mark}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    );
  if (kind === 'rest')
    return (
      <svg {...mark}>
        <path d="M18.5 14.5A7 7 0 0 1 9.5 5.5a7 7 0 1 0 9 9z" />
      </svg>
    );
  if (kind === 'cardio')
    return (
      <svg {...mark}>
        <path d="M3 12h4l2-5 4 10 2-5h6" />
      </svg>
    );
  if (kind === 'activity')
    return (
      <svg {...mark}>
        <circle cx="12" cy="12" r="6.5" />
      </svg>
    );
  return (
    <svg {...mark}>
      <path d="M3 10v4M6.5 7.5v9M17.5 7.5v9M21 10v4M6.5 12h11" />
    </svg>
  );
};
export const dayKind = (d, rest) => (d.done ? 'done' : rest ? 'rest' : d.k === 'c' ? 'cardio' : d.k === 'a' ? 'activity' : 'lift');
