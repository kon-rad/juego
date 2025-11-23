'use client';

interface GenieSvgProps {
    size?: number;
    className?: string;
}

export default function GenieSvg({ size = 40, className = '' }: GenieSvgProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Genie body - lamp smoke shape */}
            <defs>
                <linearGradient id="genieGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="50%" stopColor="#FFA500" />
                    <stop offset="100%" stopColor="#FFD700" />
                </linearGradient>
                <linearGradient id="genieShadow" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#B8860B" />
                    <stop offset="100%" stopColor="#FFD700" />
                </linearGradient>
                {/* Glow filter */}
                <filter id="genieGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Smoke trail / lower body */}
            <path
                d="M32 58 C28 52, 24 46, 26 40 C28 36, 30 34, 32 32 C34 34, 36 36, 38 40 C40 46, 36 52, 32 58"
                fill="url(#genieShadow)"
                opacity="0.8"
                filter="url(#genieGlow)"
            />

            {/* Body - torso */}
            <ellipse
                cx="32"
                cy="28"
                rx="12"
                ry="10"
                fill="url(#genieGold)"
                filter="url(#genieGlow)"
            />

            {/* Arms crossed */}
            <path
                d="M20 26 C18 24, 16 22, 18 20 C20 18, 24 20, 26 24"
                stroke="url(#genieGold)"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
            />
            <path
                d="M44 26 C46 24, 48 22, 46 20 C44 18, 40 20, 38 24"
                stroke="url(#genieGold)"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
            />

            {/* Head */}
            <circle
                cx="32"
                cy="14"
                r="8"
                fill="url(#genieGold)"
                filter="url(#genieGlow)"
            />

            {/* Turban/hat */}
            <ellipse
                cx="32"
                cy="8"
                rx="7"
                ry="4"
                fill="#B8860B"
            />
            <circle
                cx="32"
                cy="5"
                r="3"
                fill="#FFD700"
            />

            {/* Face - eyes */}
            <ellipse cx="29" cy="13" rx="1.5" ry="2" fill="#1a1a1a" />
            <ellipse cx="35" cy="13" rx="1.5" ry="2" fill="#1a1a1a" />

            {/* Smile */}
            <path
                d="M28 17 Q32 20, 36 17"
                stroke="#1a1a1a"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />

            {/* Sparkles around the genie */}
            <circle cx="12" cy="20" r="1.5" fill="#FFD700" opacity="0.8" />
            <circle cx="52" cy="16" r="1.5" fill="#FFD700" opacity="0.8" />
            <circle cx="18" cy="38" r="1" fill="#FFD700" opacity="0.6" />
            <circle cx="46" cy="42" r="1" fill="#FFD700" opacity="0.6" />
        </svg>
    );
}
