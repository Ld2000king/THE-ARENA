/* ============================================================================
   הזירה — כלכלה: נדירות, חנות, תיבות ופרופיל שחקן
   הכל נשמר מקומית בדפדפן. אין שרת, אין תשלום אמיתי.
   ============================================================================ */

const DECK_SIZE = 15;
const MAX_COPIES = 3;
const START_HP = 20;
const HAND_SIZE = 5;        // גודל היד ב"קרב מפלצות"
const COINS_PER_WIN = 10;
const CHEST_SLOTS = 4;
const ADMIN_NAME = 'ld2000';

const PROFILE_KEY = 'zira-profile-v2';

/* ---------------- נדירות ---------------- */
/* הנדירות נגזרת מרמת הכוח — קלף חזק יותר הוא גם נדיר יותר */
/* המחירים מכוילים מול קצב ההכנסה: 10 מטבעות לניצחון,
   50 על סיום ראשון של שלב, ועוד מטבעות מהתיבות */
const RARITIES = {
    common:    { name: 'רגיל',  tone: 'muted',  price: 40,  dust: 1 },
    rare:      { name: 'נדיר',  tone: 'blue',   price: 110, dust: 2 },
    epic:      { name: 'אפי',   tone: 'purple', price: 280, dust: 4 },
    legendary: { name: 'אגדי',  tone: 'gold',   price: 600, dust: 8 }
};

const FIRST_CLEAR_COINS = 50;

function rarityOf(card) {
    if (card.power >= 9) return 'legendary';
    if (card.power >= 7) return 'epic';
    if (card.power >= 5) return 'rare';
    return 'common';
}

function cardPrice(card) {
    return RARITIES[rarityOf(card)].price;
}

/* ---------------- תיבות ---------------- */
/* ככל שסיכויי הנדירות טובים יותר — זמן הפתיחה ארוך יותר */
const CHEST_TYPES = {
    wood: {
        key: 'wood', name: 'תיבת עץ', hours: 0.25, el: 'green',
        cards: 3, coins: [20, 40],  gems: [0, 0],
        odds: { common: 0.82, rare: 0.16, epic: 0.02, legendary: 0 }
    },
    iron: {
        key: 'iron', name: 'תיבת ברזל', hours: 1, el: 'blue',
        cards: 4, coins: [50, 90], gems: [0, 1],
        odds: { common: 0.60, rare: 0.30, epic: 0.09, legendary: 0.01 }
    },
    gold: {
        key: 'gold', name: 'תיבת זהב', hours: 3, el: 'gold',
        cards: 5, coins: [120, 200], gems: [1, 3],
        odds: { common: 0.35, rare: 0.40, epic: 0.20, legendary: 0.05 }
    },
    diamond: {
        key: 'diamond', name: 'תיבת יהלום', hours: 8, el: 'purple',
        cards: 6, coins: [250, 400], gems: [3, 6],
        odds: { common: 0.10, rare: 0.35, epic: 0.40, legendary: 0.15 }
    }
};

/* יהלום אחד לכל 8 דקות המתנה שנותרו, מינימום 1 */
function skipCost(msLeft) {
    return Math.max(1, Math.ceil(msLeft / (8 * 60 * 1000)));
}

function chestReadyAt(typeKey, from = Date.now()) {
    return from + CHEST_TYPES[typeKey].hours * 3600 * 1000;
}

/* התיבה שמגיעה על ניצחון — משתפרת ככל שמתקדמים במפה */
function chestForStage(stageNumber) {
    const r = Math.random();
    if (stageNumber >= 15) return r < 0.35 ? 'diamond' : (r < 0.75 ? 'gold' : 'iron');
    if (stageNumber >= 10) return r < 0.15 ? 'diamond' : (r < 0.55 ? 'gold' : 'iron');
    if (stageNumber >= 5)  return r < 0.35 ? 'gold' : (r < 0.8 ? 'iron' : 'wood');
    return r < 0.25 ? 'iron' : 'wood';
}

/* ---------------- הגרלת קלף לפי נדירות ---------------- */
function rollRarity(odds) {
    let r = Math.random();
    for (const key of ['legendary', 'epic', 'rare', 'common']) {
        const p = odds[key] || 0;
        if (r < p) return key;
        r -= p;
    }
    return 'common';
}

function rollCard(odds) {
    const rarity = rollRarity(odds);
    const pool = CARD_POOL.filter(c => rarityOf(c) === rarity);
    // אם אין קלפים בנדירות שיצאה, יורדים מדרגה כדי שתמיד יצא משהו
    const safe = pool.length ? pool : CARD_POOL;
    return safe[Math.floor(Math.random() * safe.length)];
}

