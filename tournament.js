/* ============================================================================
   הזירה — מצב טורניר
   טעינה: monsters.js -> economy.js -> tournament.js -> game.js

   שני סוגי טורניר:
   1. "הקולוסיאום" — החזק שורד. רצף קרבות בלי סוף עד פרישה או מוות.
      החיים נשמרים בין קרבות, מתחילים מחפיסה סטנדרטית ובונים אותה
      תוך כדי ריצה בעזרת "מטבעות זירה" שנצברים רק בתוך הריצה.
   2. "מלחמה כוללת" — סוגריים של 8 -> 4 -> 2 עם החפיסה האמיתית של
      השחקן. כל קרב מתחיל בחיים מלאים.

   הקובץ הזה הוא לוגיקה בלבד (בלי DOM), כדי שאפשר יהיה לבדוק אותו
   ישירות ב-Node. הממשק עצמו יושב ב-game.js.
   ============================================================================ */

/* ---------------- קבועים ---------------- */

/* החפיסה הסטנדרטית שאיתה כל ריצת קולוסיאום מתחילה. מוגדרת כאן
   בנפרד מ-starterOwned/starterDeck של הפרופיל בכוונה — כיול של
   הפתיחה במשחק הרגיל לא אמור להזיז את איזון הטורניר. */
function colosseumStarterOwned() {
    return { 20:3, 19:3, 18:3, 17:3, 16:3, 15:3, 14:3, 13:3, 12:2 };
}
function colosseumStarterDeck() {
    return { 12:2, 13:3, 14:3, 15:3, 16:3, 17:3, 18:3 };   // 20 קלפים, כוח 85
}

/* עוצמת הבסיס שממנה נגזרים יריבי הקולוסיאום. נמוכה מ-85 (כוח
   החפיסה הפותחת) כדי שהקרב הראשון יהיה כניסה נוחה ולא הטלת מטבע. */
const COLOSSEUM_BASE_POWER = 78;

const TOURNEY_DIFFS = {
    easy: {
        key: 'easy', name: 'קל',
        powerMul: 0.85, hpBase: 16, hpStep: 1.5,
        goldMul: 1.0, rewardMul: 1.0, allowFullHeal: true,
        desc: 'יריבים חלשים מהחפיסה שלכם. אפשר להתחיל כל סיבוב בחיים מלאים.'
    },
    medium: {
        key: 'medium', name: 'בינוני',
        powerMul: 1.0, hpBase: 20, hpStep: 2.2,
        goldMul: 1.3, rewardMul: 1.6, allowFullHeal: true,
        desc: 'יריבים בעוצמה מקבילה. פרסים גדולים יותר.'
    },
    hard: {
        key: 'hard', name: 'קשה',
        powerMul: 1.18, hpBase: 24, hpStep: 3.0,
        goldMul: 1.7, rewardMul: 2.5, allowFullHeal: false,
        desc: 'יריבים חזקים מכם, בלי רשת ביטחון — החיים תמיד ממשיכים מהקרב הקודם.'
    }
};

/* פריטי החנות שבין הקרבות בקולוסיאום. הריפוי מוגבל לתקרת החיים,
   ושדרוג התקרה הוא הדרך היחידה לעבור את 20 החיים ההתחלתיים. */
const TOURNEY_ITEMS = {
    heal_small: { key: 'heal_small', name: 'שיקום קל',  desc: 'מרפא 5 נקודות חיים', price: 40,  heal: 5 },
    heal_big:   { key: 'heal_big',   name: 'שיקום מלא', desc: 'ממלא את כל החיים',   price: 110, heal: 'full' },
    max_up:     { key: 'max_up',     name: 'לב הזירה',  desc: 'מוסיף 5 לתקרת החיים ומרפא אותם', price: 160, maxUp: 5 }
};

/* כמה קרבות בין עצירה לעצירה בחנות */
const TOURNEY_SHOP_EVERY = 2;

/* כמה קלפים מוצעים בכל עצירה — הצעה מצומצמת ומתחלפת, לא כל האוסף */
const TOURNEY_OFFER_SIZE = 3;

/* מחיר קלף בחנות הריצה — נגזר ממחיר החנות הרגילה אבל בקנה מידה של
   מטבעות זירה, שנצברים הרבה יותר לאט מהמטבעות האמיתיים. */
function tourneyCardPrice(card) {
    const base = RARITIES[rarityOf(card)].price;
    return Math.max(15, Math.round(base * 0.32));
}

/* ---------------- הצעת החנות ---------------- */

