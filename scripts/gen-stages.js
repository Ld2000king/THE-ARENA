/* מחולל שלבים 51–150: מריץ פעם אחת כדי לייצר קוד JS שמודבק ל-STAGES
   ב-monsters.js. אינו חלק מהמשחק בזמן ריצה — כלי בנייה חד-פעמי. */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'monsters.js'), 'utf8');
const { STAGES, CARD_POOL } = new Function(src + '; return {STAGES, CARD_POOL};')();

const byId = id => CARD_POOL.find(c => c.id === id);

/* ---- טקסטי גל שני (51–100, "חוזרים לזירה") וגל שלישי (101–150, "הצורה האמיתית") ---- */
const LAP1_TITLES = [
    'השב לזירה', 'הניצול', 'הגרסה המחוזקת', 'צלקת הזירה', 'האפר שקם לתחייה',
    'הזעם שגדל', 'הניצחון שלא נשכח', 'נוקם השבר', 'הצל ששרד', 'המהדורה הקטלנית',
    'עוצמה שלא נבדקה', 'האש שלא כבתה', 'משועבד לזירה', 'המחיר שהוכפל', 'צליין הנקמה',
    'הכוח שלא נשבר', 'הענק ששב', 'אלוף שלא נשכח', 'המסע השני', 'עדיין כאן'
];
const LAP2_TITLES = [
    'הצורה האמיתית', 'האגדה הקדומה', 'השיא האחרון', 'הגרסה הבלתי אפשרית', 'מלך שלא נופל',
    'אימת הזירה', 'המהות המוחלטת', 'עוצמת האינסוף', 'הדרגה העליונה', 'אימה חיה',
    'הכוח שלא נבדק', 'צל שאין לו קץ', 'אלוהי הזירה הקטן', 'השבר הבלתי אפשרי', 'האש שאין לה סוף',
    'המלכוד המושלם', 'הענק שאין לעצור', 'המוות המושהה', 'הגורל האחרון', 'שיא הזירה'
];

const TAUNTS = [
    'חשבתם שניצחתם אותי? זה היה רק החימום.',
    'בפעם שעברה חסכתי בכוח. הפעם לא.',
    'הזירה מזינה אותי מחדש בכל פעם שאני נופל.',
    'למדתי כל מה שעשית לי. עכשיו התור שלי.',
    'אתם עדיין אותו דבר. אני כבר לא.',
    'כל הפסד שלי כאן היה רק אימון.',
    'הפעם לא תצאו מזה בקלות.',
    'תשאלו את מי שכבר ניסה לעצור אותי.',
    'הכוח שלי גדל בכל פעם שאני שב לכאן.',
    'לא באתי להפסיד שוב.',
    'הפעם הראשונה הייתה טעות שלי. השנייה תהיה שלכם.',
    'אני זוכר כל מכה שספגתי. עכשיו אחזיר את כולן.',
    'הזירה הזאת שינתה אותי. לרעתכם.',
    'עברתי דרך האש כדי לחזור לכאן.',
    'לא תזהו אותי הפעם.',
    'מי שנפל פעם — קם חזק יותר.',
    'הפסד אחד לא מגדיר לוחם. תשעה עשויים.',
    'הגעתי רחוק מדי כדי לעצור עכשיו.',
    'תכינו את עצמכם. אני כבר לא הצל שהייתי.',
    'כל שלב שעברתם — עוד לוחם שהתחזק.',
    'חזרתי. וזה יעלה לכם ביוקר.',
    'הזמן ביני לביניכם עבד לטובתי.',
    'לא נותר בי דבר מהלוחם שהכרתם.',
    'הפעם הזאת תיגמר אחרת.',
    'אני לא כאן כדי לזכור. אני כאן כדי לנצח.',
    'ספרו את הצלקות. הן שלכם, לא שלי.',
    'עוד סיבוב. עוד הזדמנות לכם לטעות.',
    'מי ששרד את הזירה — לא חוזר אותו הדבר.',
    'תראו מה נשאר כשמפסידים מספיק פעמים ולא שוברים.',
    'זו לא נקמה. זו רק תוצאה טבעית.',
    'הכוח האמיתי שלי עוד לא ראיתם.',
    'אתם עדיין חושבים שזה אותו קרב?',
    'כל דור בזירה חזק מקודמו. גם אני.',
    'לא אתן לכם עוד סיכוי שני.',
    'הגעתי לשיא שלי. אתם עדיין בדרך לשלכם.',
    'הזירה לא שוכחת אף לוחם. גם לא אני.',
    'תתכוננו. הצורה הזאת אתם עוד לא פגשתם.',
    'אני התהום שממנה עליתם. עכשיו תרדו אליי.',
    'כל שיא שקבעתם — אני עומד לשבור.',
    'זה הסוף שלכם, לא ההתחלה שלי.'
];

const LAP1_TAUNT_OFFSET = 0;
const LAP2_TAUNT_OFFSET = 17;

function pick(arr, i, offset = 0) { return arr[(i + offset) % arr.length]; }

