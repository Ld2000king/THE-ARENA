/* ============================================================================
   הזירה — נתוני המפלצות + מחולל הציורים (SVG)
   כל מפלצת מצוירת פרוצדורלית מרכיבים: גוף, עיניים, קרניים, פה ותוספות.
   ============================================================================ */

/* ---------------- יכולות ---------------- */
const ABILITIES = {
    none: {
        name: 'טהור',
        desc: 'ללא יכולת מיוחדת — רק כוח גולמי',
        icon: '<path d="M12 3 L20 12 L12 21 L4 12 Z"/>',
        tone: 'muted'
    },
    weaken: {
        name: 'מחליש',
        desc: 'מוריד ליריב 2 נקודות כוח',
        icon: '<path d="M12 4 V19 M6 13 L12 19 L18 13"/>',
        tone: 'red'
    },
    boost: {
        name: 'זעם',
        desc: 'מוסיף לעצמו 3 נקודות כוח',
        icon: '<path d="M12 20 V5 M6 11 L12 5 L18 11"/>',
        tone: 'orange'
    },
    tie: {
        name: 'עקשן',
        desc: 'מנצח גם בתיקו',
        icon: '<path d="M4 9 H20 M4 15 H20"/>',
        tone: 'blue'
    },
    steal: {
        name: 'גנב',
        desc: 'בניצחון — גונב קלף נוסף מהיריב',
        icon: '<path d="M20 12a8 8 0 1 1-3-6.2 M20 4 V9 H15"/>',
        tone: 'purple'
    },
    underdog: {
        name: 'נועז',
        desc: 'אם כוחו נמוך מהיריב — מקבל 4 נקודות',
        icon: '<path d="M13 3 L5 13 H11 L10 21 L19 10 H12 Z"/>',
        tone: 'gold'
    },
    nullify: {
        name: 'מבטל',
        desc: 'מבטל את יכולת היריב',
        icon: '<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5 L17.5 17.5"/>',
        tone: 'pink'
    },
    shield: {
        name: 'מגן',
        desc: 'בהפסד — הקלף חוזר לחפיסה שלך',
        icon: '<path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z"/>',
        tone: 'green'
    },
    vampire: {
        name: 'ערפד',
        desc: 'גונב מהיריב נקודת כוח אחת',
        icon: '<path d="M12 3 C12 3 5 11 5 15 A7 7 0 0 0 19 15 C19 11 12 3 12 3 Z"/>',
        tone: 'pink'
    }
};

/* ---------------- מחולל הציור ---------------- */

const BODIES = {
    blob: c => `<path d="M50 12c21 0 35 14 35 33 0 23-15 43-35 43S15 68 15 45c0-19 14-33 35-33z" fill="${c}"/>`,
    dome: c => `<path d="M50 15c21 0 34 19 34 40 0 12-6 20-13 20-6 0-7-7-13-7s-7 7-13 7c-7 0-13-8-13-20 0-21 13-40 18-40z" fill="${c}"/>`,
    tall: c => `<path d="M50 10c15 0 25 11 25 26v30c0 13-10 22-25 22s-25-9-25-22V36c0-15 10-26 25-26z" fill="${c}"/>`,
    spiky: c => `<path d="M50 8 L62 22 L80 18 L76 36 L90 48 L74 58 L78 76 L60 74 L50 90 L40 74 L22 76 L26 58 L10 48 L24 36 L20 18 L38 22 Z" fill="${c}"/>`,
    crystal: c => `<path d="M50 8 L84 40 L68 88 H32 L16 40 Z" fill="${c}"/>`,
    ghost: c => `<path d="M50 12c19 0 32 14 32 33v37l-8-7-8 7-8-7-8 7-8-7-8 7-8-7V45c0-19 13-33 24-33z" fill="${c}"/>`,
    wide: c => `<path d="M50 20c25 0 40 12 40 30S75 88 50 88 10 68 10 50s15-30 40-30z" fill="${c}"/>`,
    beast: c => `<path d="M50 16c22 0 36 13 36 30 0 14-8 24-20 28l2 12h-9l-2-10h-14l-2 10h-9l2-12C22 70 14 60 14 46c0-17 14-30 36-30z" fill="${c}"/>`
};