/* משקלי הנדירות בהצעה כפונקציה של עומק הריצה: בהתחלה בעיקר קלפים
   רגילים, וככל שמתקדמים ההצעה מטפסת לאפיים, אגדיים ואולטרה. */
function shopRarityWeights(round) {
    const t = Math.min(1, Math.max(0, (round - 1) / 18));
    return {
        common:    Math.max(0, 55 - 52 * t),
        rare:      Math.max(0, 35 -  8 * t),
        epic:      10 + 25 * t,
        legendary:      30 * t,
        ultra:           8 * t
    };
}

function pickWeighted(weights) {
    const keys = Object.keys(weights);
    if (!keys.length) return null;
    const total = keys.reduce((a, k) => a + weights[k], 0);
    if (total <= 0) return keys[0];
    let r = Math.random() * total;
    for (const k of keys) {
        if (r < weights[k]) return k;
        r -= weights[k];
    }
    return keys[keys.length - 1];
}

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'ultra'];

/* מגריל את ההצעה של עצירה אחת. נשמרת בריצה ולא מוגרלת מחדש בכל
   רינדור — אחרת יציאה וכניסה חוזרת לחנות היו מרעננות את ההצעה
   בלי הגבלה, ובוחרים היו מגלגלים עד שיוצא קלף אולטרה. */
function rollShopOffer(run) {
    if (!run) return [];
    const baseWeights = shopRarityWeights(run.round || 1);
    const eligible = CARD_POOL.filter(c => (run.owned[c.id] || 0) < MAX_COPIES);
    const pool = eligible.length ? eligible : CARD_POOL;
    const chosen = [];

    while (chosen.length < Math.min(TOURNEY_OFFER_SIZE, pool.length)) {
        const avail = pool.filter(c => !chosen.includes(c.id));
        if (!avail.length) break;

        /* משקללים רק נדירויות שבאמת יש להן קלף זמין. בלי זה נוצר באג
           אמיתי: החפיסה הסטנדרטית כבר מחזיקה 3 עותקים מכל הקלפים
           הרגילים, כלומר דרגת "רגיל" ריקה מהרגע הראשון — ו-55%
           מההגרלות בסיבוב 1 היו נופלות להגרלה חופשית שמסוגלת להוציא
           קלף אולטרה כבר בעצירה הראשונה. */
        const weights = {};
        for (const [rar, w] of Object.entries(baseWeights)) {
            if (w > 0 && avail.some(c => rarityOf(c) === rar)) weights[rar] = w;
        }

        let rar = pickWeighted(weights);
        if (!rar) {
            /* אף נדירות עם משקל חיובי אינה זמינה — עולים לחלשה ביותר
               שכן זמינה, ולא מגרילים חופשי */
            rar = RARITY_ORDER.find(r => avail.some(c => rarityOf(c) === r));
        }
        const tier = avail.filter(c => rarityOf(c) === rar);
        if (!tier.length) break;
        chosen.push(tier[Math.floor(Math.random() * tier.length)].id);
    }
    return chosen;
}

/* העצירה בחנות נגמרת רק כשיוצאים לקרב הבא — לא בסגירת החלון.
   כך אפשר להיכנס ולצאת מהחנות כמה פעמים, להתחרט ולחזור, כל עוד
   לא התחיל הקרב. */
function tourneyConsumeShop(run) {
    if (!run) return;
    run.shopOpen = false;
    run.offer = null;
}

/* ---------------- יריבים ---------------- */

/* זהות היריב נשאבת ממפת השלבים הקיימת — שם, תמונה וצבע יסוד.
   idx נחתך לגבולות המערך, כך ששום ריצה ארוכה לא תחרוג ממנו. */
function tourneyFoeIdentity(idx) {
    const s = STAGES[Math.max(0, Math.min(STAGES.length - 1, Math.round(idx)))];
    return { name: s.name, img: s.img, el: s.el };
}

/* יריב הקולוסיאום בסיבוב r (1-based) */
function colosseumFoe(run) {
    const d = TOURNEY_DIFFS[run.diff];
    const r = run.round;
    const power = Math.round(COLOSSEUM_BASE_POWER * d.powerMul + (r - 1) * 2.2);
    const hp = Math.round(d.hpBase + (r - 1) * d.hpStep);
    /* ככל שמתקדמים, היריבים נשאבים מעומק המפה — כך שהשמות והדמויות
       מתקדמים יחד עם הקושי ולא מרגישים אקראיים. */
    const idx = (r - 1) * 1.6 + Math.floor(Math.random() * 3);
    return { ...tourneyFoeIdentity(idx), power, hp, round: r };
}

