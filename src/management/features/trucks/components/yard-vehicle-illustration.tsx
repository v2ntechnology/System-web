import { useId } from 'react';

/** Vetor isométrico local, com enquadramento uniforme e variações por tipo. */
export function YardVehicleIllustration({ type }: { type?: string | undefined }) {
  const id = useId();
  const compact = type === 'van' || type === 'light';
  const tractor = type === 'tractor_unit';
  const trailer = type === 'trailer';
  return (
    <svg viewBox="0 0 240 150" className="yard-truck" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#8193ab" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#536e88" />
          <stop offset="1" stopColor="#15283b" />
        </linearGradient>
      </defs>
      <ellipse cx="124" cy="125" rx="88" ry="13" fill="#020617" opacity=".5" />
      <path d="M38 105 153 48 215 79 101 137Z" fill="currentColor" opacity=".06" />
      <path d="m53 102 104-52 44 24-104 53Z" fill="#293748" />
      <g fill="#101a29" stroke="#64748b" strokeWidth="2">
        <ellipse cx="90" cy="119" rx="10" ry="13" transform="rotate(23 90 119)" />
        {!compact && <ellipse cx="158" cy="85" rx="9" ry="12" transform="rotate(23 158 85)" />}
        <ellipse cx="180" cy="75" rx="9" ry="12" transform="rotate(23 180 75)" />
      </g>
      <g fill="#8b9bad">
        <ellipse cx="90" cy="119" rx="4" ry="6" />
        <ellipse cx="180" cy="75" rx="3" ry="5" />
        {!compact && <ellipse cx="158" cy="85" rx="3" ry="5" />}
      </g>
      {!tractor && (
        <g>
          <path
            d={compact ? 'm90 60 65-32 43 22-65 34Z' : 'm80 49 82-40 43 22-82 41Z'}
            fill="#e2e8f0"
          />
          <path
            d={compact ? 'm133 84 65-34v32l-65 33Z' : 'm123 72 82-41v45l-82 41Z'}
            fill={`url(#${id}-body)`}
          />
          <path
            d={compact ? 'm90 60 43 24v31l-43-23Z' : 'm80 49 43 23v45l-43-23Z'}
            fill="#74859b"
          />
          {!compact && (
            <g stroke="#71839a" opacity=".35" strokeWidth="1.5">
              {[134, 145, 156, 167, 178, 189].map((x) => (
                <path key={x} d={`m${x} ${69 - (x - 123) / 2}v36`} />
              ))}
            </g>
          )}
          <path
            d={compact ? 'm139 105 52-26' : 'm129 108 69-35'}
            stroke="#eff6ff"
            strokeWidth="2"
            opacity=".65"
          />
        </g>
      )}
      {!tractor && (
        <g stroke="#64748b" strokeWidth="1.5">
          <ellipse cx="184" cy="94" rx="7" ry="10" fill="#101a29" transform="rotate(23 184 94)" />
          <ellipse cx="184" cy="94" rx="3" ry="5" fill="#8b9bad" />
          {!compact && (
            <>
              <ellipse
                cx="167"
                cy="102"
                rx="7"
                ry="10"
                fill="#101a29"
                transform="rotate(23 167 102)"
              />
              <ellipse cx="167" cy="102" rx="3" ry="5" fill="#8b9bad" />
            </>
          )}
        </g>
      )}
      {!trailer && (
        <g>
          <path d="m43 79 37-19 36 19-37 20Z" fill="#e2e8f0" />
          <path d="m79 99 37-20v30l-15 8-4-8-9 4-5 13-4 2Z" fill={`url(#${id}-body)`} />
          <path d="m43 79 36 20v29l-39-21V96Z" fill="#a2b2c5" />
          <path d="m45 84 29 16v14L43 98Z" fill={`url(#${id}-glass)`} />
          <path d="m83 99 25-13v14l-25 13Z" fill={`url(#${id}-glass)`} />
          <path d="m46 87 23 13" stroke="#a5c9e2" opacity=".6" />
          <path d="m44 109 30 16v-6l-30-16Z" fill="#243548" />
          <path d="m41 107 7 4v4l-7-4Zm27 14 8 4v4l-8-4Z" fill="#fff5ca" />
          <path d="m40 116 37 19v-6l-37-20Z" fill="#718096" />
          <path d="m85 116 5-2" stroke="#334155" strokeWidth="2" />
          <path
            d="m38 93-4 2v9m78-14 5-2v9"
            fill="none"
            stroke="#8b9bad"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
