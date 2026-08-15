/* ============================================================================
   הזירה — נתוני המפלצות + מחולל הציורים (SVG)
   כל מפלצת מצוירת פרוצדורלית מרכיבים: גוף, עיניים, קרניים, פה ותוספות.
   ============================================================================ */

/* שליפת קלף לפי מזהה — משמש גם את economy.js וגם את game.js */
const byId = id => CARD_POOL.find(c => c.id === +id);

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
        desc: 'בניצחון — גורם 2 נזק נוסף',
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
        desc: 'בהפסד — סופג 3 נזק פחות',
        icon: '<path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z"/>',
        tone: 'green'
    },
    vampire: {
        name: 'ערפד',
        desc: 'גונב נקודת כוח, ובניצחון מרפא 2 חיים',
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

/* ============================================================================
   מפת השלבים — 50 קרבות מול יריבים, לכל אחד חפיסה משלו
   כל חפיסה: { מזהה קלף: מספר עותקים }, בדיוק 20 קלפים, עד 3 עותקים.
   hp = נקודות החיים של היריב. השחקן תמיד מתחיל עם 20.
   בשלבים המאוחרים עוצמת החפיסה מגיעה לתקרה, ולכן הקושי ממשיך
   לעלות דרך נקודות החיים של היריב.
   ============================================================================ */

const STAGES = [
    { n: 1,  name: 'שוליית הזירה', title: 'המתחיל',       img: 'art/swamp-crawler.jpg',  el: 'green',  hp: 12,
      taunt: 'רק התחלתי להתאמן. אולי תלך לי בקלות?',
      deck: { 20:3, 19:3, 18:3, 17:3, 16:3, 15:3, 12:2 } },

    { n: 2,  name: 'לוחש הביצות',  title: 'מרעיל',        img: 'art/poison-spore.jpg',   el: 'green',  hp: 14,
      taunt: 'הנבגים שלי יכרסמו בכוח שלך.',
      deck: { 20:3, 19:3, 18:3, 17:3, 16:3, 14:3, 12:2 } },

    { n: 3,  name: 'אמן הסופה',    title: 'מטעין',        img: 'art/thunder-orb.jpg',    el: 'gold',   hp: 15,
      taunt: 'הזעם שלי מכפיל את עצמו. אתה מוכן?',
      deck: { 19:3, 18:3, 17:3, 16:3, 15:3, 14:3, 12:2 } },

    { n: 4,  name: 'נזירת הקרח',   title: 'מקפיאה',       img: 'art/ice-dragoness.jpg',  el: 'blue',   hp: 17,
      taunt: 'אקפיא את המפלצות שלך לפני שיספיקו לנשום.',
      deck: { 18:3, 17:3, 16:3, 15:3, 14:3, 13:3, 12:2 } },

    { n: 5,  name: 'צייד החולות',  title: 'הטורף',        img: 'art/sand-shark.jpg',     el: 'gold',   hp: 18,
      taunt: 'החול בולע את החלשים. אתה נראה חלש.',
      deck: { 17:3, 16:3, 15:3, 14:3, 13:3, 12:3, 8:2 } },

    { n: 6,  name: 'לוחש הצללים',  title: 'הגנב',         img: 'art/shadow-orb.jpg',     el: 'purple', hp: 19,
      taunt: 'כל מכה שלי תעלה לך יותר ממה שנדמה לך.',
      deck: { 17:2, 16:3, 15:3, 14:3, 13:3, 12:3, 10:3 } },

    { n: 7,  name: 'מפקד הברזל',   title: 'הבלתי מנוצח',  img: 'art/iron-vanguard.jpg',  el: 'orange', hp: 20,
      taunt: 'השריון שלי לא נשבר. גם לא בתיקו.',
      deck: { 15:3, 14:3, 13:3, 12:3, 11:3, 9:3, 8:2 } },

    { n: 8,  name: 'רוזן הדם',     title: 'מנקז הכוח',    img: 'art/blood-knight.jpg',   el: 'red',    hp: 21,
      taunt: 'כל טיפת כוח שלך — תהיה שלי.',
      deck: { 14:3, 13:3, 12:3, 11:3, 10:3, 8:3, 9:2 } },

    { n: 9,  name: 'מכשף התהום',   title: 'מבטל היכולות', img: 'art/abyss-mage.jpg',     el: 'purple', hp: 21,
      taunt: 'היכולות שלך חסרות משמעות מולי.',
      deck: { 13:3, 12:3, 11:3, 10:3, 9:3, 7:3, 8:2 } },

    { n: 10, name: 'עריץ הזירה',   title: 'אלוף הזירה',   img: 'art/dark-fist.jpg',      el: 'red',    hp: 22,
      taunt: 'הזירה הזאת שלי. תמיד הייתה.',
      deck: { 12:3, 11:3, 10:3, 9:3, 8:3, 6:3, 29:2 } },

    { n: 11, name: 'שומרת הקרח',   title: 'חומת הכפור',   img: 'art/ice-golem.jpg',      el: 'blue',   hp: 22,
      taunt: 'עברת את השער הראשון. עכשיו מתחיל הקושי.',
      deck: { 11:3, 10:3, 9:3, 8:3, 7:3, 5:3, 29:2 } },

    { n: 12, name: 'ארכן הפלדה',   title: 'קורי הברזל',   img: 'art/steel-spider.jpg',   el: 'blue',   hp: 23,
      taunt: 'כבר נלכדת ברשת. פשוט עוד לא שמת לב.',
      deck: { 10:3, 9:3, 8:3, 7:3, 6:3, 4:3, 5:2 } },

    { n: 13, name: 'רוזן הליל',    title: 'צמא הדם',      img: 'art/night-vampire.jpg',  el: 'purple', hp: 23,
      taunt: 'הלילה ארוך, והחיים שלך קצרים.',
      deck: { 9:3, 8:3, 7:3, 6:3, 5:3, 3:3, 27:2 } },

    { n: 14, name: 'שר הערפל',     title: 'העקשן',        img: 'art/mist-phantom.jpg',   el: 'blue',   hp: 24,
      taunt: 'לא תוכל לפגוע במה שלא תצליח לראות.',
      deck: { 8:3, 7:3, 6:3, 5:3, 4:3, 2:3, 27:2 } },

    { n: 15, name: 'אלופת התכלת',  title: 'המגינה',       img: 'art/azure-guardian.jpg', el: 'blue',   hp: 25,
      taunt: 'המגן שלי סופג כל מה שיש לך.',
      deck: { 1:3, 3:3, 4:3, 25:3, 5:3, 6:3, 7:2 } },

    { n: 16, name: 'אשף הארגמן',   title: 'מבטל הכל',     img: 'art/crimson-warlock.jpg', el: 'pink',  hp: 26,
      taunt: 'היכולות שבנית? אני מוחק אותן.',
      deck: { 1:3, 2:3, 3:3, 4:3, 25:3, 5:3, 6:2 } },

    { n: 17, name: 'גור הלהבות',   title: 'הנועז',        img: 'art/lava-cub.jpg',       el: 'red',    hp: 27,
      taunt: 'קטן? אולי. חלש? תבדוק שוב.',
      deck: { 1:3, 21:3, 2:3, 3:3, 4:3, 25:3, 5:2 } },

    { n: 18, name: 'מלך העצמות',   title: 'קוצר הנשמות',  img: 'art/lich-king.jpg',      el: 'purple', hp: 28,
      taunt: 'כל מי שהגיע עד הנה — עצמותיו כאן.',
      deck: { 1:3, 21:3, 2:3, 23:3, 3:3, 4:3, 25:2 } },

    { n: 19, name: 'דרקון הלבה',   title: 'חורבן',        img: 'art/lava-dragon.jpg',    el: 'red',    hp: 30,
      taunt: 'שרפתי זירות שלמות. אתה רק עוד ניצוץ.',
      deck: { 1:3, 21:3, 22:3, 2:3, 23:3, 3:3, 4:2 } },

    { n: 20, name: 'אגרוף האופל',  title: 'אלוף האלופים', img: 'art/shadow-imp.jpg',     el: 'purple', hp: 32,
      taunt: 'עשרים שלבים כדי להגיע אליי. שנייה אחת כדי ליפול.',
      deck: { 1:3, 21:3, 22:3, 2:3, 23:3, 24:3, 3:2 } },

    /* ---- שלבים 21–50: מסע המגינים — הזירה הגדולה ---- */

    { n: 21, name: 'שומרת היער', title: 'המגינה הירוקה', img: 'art/ranger-guard.jpg', el: 'green', hp: 34,
      taunt: 'כל חץ שתשלח בי — ייבלם. כל מכה שתנחית — תוחזר.',
      deck: { 29:3, 1:3, 2:3, 3:3, 4:3, 5:3, 6:2 } },

    { n: 22, name: 'רץ הנצח', title: 'חוצה הזמן', img: 'art/chrono-racer.jpg', el: 'red', hp: 36,
      taunt: 'עד שתבין מה קרה כאן — אני כבר מנצח.',
      deck: { 27:3, 5:3, 6:3, 7:3, 8:3, 9:3, 10:2 } },

    { n: 23, name: 'אלוף הצללים', title: 'יורש הזירה', img: 'art/dark-fist.jpg', el: 'purple', hp: 38,
      taunt: 'כל מי שקדם לי כבר נפל. גם אתה תיפול.',
      deck: { 1:3, 9:3, 10:3, 11:3, 21:3, 22:3, 23:2 } },

    { n: 24, name: 'זקיף הברקים', title: 'שומר הסופה', img: 'art/storm-sentinel.jpg', el: 'orange', hp: 40,
      taunt: 'הרעם שלי מגיע לפני האור. לא תספיק להתכונן.',
      deck: { 28:3, 22:3, 23:3, 24:3, 25:3, 26:3, 27:2 } },

    { n: 25, name: 'מלך הגחלים', title: 'שד האש הקדום', img: 'art/lava-dragon.jpg', el: 'red', hp: 42,
      taunt: 'האש הזאת בערה לפני שנולדת. היא תבער אחריך.',
      deck: { 2:3, 26:3, 27:3, 28:3, 29:3, 30:3, 31:2 } },

    { n: 26, name: 'חצית הזינוק', title: 'ציידת היער', img: 'art/ranger-strike.jpg', el: 'green', hp: 44,
      taunt: 'אני לא מחכה למכה שלך. אני כבר שם.',
      deck: { 30:3, 31:3, 34:3, 35:3, 1:3, 2:3, 3:2 } },

    { n: 27, name: 'הליבה המכנית', title: 'שומר הפלדה', img: 'art/machine-guardian.jpg', el: 'blue', hp: 46,
      taunt: 'בשר וחולשה מול מתכת ותכנון. נחשו מי מנצח.',
      deck: { 31:3, 1:3, 2:3, 3:3, 4:3, 5:3, 6:2 } },

    { n: 28, name: 'אציל הליל', title: 'שותה הנשמות', img: 'art/night-vampire.jpg', el: 'purple', hp: 48,
      taunt: 'כל טיפה שתאבד — תזין אותי.',
      deck: { 8:3, 5:3, 6:3, 7:3, 9:3, 10:3, 11:2 } },

    { n: 29, name: 'נזיר הברק', title: 'אגרופי הסופה', img: 'art/blue-fist-monk.jpg', el: 'blue', hp: 50,
      taunt: 'הרוח שלי מכה לפני שהעין תבחין בתנועה.',
      deck: { 6:3, 9:3, 10:3, 11:3, 21:3, 22:3, 23:2 } },

    { n: 30, name: 'שר הקבר', title: 'אדון העצמות', img: 'art/lich-king.jpg', el: 'purple', hp: 54,
      taunt: 'שלושים שלבים מאחוריך. עכשיו מתחיל הכאב האמיתי.',
      deck: { 4:3, 22:3, 23:3, 24:3, 25:3, 26:3, 27:2 } },

    { n: 31, name: 'כוהן הארגמן', title: 'מוחק הכוחות', img: 'art/crimson-warlock.jpg', el: 'pink', hp: 56,
      taunt: 'היכולות שבנית כל הדרך לכאן? אני פשוט מוחק אותן.',
      deck: { 26:3, 27:3, 28:3, 29:3, 30:3, 31:3, 34:2 } },

    { n: 32, name: 'טיטאן הקרב', title: 'בלתי ניתן לעצירה', img: 'art/titan-prime.jpg', el: 'red', hp: 58,
      taunt: 'תיקו, הפסד — אצלי זה תמיד אותה תוצאה: אני עומד.',
      deck: { 26:3, 30:3, 31:3, 34:3, 35:3, 1:3, 2:2 } },

    { n: 33, name: 'מצביא הברזל', title: 'חומת הפלדה', img: 'art/iron-vanguard.jpg', el: 'orange', hp: 60,
      taunt: 'הצבא שלי לא נסוג. גם אני לא.',
      deck: { 9:3, 1:3, 2:3, 3:3, 4:3, 5:3, 6:2 } },

    { n: 34, name: 'אוריון', title: 'מגן הצדק', img: 'art/orion.jpg', el: 'blue', hp: 62,
      taunt: 'בכל פעם שתפגע בי — אני רק אתחזק. עד סוף התור.',
      deck: { 34:3, 5:3, 6:3, 7:3, 8:3, 9:3, 10:2 } },

    { n: 35, name: 'ארכנית הפלדה', title: 'אורגת המלכודות', img: 'art/steel-spider.jpg', el: 'blue', hp: 64,
      taunt: 'נפלת ברשת הרבה לפני שראית אותה.',
      deck: { 10:3, 9:3, 11:3, 21:3, 22:3, 23:3, 24:2 } },

    { n: 36, name: 'פוסע החשיכה', title: 'המגן השקט', img: 'art/night-warden.jpg', el: 'blue', hp: 66,
      taunt: 'אני שומר על הליל. הליל הזה — שלך.',
      deck: { 25:3, 22:3, 23:3, 24:3, 26:3, 27:3, 28:2 } },

    { n: 37, name: 'רוח האובך', title: 'הבלתי נראה', img: 'art/mist-phantom.jpg', el: 'blue', hp: 68,
      taunt: 'לא תוכל לפגוע במה שלא תצליח לראות. גם לא בתיקו.',
      deck: { 26:3, 27:3, 28:3, 29:3, 30:3, 31:3, 34:2 } },

    { n: 38, name: 'משמידת הוורד', title: 'קוצי הארגמן', img: 'art/rose-destroyer.jpg', el: 'pink', hp: 70,
      taunt: 'כל כוח שתאבד כאן — יפרח אצלי.',
      deck: { 23:3, 30:3, 31:3, 34:3, 35:3, 1:3, 2:2 } },

    { n: 39, name: 'ארכי-מכשף התהום', title: 'שולל הכוחות', img: 'art/abyss-mage.jpg', el: 'purple', hp: 72,
      taunt: 'היכולות שלך? כבר אין להן משמעות מולי.',
      deck: { 11:3, 1:3, 2:3, 3:3, 4:3, 5:3, 6:2 } },

    { n: 40, name: 'נוסה', title: 'מגן האור', img: 'art/nossa.jpg', el: 'gold', hp: 76,
      taunt: 'האור שלי מוחק את היכולת שלך לפני שהיא בכלל תפעל.',
      deck: { 35:3, 5:3, 6:3, 7:3, 8:3, 9:3, 10:2 } },

    { n: 41, name: 'מלך הסאיאן', title: 'עוצמה עולה', img: 'art/saiyan-king.jpg', el: 'blue', hp: 78,
      taunt: 'הזעם שלי גדל בכל תור. שלך רק דועך.',
      deck: { 24:3, 9:3, 10:3, 11:3, 21:3, 22:3, 23:2 } },

    { n: 42, name: 'רוכל הגניבות', title: 'אצבעות קלות', img: 'art/shadow-imp.jpg', el: 'purple', hp: 80,
      taunt: 'לא תרגיש מתי לקחתי לך את הקלף. רק שהוא כבר איננו.',
      deck: { 22:3, 23:3, 24:3, 25:3, 26:3, 27:3, 28:2 } },

    { n: 43, name: 'עריץ החלל', title: 'בולע האורות', img: 'art/void-tyrant.jpg', el: 'purple', hp: 82,
      taunt: 'כל יכולת שתפעיל מולי — נבלעת בחלל שביני לבינך.',
      deck: { 21:3, 26:3, 27:3, 28:3, 29:3, 30:3, 31:2 } },

    { n: 44, name: 'ליבת הרעם', title: 'הברק המתעצם', img: 'art/thunder-orb.jpg', el: 'gold', hp: 84,
      taunt: 'כל מכה שאני סופג — הופכת לברק שיפיל אותך.',
      deck: { 30:3, 31:3, 34:3, 35:3, 1:3, 2:3, 3:2 } },

    { n: 45, name: 'מונרך השמש', title: 'להבת הזוהר', img: 'art/sun-monarch.jpg', el: 'gold', hp: 86,
      taunt: 'תסתכל ישר אליי אם אתה מעז. השמש לא מרחמת.',
      deck: { 22:3, 1:3, 2:3, 3:3, 4:3, 5:3, 6:2 } },

    { n: 46, name: 'פטרון התכלת', title: 'החומה האחרונה', img: 'art/azure-guardian.jpg', el: 'blue', hp: 88,
      taunt: 'עברת ארבעים וחמישה שערים. זה שלי — לא ייפרץ.',
      deck: { 5:3, 6:3, 7:3, 8:3, 9:3, 10:3, 11:2 } },

    { n: 47, name: 'קולוסוס הקרח', title: 'לב הקפאון', img: 'art/ice-golem.jpg', el: 'blue', hp: 90,
      taunt: 'אני עומד כאן מאז שהזירה נבנתה. אתה רק עוד רגע.',
      deck: { 3:3, 9:3, 10:3, 11:3, 21:3, 22:3, 23:2 } },

    { n: 48, name: 'אדון הדם', title: 'צמא הניצחון', img: 'art/blood-knight.jpg', el: 'red', hp: 92,
      taunt: 'כל ניצחון שלי מזין את הבא אחריו. ואני עוד לא שבע.',
      deck: { 7:3, 22:3, 23:3, 24:3, 25:3, 26:3, 27:2 } },

    { n: 49, name: 'אביר הגלקסיה', title: 'שומר הכוכבים', img: 'art/galaxy-knight.jpg', el: 'gold', hp: 98,
      taunt: 'אף אחד לא עובר אותי בלי לשלם מחיר. אף אחד.',
      deck: { 32:3, 21:3, 22:3, 23:3, 24:3, 25:3, 33:2 } },

    { n: 50, name: 'נסיך התהום', title: 'אדון הזירה הנצחי', img: 'art/abyss-prince.jpg', el: 'purple', hp: 112,
      taunt: 'חמישים שלבים. אינספור נופלים. ואני עדיין כאן — תמיד אהיה.',
      deck: { 33:3, 32:3, 21:3, 22:3, 23:3, 24:3, 25:2 } }
];

/* ---------------- 20 המפלצות ---------------- */
/* לכל מפלצת: שם, כוח, יכולת, אלמנט (צבע המסגרת) וציור */

const CARD_POOL = [
    { id: 1, name: 'טאי אגקוף האופל', power: 10, ability: 'none', el: 'purple',
      /* התמונה היא פוסטר דו-קרב; ממסגרים את הלוחם הסגול שמימין */
      img: 'art/dark-fist.jpg', imgPos: '74% 22%',
      art: { body: 'spiky', c1: '#5B4FCF', c2: '#C77BF5', eyes: 2, eyeStyle: 'angry', horns: 'crown', mouth: 'maw', extra: 'shards', front: 'plates' } },

    { id: 2, name: 'דרקון הלבה', power: 9, ability: 'none', el: 'red',
      img: 'art/lava-dragon.jpg', imgPos: 'center 25%',
      art: { body: 'beast', c1: '#8F2A16', c2: '#F56A1E', eyes: 2, eyeStyle: 'angry', horns: 'twin', mouth: 'fangs', extra: 'wings', front: 'plates' } },

    { id: 3, name: 'גולם הקרח', power: 8, ability: 'shield', el: 'blue',
      img: 'art/ice-golem.jpg', imgPos: 'center 28%',
      art: { body: 'beast', c1: '#3F5B72', c2: '#7FE4FF', eyes: 2, eyeStyle: 'glow', horns: 'crown', mouth: 'grin', extra: 'shards', front: 'plates' } },

    { id: 4, name: 'מלך הצללים', power: 8, ability: 'weaken', el: 'purple',
      img: 'art/lich-king.jpg', imgPos: 'center 18%',
      art: { body: 'tall', c1: '#D9D6E0', c2: '#5B4FCF', eyes: 2, eyeStyle: 'glow', horns: 'crown', mouth: 'grin', extra: 'aura', front: 'none' } },

    { id: 5, name: 'אייס נסיכת הקרח', power: 7, ability: 'weaken', el: 'blue',
      img: 'art/ice-dragoness.jpg', imgPos: 'center 12%',
      art: { body: 'beast', c1: '#4E7FD6', c2: '#BFE4FF', eyes: 2, eyeStyle: 'slit', horns: 'twin', mouth: 'fangs', extra: 'wings', front: 'belly' } },

    { id: 6, name: 'קאי אגרוף האור', power: 7, ability: 'boost', el: 'blue',
      img: 'art/blue-fist-monk.jpg', imgPos: 'center 20%',
      art: { body: 'tall', c1: '#E8EAF0', c2: '#4E9FD6', eyes: 2, eyeStyle: 'angry', horns: 'none', mouth: 'grin', extra: 'aura', front: 'none' } },

    { id: 7, name: 'אביר הדם', power: 7, ability: 'vampire', el: 'red',
      img: 'art/blood-knight.jpg', imgPos: 'center 18%',
      art: { body: 'tall', c1: '#2A1620', c2: '#D4324E', eyes: 2, eyeStyle: 'glow', horns: 'crown', mouth: 'grin', extra: 'aura', front: 'plates' } },

    { id: 8, name: 'הרוזן באט', power: 6, ability: 'vampire', el: 'purple',
      img: 'art/night-vampire.jpg', imgPos: 'center 14%',
      art: { body: 'tall', c1: '#3B3468', c2: '#C24E7A', eyes: 2, eyeStyle: 'angry', horns: 'ears', mouth: 'fangs', extra: 'wings', front: 'none' } },

    { id: 9, name: 'דרקון המתכת', power: 6, ability: 'tie', el: 'orange',
      img: 'art/iron-vanguard.jpg', imgPos: 'center 45%',
      art: { body: 'beast', c1: '#A8441E', c2: '#F0C24A', eyes: 1, eyeStyle: 'glow', horns: 'twin', mouth: 'zigzag', extra: 'none', front: 'plates' } },

    { id: 10, name: 'עכביש הפלדה', power: 6, ability: 'steal', el: 'blue',
      img: 'art/steel-spider.jpg', imgPos: 'center 40%',
      art: { body: 'crystal', c1: '#3A65B8', c2: '#9FD8FF', eyes: 4, eyeStyle: 'slit', horns: 'none', mouth: 'tiny', extra: 'tentacles', front: 'none' } },

    { id: 11, name: 'מכשף התהום', power: 6, ability: 'nullify', el: 'purple',
      img: 'art/abyss-mage.jpg', imgPos: 'center 16%',
      art: { body: 'tall', c1: '#241B45', c2: '#A855F7', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'tiny', extra: 'aura', front: 'none' } },

    { id: 12, name: 'אשף הארגמן', power: 5, ability: 'nullify', el: 'pink',
      img: 'art/crimson-warlock.jpg', imgPos: 'center 22%',
      art: { body: 'tall', c1: '#2C2740', c2: '#C24E7A', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'grin', extra: 'aura', front: 'none' } },

    { id: 13, name: 'כרישון החול', power: 5, ability: 'boost', el: 'gold',
      img: 'art/sand-shark.jpg', imgPos: 'center 16%',
      art: { body: 'wide', c1: '#C99A2E', c2: '#5A3F12', eyes: 2, eyeStyle: 'angry', horns: 'none', mouth: 'grin', extra: 'tail', front: 'belly' } },

    { id: 14, name: 'שומר התכלת', power: 5, ability: 'shield', el: 'blue',
      img: 'art/azure-guardian.jpg', imgPos: 'center 20%',
      art: { body: 'tall', c1: '#1E3A6E', c2: '#4FC8FF', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'grin', extra: 'aura', front: 'plates' } },

    { id: 15, name: 'פטריון רעל', power: 4, ability: 'weaken', el: 'green',
      img: 'art/poison-spore.jpg', imgPos: 'center 40%',
      art: { body: 'dome', c1: '#2FBE85', c2: '#12432F', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'tiny', extra: 'none', front: 'spots' } },

    { id: 16, name: 'פנטום הערפל', power: 4, ability: 'tie', el: 'blue',
      img: 'art/mist-phantom.jpg', imgPos: 'center 30%',
      art: { body: 'ghost', c1: '#7E90B5', c2: '#DCE7FA', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'maw', extra: 'aura', front: 'none' } },

    { id: 17, name: 'גור הלבה', power: 4, ability: 'underdog', el: 'red',
      img: 'art/lava-cub.jpg', imgPos: 'center 40%',
      art: { body: 'beast', c1: '#952B23', c2: '#F5A623', eyes: 2, eyeStyle: 'angry', horns: 'twin', mouth: 'fangs', extra: 'none', front: 'spots' } },

    { id: 18, name: 'שדון הצללים', power: 3, ability: 'steal', el: 'purple',
      img: 'art/shadow-imp.jpg', imgPos: 'center 28%',
      art: { body: 'blob', c1: '#2C2740', c2: '#9C4394', eyes: 3, eyeStyle: 'glow', horns: 'ears', mouth: 'grin', extra: 'none', front: 'none' } },

    { id: 19, name: 'בועת הרעם', power: 3, ability: 'boost', el: 'gold',
      img: 'art/thunder-orb.jpg', imgPos: 'center 40%',
      art: { body: 'dome', c1: '#E0C24E', c2: '#4A3A08', eyes: 1, eyeStyle: 'angry', horns: 'antenna', mouth: 'zigzag', extra: 'shards', front: 'none' } },

    { id: 20, name: 'זוחל הביצה', power: 2, ability: 'underdog', el: 'green',
      img: 'art/swamp-crawler.jpg', imgPos: 'center 38%',
      art: { body: 'wide', c1: '#3E7A3A', c2: '#B6E86B', eyes: 3, eyeStyle: 'slit', horns: 'none', mouth: 'zigzag', extra: 'tail', front: 'belly' } },

    /* ---- גל שני: לוחמי הזירה ---- */

    { id: 21, name: 'דארק לורד האופל', power: 10, ability: 'nullify', el: 'purple',
      img: 'art/void-tyrant.jpg', imgPos: 'center 22%',
      art: { body: 'spiky', c1: '#4A2A5E', c2: '#E060E8', eyes: 3, eyeStyle: 'glow', horns: 'crown', mouth: 'maw', extra: 'aura', front: 'plates' } },

    { id: 22, name: 'סאן לוחם השמש', power: 10, ability: 'boost', el: 'gold',
      img: 'art/sun-monarch.jpg', imgPos: 'center 14%',
      art: { body: 'tall', c1: '#D9A82E', c2: '#FFF0A8', eyes: 2, eyeStyle: 'glow', horns: 'crown', mouth: 'grin', extra: 'aura', front: 'plates' } },

    { id: 23, name: 'מונרה המשמיד', power: 9, ability: 'vampire', el: 'pink',
      img: 'art/rose-destroyer.jpg', imgPos: 'center 12%',
      art: { body: 'tall', c1: '#2A1C33', c2: '#F58AB8', eyes: 2, eyeStyle: 'angry', horns: 'none', mouth: 'grin', extra: 'aura', front: 'none' } },

    { id: 24, name: ' פירס מלך הסאיאן', power: 9, ability: 'boost', el: 'blue',
      img: 'art/saiyan-king.jpg', imgPos: 'center 20%',
      art: { body: 'tall', c1: '#8E2036', c2: '#5FD8FF', eyes: 2, eyeStyle: 'angry', horns: 'none', mouth: 'grin', extra: 'aura', front: 'plates' } },

    { id: 25, name: 'שומר הלילה', power: 8, ability: 'shield', el: 'blue',
      img: 'art/night-warden.jpg', imgPos: 'center 22%',
      art: { body: 'beast', c1: '#242B3E', c2: '#E8C24A', eyes: 2, eyeStyle: 'glow', horns: 'twin', mouth: 'grin', extra: 'wings', front: 'plates' } },

    { id: 26, name: 'טיטאן פריים', power: 8, ability: 'tie', el: 'red',
      img: 'art/titan-prime.jpg', imgPos: 'center 12%',
      art: { body: 'tall', c1: '#B3232E', c2: '#4FA8FF', eyes: 2, eyeStyle: 'glow', horns: 'twin', mouth: 'none', extra: 'aura', front: 'plates' } },

    { id: 27, name: 'האצן', power: 7, ability: 'steal', el: 'red',
      img: 'art/chrono-racer.jpg', imgPos: 'center 20%',
      art: { body: 'tall', c1: '#B32E3E', c2: '#8F7BF5', eyes: 2, eyeStyle: 'angry', horns: 'none', mouth: 'grin', extra: 'aura', front: 'none' } },

    { id: 28, name: 'איירון ספארק', power: 7, ability: 'weaken', el: 'orange',
      img: 'art/storm-sentinel.jpg', imgPos: 'center 20%',
      art: { body: 'tall', c1: '#2E3A5E', c2: '#F5A02E', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'none', extra: 'aura', front: 'plates' } },

    /* שני הקלפים הבאים חולקים שם — אותה דמות בשתי פוזות, ויכולות שונות.
       זהו הזוג היחיד במשחק עם שם זהה, ולכן שדה variant מבדיל ביניהם. */
    { id: 29, name: 'קשתית האמרלד', variant: 'עמידת מגן', power: 6, ability: 'shield', el: 'green',
      img: 'art/ranger-guard.jpg', imgPos: 'center 18%',
      art: { body: 'tall', c1: '#1F5E42', c2: '#6BF5A0', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'none', extra: 'aura', front: 'plates' } },

    { id: 30, name: 'קשתית האמרלד', variant: 'זינוק תקיפה', power: 6, ability: 'underdog', el: 'green',
      img: 'art/ranger-strike.jpg', imgPos: 'center 20%',
      art: { body: 'tall', c1: '#1F5E42', c2: '#9BFF6B', eyes: 2, eyeStyle: 'angry', horns: 'none', mouth: 'none', extra: 'wings', front: 'none' } },

    /* ---- גל שלישי ---- */

    { id: 31, name: 'העכביש הרובוטי', power: 7, ability: 'steal', el: 'blue',
      img: 'art/machine-guardian.jpg', imgPos: 'center 15%',
      art: { body: 'tall', c1: '#1B2436', c2: '#3FA8E8', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'none', extra: 'tentacles', front: 'plates' } },

    /* ---- גל רביעי: מגני האור ---- */

    { id: 34, name: 'אוריון', power: 7, ability: 'shield', el: 'blue',
      img: 'art/orion.jpg', imgPos: 'center 18%',
      art: { body: 'tall', c1: '#2B4A7E', c2: '#E8EEF7', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'none', extra: 'aura', front: 'plates' } },

    { id: 35, name: 'נובה', power: 8, ability: 'nullify', el: 'gold',
      img: 'art/nossa.jpg', imgPos: 'center 16%',
      art: { body: 'tall', c1: '#1A1A1E', c2: '#F5D02E', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'none', extra: 'shards', front: 'plates' } },

    /* ---- גל חמישי ---- */

    { id: 36, name: 'נסיך הסאיאן', power: 8, ability: 'boost', el: 'blue',
      img: 'art/saiyan-prince.jpg', imgPos: 'center 16%',
      art: { body: 'tall', c1: '#1C3F72', c2: '#9FE0FF', eyes: 2, eyeStyle: 'angry', horns: 'none', mouth: 'grin', extra: 'aura', front: 'plates' } },

    { id: 37, name: 'טאי אגרוף האור', power: 10, ability: 'boost', el: 'gold',
      /* אותו פוסטר דו-קרב כמו קלף 1 (dark-fist.jpg); ממסגרים הפעם את הלוחם הזהוב שמשמאל */
      img: 'art/dark-fist.jpg', imgPos: '22% 20%',
      art: { body: 'spiky', c1: '#7A4A14', c2: '#F5C24E', eyes: 2, eyeStyle: 'angry', horns: 'crown', mouth: 'maw', extra: 'shards', front: 'plates' } },

    { id: 38, name: 'אורג הקורים', power: 8, ability: 'steal', el: 'blue',
      img: 'art/web-weaver.jpg', imgPos: 'center 18%',
      art: { body: 'tall', c1: '#151B2E', c2: '#4FA8FF', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'none', extra: 'aura', front: 'plates' } },

    /* ---- אולטרה נדיר: לא מוגרלים בתיבות, נקנים בחנות במחיר גבוה בלבד ---- */

    { id: 32, name: 'לומינוס מאיר השמיים', power: 13, ability: 'shield', el: 'gold', ultra: true,
      img: 'art/galaxy-knight.jpg', imgPos: '68% 35%',
      art: { body: 'tall', c1: '#E8ECFB', c2: '#E0B24A', eyes: 2, eyeStyle: 'glow', horns: 'none', mouth: 'none', extra: 'wings', front: 'plates' } },

    { id: 33, name: 'אכזר האפל', power: 14, ability: 'nullify', el: 'purple', ultra: true,
      img: 'art/abyss-prince.jpg', imgPos: 'center 15%',
      art: { body: 'tall', c1: '#1A1622', c2: '#C4324E', eyes: 2, eyeStyle: 'angry', horns: 'none', mouth: 'grin', extra: 'wings', front: 'plates' } }
];