/* שמונת המשתתפים של "מלחמה כוללת". אינדקס 0 הוא תמיד השחקן. */
function buildWarBracket(diff, playerDeckPower, playerName) {
    const d = TOURNEY_DIFFS[diff];
    const used = new Set();
    const foes = [];
    for (let i = 0; i < 7; i++) {
        /* פיזור על פני החצי העליון של המפה, בלי כפילות שמות בסוגריים */
        let idx;
        let guard = 0;
        do {
            idx = Math.floor(STAGES.length * (0.35 + Math.random() * 0.6));
            idx = Math.min(STAGES.length - 1, idx);
        } while (used.has(idx) && guard++ < 40);
        used.add(idx);

        const id = tourneyFoeIdentity(idx);
        /* עוצמת היריב נמדדת מול החפיסה האמיתית של השחקן, כי במצב הזה
           הוא משחק עם החפיסה שלו ולא עם חפיסה סטנדרטית. */
        const spread = 0.9 + Math.random() * 0.25;
        foes.push({
            name: id.name, img: id.img, el: id.el,
            power: Math.round(playerDeckPower * d.powerMul * spread),
            hp: Math.round(d.hpBase + 4),
            isPlayer: false
        });
    }
    return [{ name: playerName || 'אתם', isPlayer: true, power: playerDeckPower }, ...foes];
}

/* חוזק לצורך הדמיית המשחקים שהשחקן לא משתתף בהם */
function foeStrength(p) { return (p.power || 0) + (p.hp || 0) * 1.5; }

/* מדמה קרב בין שני יריבים. החזק יותר מנצח ברוב המקרים, אבל יש
   מקום להפתעות — אחרת הסוגריים צפויים לגמרי. */
function simulateFoeMatch(a, b) {
    const sa = foeStrength(a), sb = foeStrength(b);
    const favored = sa >= sb ? a : b;
    const other = favored === a ? b : a;
    return Math.random() < 0.68 ? favored : other;
}

const WAR_ROUND_NAMES = ['רבע גמר', 'חצי גמר', 'הגמר'];

/* ---------------- יצירת ריצה ---------------- */

function newColosseumRun(diff, battleMode, fullHeal) {
    const d = TOURNEY_DIFFS[diff] || TOURNEY_DIFFS.easy;
    return {
        type: 'colosseum',
        diff: d.key,
        battleMode: battleMode === 'monsters' ? 'monsters' : 'quick',
        /* ברמה קשה אין רשת ביטחון — החיים תמיד ממשיכים מהקרב הקודם */
        fullHeal: !!fullHeal && d.allowFullHeal,
        round: 1,
        hp: START_HP,
        maxHP: START_HP,
        gold: 0,
        owned: colosseumStarterOwned(),
        deck: colosseumStarterDeck(),
        /* מה שנקנה בתוך הריצה, בנפרד מהאוסף ההתחלתי. האוסף ההתחלתי
           כולל בכוונה עודף שלא נכנס לחפיסה, ולכן השוואת owned מול deck
           לבדה הייתה מדליקה את רמז "קלפים לא משובצים" כבר בקרב הראשון. */
        bought: {},
        wins: 0,
        battlesSinceShop: 0,
        shopOpen: false,
        offer: null,          // 3 הקלפים המוצעים בעצירה הנוכחית
        active: true
    };
}

function newWarRun(diff, battleMode, playerDeck, playerName) {
    const d = TOURNEY_DIFFS[diff] || TOURNEY_DIFFS.easy;
    return {
        type: 'war',
        diff: d.key,
        battleMode: battleMode === 'monsters' ? 'monsters' : 'quick',
        stage: 0,                 // 0 רבע גמר, 1 חצי גמר, 2 גמר
        participants: buildWarBracket(d.key, countsPower(playerDeck), playerName),
        history: [],              // תיאור הקרבות שכבר הוכרעו
        wins: 0,
        active: true
    };
}

/* ---------------- התקדמות ---------------- */

/* היריב הנוכחי של הריצה — לקולוסיאום נוצר בכל קרב מחדש, ולמלחמה
   כוללת נשלף מהסוגריים. */
function tourneyCurrentFoe(run) {
    if (!run || !run.active) return null;
    if (run.type === 'colosseum') {
        if (!run.foe) run.foe = colosseumFoe(run);
        return run.foe;
    }
    return run.participants[1] || null;
}

/* זהב על ניצחון בקולוסיאום — גדל עם הסיבוב */
function colosseumGoldFor(run) {
    const d = TOURNEY_DIFFS[run.diff];
    return Math.round((12 + run.round * 2) * d.goldMul);
}