function randBetween([lo, hi]) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/* פותח תיבה ומחזיר את השלל */
function openChestRewards(typeKey) {
    const t = CHEST_TYPES[typeKey];
    const cards = [];
    for (let i = 0; i < t.cards; i++) cards.push(rollCard(t.odds));
    return { cards, coins: randBetween(t.coins), gems: randBetween(t.gems) };
}

/* ---------------- פרופיל השחקן ---------------- */

function starterOwned() {
    // מספיק קלפים לבנות חפיסה של 15, מהקלפים החלשים
    return { 20:3, 19:3, 18:3, 17:3, 16:3, 15:2, 14:2, 13:2 };
}

/* החפיסה הפותחת בנויה מהקלפים הטובים שכבר בבעלות (כוח 61),
   כך שהשלב הראשון הוא ניצחון ברור ולא הטלת מטבע */
function starterDeck() {
    return { 13:2, 14:2, 15:2, 16:3, 17:3, 18:3 };
}

function blankProfile() {
    return {
        name: '',
        coins: 200,
        gems: 5,
        owned: starterOwned(),
        deck: starterDeck(),
        cleared: 0,
        chests: new Array(CHEST_SLOTS).fill(null),  // { type, readyAt } או null
        wins: 0,
        losses: 0
    };
}

function isAdmin(profile) {
    return (profile.name || '').trim().toLowerCase() === ADMIN_NAME;
}

/* לאדמין אין מגבלת מטבעות ויהלומים */
function coinsOf(profile) { return isAdmin(profile) ? Infinity : profile.coins; }
function gemsOf(profile)  { return isAdmin(profile) ? Infinity : profile.gems; }

/* הבעלות האפקטיבית: לאדמין יש 3 עותקים מכל קלף במשחק.
   מחושב בכל פעם ולא נשמר, כדי ששינוי שם בחזרה לשחקן רגיל
   לא ישאיר את האוסף המלא. */
function ownedOf(profile) {
    if (!isAdmin(profile)) return profile.owned;
    const all = {};
    CARD_POOL.forEach(c => { all[c.id] = MAX_COPIES; });
    return all;
}

function spendCoins(profile, amount) {
    if (isAdmin(profile)) return true;
    if (profile.coins < amount) return false;
    profile.coins -= amount;
    return true;
}

function spendGems(profile, amount) {
    if (isAdmin(profile)) return true;
    if (profile.gems < amount) return false;
    profile.gems -= amount;
    return true;
}

function loadProfile() {
    let p;
    try { p = JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch (e) { p = null; }
    const base = blankProfile();
    if (!p || typeof p !== 'object') return base;

    // מיזוג זהיר: פרופיל ישן או פגום לא יפיל את המשחק
    const out = { ...base, ...p };
    out.owned = (p.owned && typeof p.owned === 'object') ? p.owned : base.owned;
    out.deck  = (p.deck  && typeof p.deck  === 'object') ? p.deck  : base.deck;
    out.chests = Array.isArray(p.chests) ? p.chests.slice(0, CHEST_SLOTS) : base.chests;
    while (out.chests.length < CHEST_SLOTS) out.chests.push(null);
    out.coins = Number.isFinite(p.coins) ? p.coins : base.coins;
    out.gems  = Number.isFinite(p.gems)  ? p.gems  : base.gems;
    out.cleared = Number.isFinite(p.cleared) ? Math.min(p.cleared, STAGES.length) : 0;
    out.wins = Number.isFinite(p.wins) ? p.wins : 0;
    out.losses = Number.isFinite(p.losses) ? p.losses : 0;

    // חפיסה שאינה חוקית (למשל אחרי שינוי חוקים) מוחלפת בברירת מחדל
    const eff = ownedOf(out);
    if (!deckIsLegal(out.deck, eff)) out.deck = repairDeck(eff);
    return out;
}

function saveProfile(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* אין אחסון */ }
}

function countsTotal(counts) {
    return Object.values(counts).reduce((a, b) => a + b, 0);
}

/* חפיסה חוקית: בדיוק 15 קלפים, ולא יותר עותקים ממה שבבעלות */
function deckIsLegal(deck, owned) {
    if (!deck || countsTotal(deck) !== DECK_SIZE) return false;
    return Object.entries(deck).every(([id, n]) =>
        n > 0 && n <= MAX_COPIES && n <= (owned[id] || 0));
}

/* בונה חפיסה חוקית כלשהי מתוך מה שבבעלות — רשת ביטחון */
function repairDeck(owned) {
    const deck = {};
    let total = 0;
    const ids = Object.keys(owned).sort((a, b) => byId(+b).power - byId(+a).power);
    for (const id of ids) {
        if (total >= DECK_SIZE) break;
        const take = Math.min(owned[id], MAX_COPIES, DECK_SIZE - total);
        if (take > 0) { deck[id] = take; total += take; }
    }
    return deck;
}