/* ---- עקומת חיים: המשך אקספוננציאלי מ-112 (שלב 50), עם בונוס
   לאבני דרך (כל 10) ובונוס גדול לבוס הסופי (150) ---- */
function hpFor(n) {
    /* בלי בונוס-אבן-דרך מוכפל: הוא היה גורם לירידת חיים מיד אחרי כל
       אבן דרך (השלב הבא חוזר לעקומה הרגילה ונמוך מהקודם) — התקדמות
       חייבת להיות מונוטונית עולה. בונוס נשאר רק לבוס הסופי (150),
       שאין אחריו שלב שצריך "לחזור" ממנו. */
    const base = 112 * Math.pow(1.025, n - 50);
    const finalBonus = (n === 150) ? 1.2 : 1;
    return Math.round(base * finalBonus / 2) * 2; // עיגול לזוגי, נקי יותר לעין
}

/* ---- תבניות חפיסה לשלב מתקדם: משלבות קלפי עוצמה (1–11, 21–39)
   ואולטרה (32/33) בהדרגה גוברת ---- */
const DECK_TEMPLATES = [
    { 21:3, 22:3, 23:3, 24:3, 25:3, 26:3, 27:2 },
    { 22:3, 23:3, 24:3, 25:3, 26:3, 27:3, 28:2 },
    { 21:3, 26:3, 27:3, 28:3, 29:3, 30:3, 31:2 },
    { 30:3, 31:3, 34:3, 35:3, 1:3, 2:3, 3:2 },
    { 22:3, 1:3, 2:3, 3:3, 4:3, 5:3, 6:2 },
    { 5:3, 6:3, 7:3, 8:3, 9:3, 10:3, 11:2 },
    { 3:3, 9:3, 10:3, 11:3, 21:3, 22:3, 23:2 },
    { 7:3, 22:3, 23:3, 24:3, 25:3, 26:3, 27:2 },
    { 24:3, 9:3, 10:3, 11:3, 21:3, 22:3, 23:2 },
    { 36:3, 37:3, 38:3, 39:3, 21:3, 22:3, 23:2 },
    { 34:3, 35:3, 36:3, 37:3, 38:3, 39:3, 1:2 },
    { 1:3, 2:3, 7:3, 22:3, 23:3, 24:3, 25:2 },
    { 32:3, 21:3, 22:3, 23:3, 24:3, 25:3, 33:2 },
    { 33:3, 32:3, 21:3, 22:3, 23:3, 24:3, 25:2 },
    { 32:3, 33:3, 26:3, 27:3, 28:3, 36:3, 37:2 },
];

function deckFor(n, templateIdx) {
    const t = DECK_TEMPLATES[templateIdx % DECK_TEMPLATES.length];
    return t;
}

function validateDeck(deck) {
    let total = 0;
    for (const [id, count] of Object.entries(deck)) {
        if (!byId(+id)) throw new Error(`deck references missing card id ${id}`);
        if (count > 3) throw new Error(`deck copies >3 for id ${id}`);
        total += count;
    }
    if (total !== 20) throw new Error(`deck total ${total} !== 20`);
}

const lines = [];
let templateCursor = 0;

for (let n = 51; n <= 150; n++) {
    const lap = n <= 100 ? 1 : 2;
    const baseN = lap === 1 ? n - 50 : n - 100; // 1..50, points back to original stage
    const base = STAGES.find(s => s.n === baseN);
    if (!base) throw new Error(`no base stage for n=${n} (baseN=${baseN})`);

    const idx = baseN - 1; // 0..49 for title/taunt cycling
    const title = lap === 1 ? pick(LAP1_TITLES, idx) : pick(LAP2_TITLES, idx);
    const taunt = lap === 1
        ? pick(TAUNTS, idx, LAP1_TAUNT_OFFSET)
        : pick(TAUNTS, idx, LAP2_TAUNT_OFFSET);

    // גל 2 (101–150) מטה יותר לכיוון חפיסות עם אולטרה/קלפים חדשים
    const templatePool = lap === 1 ? templateCursor : templateCursor + 3;
    const deck = deckFor(n, templatePool);
    validateDeck(deck);
    templateCursor++;

    const hp = hpFor(n);

    const deckStr = Object.entries(deck).map(([id, c]) => `${id}:${c}`).join(', ');
    const escName = base.name.replace(/'/g, "\\'");
    const escTaunt = taunt.replace(/'/g, "\\'");

    lines.push(
`    { n: ${n}, name: '${escName}', title: '${title}', img: '${base.img}', el: '${base.el}', hp: ${hp},\n` +
`      taunt: '${escTaunt}',\n` +
`      deck: { ${deckStr} } }`
    );
}

const out = lines.join(',\n\n') + '\n';
const outPath = 'C:/Users/liavd/AppData/Local/Temp/claude/C--Users-liavd-Desktop-PIC-ARENA-GAME/afa10f39-7688-4481-9f7e-50b9c4c5ebd4/scratchpad/generated_stages_51_150.txt';
fs.writeFileSync(outPath, out, 'utf8');
console.log('Generated', lines.length, 'stages ->', outPath);
console.log('HP range:', hpFor(51), '...', hpFor(100), '...', hpFor(150));