function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, v));
    const r = cl((n >> 16) + amt), g = cl(((n >> 8) & 255) + amt), b = cl((n & 255) + amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hornsSVG(kind, c) {
    switch (kind) {
        case 'twin':
            return `<path d="M30 30 L18 4 L44 24 Z" fill="${c}"/><path d="M70 30 L82 4 L56 24 Z" fill="${c}"/>`;
        case 'crown':
            return `<path d="M22 34 L26 12 L36 30 Z" fill="${c}"/><path d="M44 28 L50 4 L56 28 Z" fill="${c}"/>
                    <path d="M64 30 L74 12 L78 34 Z" fill="${c}"/>`;
        case 'antenna':
            return `<path d="M38 26 C32 12 28 8 24 6" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>
                    <circle cx="23" cy="5" r="6" fill="${c}"/>
                    <path d="M62 26 C68 12 72 8 76 6" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>
                    <circle cx="77" cy="5" r="6" fill="${c}"/>`;
        case 'single':
            return `<path d="M50 26 L42 4 L58 4 Z" fill="${c}"/>`;
        case 'ears':
            return `<path d="M26 34 C14 26 10 12 20 12 C28 12 32 24 34 32 Z" fill="${c}"/>
                    <path d="M74 34 C86 26 90 12 80 12 C72 12 68 24 66 32 Z" fill="${c}"/>`;
        default: return '';
    }
}

function eyesSVG(n, style, accent) {
    const sclera = style === 'glow' ? accent : '#F4F6FA';
    const pupil = '#15171d';
    const eye = (x, y, r) => style === 'slit'
        ? `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.2}" fill="${sclera}"/>
           <ellipse cx="${x}" cy="${y}" rx="${r * 0.22}" ry="${r * 0.95}" fill="${pupil}"/>`
        : `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.12}" fill="${sclera}"/>
           <circle cx="${x}" cy="${y + r * 0.15}" r="${r * 0.44}" fill="${pupil}"/>
           <circle cx="${x - r * 0.3}" cy="${y - r * 0.4}" r="${r * 0.16}" fill="#ffffff" opacity=".9"/>`;

    let out = '';
    if (n === 1) out = eye(50, 44, 14);
    else if (n === 2) out = eye(37, 44, 10) + eye(63, 44, 10);
    else if (n === 3) out = eye(34, 40, 8) + eye(50, 52, 8) + eye(66, 40, 8);
    else out = eye(36, 37, 7) + eye(64, 37, 7) + eye(36, 55, 7) + eye(64, 55, 7);

    if (style === 'angry') {
        out += `<path d="M28 33 L46 39 M72 33 L54 39" stroke="#15171d" stroke-width="4.5" stroke-linecap="round"/>`;
    }
    return out;
}

function mouthSVG(kind) {
    switch (kind) {
        case 'fangs':
            return `<path d="M34 62 Q50 78 66 62 Z" fill="#1b1016"/>
                    <path d="M39 65 L43 72 L47 65 Z M53 65 L57 73 L61 65 Z" fill="#F4F6FA"/>`;
        case 'grin':
            return `<path d="M34 62 Q50 74 66 62 Z" fill="#1b1016"/>
                    <path d="M42 63 V71 M50 64 V73 M58 63 V71" stroke="#F4F6FA" stroke-width="2.4"/>`;
        case 'zigzag':
            return `<path d="M34 66 L40 60 L46 66 L52 60 L58 66 L64 60" stroke="#1b1016" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
        case 'beak':
            return `<path d="M40 60 H60 L50 74 Z" fill="#E8C24A"/><path d="M40 60 H60" stroke="#1b1016" stroke-width="2"/>`;
        case 'maw':
            return `<ellipse cx="50" cy="68" rx="17" ry="12" fill="#1b1016"/>
                    <path d="M36 63 L40 70 L45 63 L50 71 L55 63 L60 70 L64 63" fill="#F4F6FA"/>`;
        case 'tiny':
            return `<path d="M44 66 Q50 71 56 66" stroke="#1b1016" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
        default: return '';
    }
}

function extraBackSVG(kind, c) {
    switch (kind) {
        case 'wings':
            return `<path d="M22 40 C2 30 0 58 14 68 C18 58 20 48 22 40 Z" fill="${c}" opacity=".85"/>
                    <path d="M78 40 C98 30 100 58 86 68 C82 58 80 48 78 40 Z" fill="${c}" opacity=".85"/>`;
        case 'tail':
            return `<path d="M74 74 C94 76 96 56 84 50" stroke="${c}" stroke-width="8" fill="none" stroke-linecap="round"/>
                    <path d="M84 44 L94 50 L84 56 Z" fill="${c}"/>`;
        case 'aura':
            return `<circle cx="50" cy="50" r="45" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="7 9" opacity=".7"/>`;
        case 'tentacles':
            return `<path d="M30 74 C24 86 18 88 14 84 M50 78 C50 90 46 94 40 92 M70 74 C76 86 82 88 86 84"
                    stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
        case 'shards':
            return `<path d="M14 30 L6 46 L18 44 Z M86 30 L94 46 L82 44 Z M50 4 L44 16 L56 16 Z" fill="${c}" opacity=".8"/>`;
        default: return '';
    }
}

function extraFrontSVG(kind, c) {
    switch (kind) {
        case 'spots':
            return `<circle cx="32" cy="66" r="5" fill="${c}" opacity=".55"/>
                    <circle cx="68" cy="70" r="6.5" fill="${c}" opacity=".55"/>
                    <circle cx="52" cy="80" r="4" fill="${c}" opacity=".55"/>`;
        case 'plates':
            return `<path d="M50 74 H74 M40 82 H66" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`;
        case 'belly':
            return `<ellipse cx="50" cy="72" rx="20" ry="14" fill="${c}" opacity=".45"/>`;
        default: return '';
    }
}

function monsterSVG(a, cls = '') {
    const hi = shade(a.c1, 26);
    return `<svg class="mon ${cls}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${extraBackSVG(a.extra, a.c2)}
        ${hornsSVG(a.horns, a.c2)}
        ${BODIES[a.body](a.c1)}
        <ellipse cx="38" cy="30" rx="16" ry="11" fill="${hi}" opacity=".45" transform="rotate(-18 38 30)"/>
        ${extraFrontSVG(a.front, hi)}
        ${eyesSVG(a.eyes, a.eyeStyle, a.c2)}
        ${mouthSVG(a.mouth)}
    </svg>`;
}

/* ---------------- 20 המפלצות ---------------- */
/* לכל מפלצת: שם, כוח, יכולת, אלמנט (צבע המסגרת) וציור */

const CARD_POOL = [
    { id: 1, name: 'עריץ הכאוס', power: 10, ability: 'none', el: 'red',
      art: { body: 'spiky', c1: '#B3372E', c2: '#F0C24A', eyes: 3, eyeStyle: 'glow', horns: 'crown', mouth: 'maw', extra: 'shards', front: 'plates' } },

    { id: 2, name: 'גורגון הלהבה', power: 9, ability: 'none', el: 'orange',
      art: { body: 'tall', c1: '#A85A1E', c2: '#F2A03C', eyes: 2, eyeStyle: 'angry', horns: 'twin', mouth: 'fangs', extra: 'aura', front: 'belly' } },

    { id: 3, name: 'טיטאן האבן', power: 8, ability: 'shield', el: 'green',
      art: { body: 'beast', c1: '#4F5B52', c2: '#8FCF9E', eyes: 2, eyeStyle: 'glow', horns: 'ears', mouth: 'grin', extra: 'none', front: 'plates' } },

    { id: 4, name: 'מלך העצמות', power: 8, ability: 'weaken', el: 'purple',
      art: { body: 'tall', c1: '#D9D6E0', c2: '#5B4FCF', eyes: 2, eyeStyle: 'glow', horns: 'crown', mouth: 'grin', extra: 'aura', front: 'none' } },

    { id: 5, name: 'דרקונית הקרח', power: 7, ability: 'weaken', el: 'blue',
      art: { body: 'beast', c1: '#4E7FD6', c2: '#BFE4FF', eyes: 2, eyeStyle: 'slit', horns: 'twin', mouth: 'fangs', extra: 'wings', front: 'belly' } },

    { id: 6, name: 'להביור', power: 7, ability: 'boost', el: 'orange',
      art: { body: 'blob', c1: '#C1521C', c2: '#F5C542', eyes: 1, eyeStyle: 'glow', horns: 'none', mouth: 'maw', extra: 'aura', front: 'spots' } },

    { id: 7, name: 'תולעת המעמקים', power: 7, ability: 'vampire', el: 'pink',
      art: { body: 'ghost', c1: '#7A2F52', c2: '#C24E7A', eyes: 4, eyeStyle: 'glow', horns: 'none', mouth: 'maw', extra: 'tentacles', front: 'plates' } },

    { id: 8, name: 'ערפד הליל', power: 6, ability: 'vampire', el: 'purple',
      art: { body: 'tall', c1: '#3B3468', c2: '#C24E7A', eyes: 2, eyeStyle: 'angry', horns: 'ears', mouth: 'fangs', extra: 'wings', front: 'none' } },

    { id: 9, name: 'גולם החלודה', power: 6, ability: 'tie', el: 'orange',
      art: { body: 'beast', c1: '#8F4A16', c2: '#D9A24A', eyes: 1, eyeStyle: 'glow', horns: 'none', mouth: 'zigzag', extra: 'none', front: 'plates' } },

    { id: 10, name: 'עכביש הקריסטל', power: 6, ability: 'steal', el: 'blue',
      art: { body: 'crystal', c1: '#3A65B8', c2: '#9FD8FF', eyes: 4, eyeStyle: 'slit', horns: 'none', mouth: 'tiny', extra: 'tentacles', front: 'none' } },

    { id: 11, name: 'נסיכת הרעל', power: 6, ability: 'nullify', el: 'green',
      art: { body: 'tall', c1: '#147A4A', c2: '#C7F5B0', eyes: 2, eyeStyle: 'slit', horns: 'antenna', mouth: 'tiny', extra: 'aura', front: 'spots' } },

    { id: 12, name: 'עין התהום', power: 5, ability: 'nullify', el: 'purple',
      art: { body: 'blob', c1: '#5B4FCF', c2: '#F0E6A8', eyes: 1, eyeStyle: 'slit', horns: 'none', mouth: 'zigzag', extra: 'tentacles', front: 'none' } },

    { id: 13, name: 'כרישון החול', power: 5, ability: 'boost', el: 'gold',
      art: { body: 'wide', c1: '#C99A2E', c2: '#5A3F12', eyes: 2, eyeStyle: 'angry', horns: 'none', mouth: 'grin', extra: 'tail', front: 'belly' } },

    { id: 14, name: 'שומר השער', power: 5, ability: 'shield', el: 'blue',
      art: { body: 'crystal', c1: '#2F5A9E', c2: '#8FB8F5', eyes: 1, eyeStyle: 'glow', horns: 'single', mouth: 'none', extra: 'aura', front: 'plates' } },

    { id: 15, name: 'פטריון רעל', power: 4, ability: 'weaken', el: 'green',
      art: { body: 'dome', c1: '#2FBE85', c2: '#12432F', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'tiny', extra: 'none', front: 'spots' } },

    { id: 16, name: 'פנטום הערפל', power: 4, ability: 'tie', el: 'blue',
      art: { body: 'ghost', c1: '#7E90B5', c2: '#DCE7FA', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'maw', extra: 'aura', front: 'none' } },

    { id: 17, name: 'גור הלבה', power: 4, ability: 'underdog', el: 'red',
      art: { body: 'beast', c1: '#952B23', c2: '#F5A623', eyes: 2, eyeStyle: 'angry', horns: 'twin', mouth: 'fangs', extra: 'none', front: 'spots' } },

    { id: 18, name: 'שדון הצללים', power: 3, ability: 'steal', el: 'purple',
      art: { body: 'blob', c1: '#2C2740', c2: '#9C4394', eyes: 3, eyeStyle: 'glow', horns: 'ears', mouth: 'grin', extra: 'none', front: 'none' } },

    { id: 19, name: 'בועת הרעם', power: 3, ability: 'boost', el: 'gold',
      art: { body: 'dome', c1: '#E0C24E', c2: '#4A3A08', eyes: 1, eyeStyle: 'angry', horns: 'antenna', mouth: 'zigzag', extra: 'shards', front: 'none' } },

    { id: 20, name: 'זוחל הביצה', power: 2, ability: 'underdog', el: 'green',
      art: { body: 'wide', c1: '#3E7A3A', c2: '#B6E86B', eyes: 3, eyeStyle: 'slit', horns: 'none', mouth: 'zigzag', extra: 'tail', front: 'belly' } }
];