/* מעדכן את הריצה אחרי קרב. מחזיר תיאור של מה שקרה, כדי שהממשק
   יוכל להציג הודעה מדויקת בלי לחשב מחדש. */
function tourneyAfterBattle(run, won, playerHP) {
    if (!run || !run.active) return null;

    if (run.type === 'colosseum') {
        if (!won) {
            run.active = false;
            return { over: true, won: false, wins: run.wins };
        }
        run.wins++;
        const gold = colosseumGoldFor(run);
        run.gold += gold;
        /* החיים ממשיכים מהקרב הקודם — זה הלב של המצב הזה.
           באפשרות "חיים מלאים" הם מתאפסים לתקרה לפני הקרב הבא. */
        run.hp = run.fullHeal ? run.maxHP : Math.max(1, playerHP);
        run.round++;
        run.foe = null;
        run.battlesSinceShop++;
        if (run.battlesSinceShop >= TOURNEY_SHOP_EVERY) {
            run.battlesSinceShop = 0;
            run.shopOpen = true;
            run.offer = rollShopOffer(run);
        }
        return { over: false, won: true, gold, shopOpen: run.shopOpen, wins: run.wins };
    }

    // ---- מלחמה כוללת ----
    const roundName = WAR_ROUND_NAMES[run.stage] || 'הקרב';
    if (!won) {
        run.active = false;
        return { over: true, won: false, wins: run.wins, roundName };
    }
    run.wins++;

    /* השחקן ניצח את המשחק שלו; שאר המשחקים באותו סבב מוכרעים
       בהדמיה, והשורדים עולים לסבב הבא באותו סדר. */
    const list = run.participants;
    const survivors = [list[0]];
    for (let i = 2; i < list.length; i += 2) {
        survivors.push(simulateFoeMatch(list[i], list[i + 1]));
    }
    /* מי שעלה שלב מתחזק. הרצפה מול היריב שהרגע הובס חיונית: היריב
       הבא הוא מנצח של משחק *אחר*, ובלי הרצפה הוא יכול לצאת בהגרלה
       חלש מזה שכבר ניצחתם — כלומר גמר קל יותר מרבע הגמר. */
    const beaten = list[1] || { power: 0, hp: 0 };
    survivors.forEach(p => {
        if (p.isPlayer) return;
        p.power = Math.round(Math.max(p.power, beaten.power) * 1.09);
        p.hp = Math.max(p.hp, beaten.hp) + 3;
    });
    run.history.push({
        round: roundName,
        beat: list[1] ? list[1].name : '',
    });
    run.participants = survivors;
    run.stage++;

    if (survivors.length <= 1) {
        run.active = false;
        return { over: true, won: true, champion: true, wins: run.wins, roundName };
    }
    return { over: false, won: true, roundName, nextRound: WAR_ROUND_NAMES[run.stage] || 'הגמר', wins: run.wins };
}

/* ---------------- חנות הריצה ---------------- */

function tourneyBuyCard(run, cardId) {
    const card = byId(cardId);
    if (!run || !run.active || !card) return { ok: false, msg: 'קלף לא קיים' };
    /* אפשר לקנות רק מתוך שלושת הקלפים של העצירה הנוכחית. הבדיקה
       מדלגת כשאין הצעה, כדי לא לשבור ריצה שנשמרה בגרסה קודמת. */
    if (Array.isArray(run.offer) && run.offer.length && !run.offer.includes(cardId)) {
        return { ok: false, msg: 'הקלף הזה לא מוצע בעצירה הנוכחית' };
    }
    const have = run.owned[cardId] || 0;
    if (have >= MAX_COPIES) return { ok: false, msg: `כבר יש לכם ${MAX_COPIES} עותקים` };
    const price = tourneyCardPrice(card);
    if (run.gold < price) return { ok: false, msg: 'אין מספיק מטבעות זירה' };
    run.gold -= price;
    run.owned[cardId] = have + 1;
    if (!run.bought) run.bought = {};
    run.bought[cardId] = (run.bought[cardId] || 0) + 1;
    return { ok: true, msg: `${card.name} נוסף לאוסף הריצה`, price };
}

function tourneyBuyItem(run, itemKey) {
    const item = TOURNEY_ITEMS[itemKey];
    if (!run || !run.active || !item) return { ok: false, msg: 'פריט לא קיים' };
    if (run.gold < item.price) return { ok: false, msg: 'אין מספיק מטבעות זירה' };

    if (item.maxUp) {
        run.gold -= item.price;
        run.maxHP += item.maxUp;
        run.hp = run.maxHP;
        return { ok: true, msg: `תקרת החיים עלתה ל-${run.maxHP}` };
    }
    if (run.hp >= run.maxHP) return { ok: false, msg: 'החיים שלכם כבר מלאים' };
    run.gold -= item.price;
    run.hp = item.heal === 'full' ? run.maxHP : Math.min(run.maxHP, run.hp + item.heal);
    return { ok: true, msg: `החיים עלו ל-${run.hp}` };
}

/* רמז לשחקן שקנה קלף ושכח לשבץ אותו — קנייה לבדה לא משנה את
   החפיסה. נמדד מול מה שנקנה בריצה בלבד, לא מול האוסף ההתחלתי
   (שכולל עודף מכוון שלגיטימי להשאיר בחוץ). */
function tourneyHasUnusedCards(run) {
    if (!run || run.type !== 'colosseum' || !run.bought) return false;
    return Object.entries(run.bought).some(([id, n]) => (run.deck[id] || 0) < n);
}

/* ---------------- פרסים בסיום ---------------- */

/* הפרס האמיתי (מטבעות/יהלומים/תיבה) ניתן רק בסוף הריצה, כדי
   שמטבעות הזירה יישארו כלכלה סגורה בתוך הריצה עצמה. */
function tourneyFinalReward(run) {
    const d = TOURNEY_DIFFS[run.diff] || TOURNEY_DIFFS.easy;
    if (run.type === 'colosseum') {
        const coins = Math.round(run.wins * 12 * d.rewardMul);
        const gems = run.wins >= 10 ? Math.round(2 * d.rewardMul) : 0;
        return { coins, gems, chest: run.wins >= 5 };
    }
    const champion = run.wins >= 3;
    const coins = Math.round((champion ? 150 : run.wins * 45) * d.rewardMul);
    const gems = champion ? Math.round(3 * d.rewardMul) : (run.wins >= 2 ? 1 : 0);
    return { coins, gems, chest: run.wins >= 2, champion };
}

/* ---------------- שחזור ריצה שנשמרה ---------------- */

/* ריצה נשמרת בפרופיל כדי שרענון דף לא ימחק רצף ארוך. קרב שהיה
   באמצע כשהדף נסגר פשוט מתחיל מחדש — החיים נשמרים לפני כל קרב,
   לא תוך כדי, ולכן אין מצב ביניים לא עקבי. */
function sanitizeTourneyRun(run) {
    if (!run || typeof run !== 'object') return null;
    if (run.type !== 'colosseum' && run.type !== 'war') return null;
    if (!TOURNEY_DIFFS[run.diff]) return null;
    if (!run.active) return null;

    if (run.type === 'colosseum') {
        if (!run.owned || typeof run.owned !== 'object') return null;
        if (!run.deck || typeof run.deck !== 'object') return null;
        if (!Number.isFinite(run.hp) || !Number.isFinite(run.maxHP)) return null;
        if (run.hp <= 0 || run.maxHP <= 0) return null;
        if (!deckIsLegal(run.deck, run.owned)) run.deck = repairDeck(run.owned);
        run.gold = Number.isFinite(run.gold) ? run.gold : 0;
        run.round = Number.isFinite(run.round) && run.round > 0 ? run.round : 1;
        run.wins = Number.isFinite(run.wins) ? run.wins : 0;
        /* הצעה פגומה או מזהה קלף שכבר לא קיים — פשוט מתאפסת, והחנות
           תגריל הצעה חדשה בכניסה הבאה */
        run.offer = Array.isArray(run.offer) && run.offer.every(id => byId(id))
            ? run.offer : null;
    } else {
        if (!Array.isArray(run.participants) || run.participants.length < 2) return null;
        if (!run.participants[0] || !run.participants[0].isPlayer) return null;
        run.stage = Number.isFinite(run.stage) ? run.stage : 0;
        run.wins = Number.isFinite(run.wins) ? run.wins : 0;
    }
    return run;
}

/* חשיפה ל-Node לצורך בדיקות; בדפדפן אין module ולכן מדלגים */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TOURNEY_DIFFS, TOURNEY_ITEMS, TOURNEY_SHOP_EVERY, TOURNEY_OFFER_SIZE, WAR_ROUND_NAMES,
        colosseumStarterOwned, colosseumStarterDeck, colosseumFoe, buildWarBracket,
        newColosseumRun, newWarRun, tourneyAfterBattle, tourneyCurrentFoe,
        tourneyBuyCard, tourneyBuyItem, tourneyCardPrice, tourneyFinalReward,
        tourneyHasUnusedCards, sanitizeTourneyRun, colosseumGoldFor,
        rollShopOffer, shopRarityWeights, tourneyConsumeShop
    };
}
