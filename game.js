/* ============================================================================
   הזירה — לוגיקת המשחק, המסכים והכלכלה
   טעינה: monsters.js -> economy.js -> game.js
   ============================================================================ */

const $ = id => document.getElementById(id);
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];

let P = null;   // פרופיל השחקן (נטען ב-DOMContentLoaded)

const S = {
    playerDeck: [], enemyDeck: [],
    playerDiscard: [], enemyDiscard: [],
    playerHand: [], enemyHand: [],
    battleMode: 'quick',    // 'quick' = שליפה אוטומטית | 'monsters' = בחירה מהיד
    pendingSummon: null,    // { index, sacrifices[] } בזמן בחירת קורבנות
    sacrificeNote: '',
    playerHP: START_HP, enemyHP: START_HP, enemyMaxHP: START_HP,
    round: 1,
    busy: false,
    war: null,
    mode: 'quick',          // 'quick' | 'campaign'
    mapMode: 'quick',       // מצב הקרב שנבחר במפת השלבים
    stageIdx: null,
    stats: { wins: 0, losses: 0, wars: 0, dealt: 0, taken: 0 }
};

/* ---------------- עזרים ---------------- */

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function countsPower(counts) {
    return Object.entries(counts).reduce((sum, [id, n]) => sum + byId(id).power * n, 0);
}

function deckFromCounts(counts, owner) {
    const cards = [];
    Object.entries(counts).forEach(([id, n]) => {
        for (let i = 0; i < n; i++) cards.push({ ...byId(id), uid: `${owner}-${id}-${i}` });
    });
    return shuffle(cards);
}

/* חפיסת יריב אקראית וחוקית בעוצמה קרובה לשחקן — לקרב מהיר */
function enemyCounts(targetPower) {
    const ids = CARD_POOL.map(c => c.id);
    const counts = {};
    let placed = 0;
    while (placed < DECK_SIZE) {
        const id = rnd(ids);
        if ((counts[id] || 0) < MAX_COPIES) { counts[id] = (counts[id] || 0) + 1; placed++; }
    }
    for (let i = 0; i < 3000; i++) {
        const diff = countsPower(counts) - targetPower;
        if (Math.abs(diff) <= 2) break;
        const stronger = diff < 0;
        const from = rnd(Object.keys(counts).filter(id => counts[id] > 0));
        const options = ids.filter(id => (counts[id] || 0) < MAX_COPIES &&
            (stronger ? byId(id).power > byId(from).power : byId(id).power < byId(from).power));
        if (!options.length) continue;
        const to = rnd(options);
        if (--counts[from] === 0) delete counts[from];
        counts[to] = (counts[to] || 0) + 1;
    }
    return counts;
}

/* ---------------- רינדור קלפים ---------------- */

function abilityChip(key) {
    const ab = ABILITIES[key];
    return `<div class="card-ability ab-${ab.tone}">
        <svg viewBox="0 0 24 24">${ab.icon}</svg>
        <span><b>${ab.name}</b> · ${ab.desc}</span>
    </div>`;
}

function artHTML(card) {
    if (!card.img) return monsterSVG(card.art);
    const pos = card.imgPos || 'center 25%';
    /* בלי loading="lazy" בכוונה: תמונה עצלה שלא נטענת כלל לא יורה onerror,
       והגיבוי לא היה מופעל — הקלף היה נשאר ריק. */
    return `<img class="mon-img" src="${card.img}" alt="" decoding="async"
        style="object-position:${pos}"
        onerror="markArtFailed(this)"
        onload="if(!this.naturalWidth) markArtFailed(this)">
        ${monsterSVG(card.art)}`;
}

function markArtFailed(img) {
    const box = img.closest('.card-art, .edit-art, .shop-art, .hand-art');
    if (box) box.classList.add('img-failed');
}

function cardFrontHTML(card) {
    const rar = rarityOf(card);
    return `<div class="card-face card-front el-${card.el} rar-${rar}">
        <div class="card-art${card.img ? ' has-img' : ''}">
            <div class="power-badge">${card.power}</div>
            <div class="rar-badge rar-${rar}">${RARITIES[rar].name}</div>
            ${artHTML(card)}
        </div>
        <div class="card-name">${card.name}${card.variant ? `<span class="card-variant">${card.variant}</span>` : ''}</div>
        ${abilityChip(card.ability)}
    </div>`;
}

const SIGIL = `<svg class="sigil" viewBox="0 0 100 100">
    <path d="M50 8 L86 30 V70 L50 92 L14 70 V30 Z"/>
    <path d="M50 24 L72 37 V63 L50 76 L28 63 V37 Z"/>
    <circle cx="50" cy="50" r="8"/>
</svg>`;

const backHTML = () => `<div class="card-face card-back">${SIGIL}</div>`;

function layerHTML(card, index, faceUp) {
    return `<div class="card-layer" style="--i:${index}">
        <div class="card${faceUp ? ' flipped' : ''}">
            ${backHTML()}
            ${card ? cardFrontHTML(card) : ''}
        </div>
    </div>`;
}

/* ---------------- חישוב הסיבוב ---------------- */

/* noAbilities: בהכרעת מלחמה היכולות מושבתות ומשווים כוח בסיס בלבד,
   כך שתיקו בכוח הבסיסי מוליד מלחמה נוספת. */
function resolveRound(pCard, eCard, noAbilities = false) {
    const notes = [];

    let pAb, eAb;
    if (noAbilities) {
        pAb = eAb = 'none';
        notes.push('הכרעת מלחמה — היכולות מושבתות, מכריע הכוח הבסיסי');
    } else {
        pAb = pCard.ability; eAb = eCard.ability;
        // שני התנאים נבדקים מול היכולת המקורית, כדי ששני "מבטל" יבטלו זה את זה
        if (eCard.ability === 'nullify' && pAb !== 'none') { pAb = 'none'; notes.push(`${eCard.name} ביטל את היכולת שלכם`); }
        if (pCard.ability === 'nullify' && eAb !== 'none') { eAb = 'none'; notes.push(`${pCard.name} ביטל את יכולת היריב`); }
    }

    let pPow = pCard.power, ePow = eCard.power;

    if (pAb === 'underdog' && pCard.power < eCard.power) { pPow += 4; notes.push(`${pCard.name} נועז: +4`); }
    if (eAb === 'underdog' && eCard.power < pCard.power) { ePow += 4; notes.push(`${eCard.name} נועז: +4`); }

    if (pAb === 'boost') { pPow += 3; notes.push(`${pCard.name} זעם: +3`); }
    if (eAb === 'boost') { ePow += 3; notes.push(`${eCard.name} זעם: +3`); }

    if (pAb === 'weaken') { ePow -= 2; notes.push(`${pCard.name} מחליש: 2- ליריב`); }
    if (eAb === 'weaken') { pPow -= 2; notes.push(`${eCard.name} מחליש: 2- לכם`); }

    if (pAb === 'vampire') { ePow -= 1; pPow += 1; notes.push(`${pCard.name} מנקז נקודת כוח`); }
    if (eAb === 'vampire') { pPow -= 1; ePow += 1; notes.push(`${eCard.name} מנקז נקודת כוח`); }

    pPow = Math.max(0, pPow);
    ePow = Math.max(0, ePow);

    let outcome;
    if (pPow > ePow) outcome = 'player';
    else if (ePow > pPow) outcome = 'enemy';
    else {
        const pTie = pAb === 'tie', eTie = eAb === 'tie';
        if (pTie && !eTie) { outcome = 'player'; notes.push(`${pCard.name} עקשן — מנצח בתיקו`); }
        else if (eTie && !pTie) { outcome = 'enemy'; notes.push(`${eCard.name} עקשן — מנצח בתיקו`); }
        else outcome = 'tie';
    }

    return { pPow, ePow, pAb, eAb, outcome, notes };
}

/* ---------------- תצוגת הקרב ---------------- */

/* שולף קלף מהחפיסה. אין ערבוב מחדש — חפיסה שנגמרה היא תנאי הפסד,
   ולכן כל קלף שנשרף (בשליחה לקרב או בהקרבה) הוא משאב אבוד. */
function drawCard(side) {
    const deck = side === 'p' ? S.playerDeck : S.enemyDeck;
    return deck.length ? deck.shift() : null;
}

function updateBars(anim) {
    const pPct = Math.max(0, (S.playerHP / START_HP) * 100);
    const ePct = Math.max(0, (S.enemyHP / S.enemyMaxHP) * 100);
    $('playerCount').textContent = Math.max(0, S.playerHP);
    $('enemyCount').textContent = Math.max(0, S.enemyHP);
    $('playerBar').style.width = pPct + '%';
    $('enemyBar').style.width = ePct + '%';
    $('playerBar').classList.toggle('low', pPct <= 30);
    $('enemyBar').classList.toggle('low', ePct <= 30);
    $('playerCards').textContent = S.playerDeck.length;
    $('enemyCards').textContent = S.enemyDeck.length;
    if (anim) {
        ['playerCount', 'enemyCount'].forEach(id => {
            const el = $(id);
            el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
        });
    }
}

function setVerdict(title, sub, tone) {
    const t = $('verdictTitle'), box = $('verdict');
    t.className = 'verdict-title' + (tone ? ' ' + tone : '');
    t.textContent = title;
    $('verdictSub').innerHTML = sub;
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
}

function powerHTML(base, final) {
    if (base === final) return `<span class="final">${final}</span>`;
    return `<span class="base">${base}</span><span class="final ${final > base ? 'up' : 'down'}">${final}</span>`;
}

function setDrawButton(label, war) {
    const b = $('btnDraw');
    b.textContent = label;
    b.classList.toggle('war', !!war);
    b.disabled = false;
}

/* מציג מספר נזק צף מעל הצד שנפגע */
function floatDamage(side, amount, kind) {
    const host = side === 'p' ? $('playerSlot') : $('enemySlot');
    const el = document.createElement('div');
    el.className = 'dmg-float ' + (kind || 'dmg');
    el.textContent = (kind === 'heal' ? '+' : '−') + amount;
    host.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}

/* ---------------- מהלך הסיבוב ---------------- */

/* ---- יד הקלפים (קרב מפלצות) ---- */

/* מילוי היד בתחילת הקרב בלבד */
function refillHand(side) {
    const hand = side === 'p' ? S.playerHand : S.enemyHand;
    while (hand.length < HAND_SIZE) {
        const c = drawCard(side);
        if (!c) break;
        hand.push(c);
    }
}

/* האם קיים בכלל מהלך חוקי ביד?
   יד שכולה כוח 6+ ובה פחות מ-3 קלפים לא מאפשרת שום זימון, ובלי
   הבדיקה הזאת השחקן היה נתקע בלי מהלך אפשרי. */
function hasLegalPlay(hand) {
    if (!hand.length) return false;
    if (hand.length - 1 >= SACRIFICE_COUNT) return true;
    return hand.some(c => !needsSacrifice(c));
}

const needsSacrifice = card => card.power >= SACRIFICE_MIN_POWER;

/* הבוט בוחר מהיד ומשלם את אותו מחיר הקרבה כמו השחקן.
   בחיים נמוכים הוא הולך על החזק ביותר, אחרת מגוון כדי לא להיות צפוי. */
function botPick() {
    if (!S.enemyHand.length) return null;
    const sorted = [...S.enemyHand].sort((a, b) => b.power - a.power);
    const canPaySac = S.enemyHand.length - 1 >= SACRIFICE_COUNT;

    /* זימון יקר שורף 3 קלפים מהחפיסה, וחפיסה שנגמרה היא הפסד.
       בלי השמירה הזאת הבוט שרף את עצמו והמצב היה נשלט בקלות. */
    const deckThin = S.enemyDeck.length <= (SACRIFICE_COUNT + 1) * 2;
    const allowBig = canPaySac && !deckThin;

    let pool = sorted.filter(c => !needsSacrifice(c) || allowBig);
    if (!pool.length) pool = sorted.filter(c => !needsSacrifice(c));
    if (!pool.length) pool = sorted;

    const desperate = S.enemyHP <= S.enemyMaxHP * 0.4;
    const pick = desperate ? pool[0]
        : (Math.random() < 0.55 ? pool[0] : pool[Math.min(1, pool.length - 1)]);

    S.enemyHand.splice(S.enemyHand.indexOf(pick), 1);
    if (needsSacrifice(pick)) {
        // הבוט מקריב את החלשים שנותרו לו
        [...S.enemyHand].sort((a, b) => a.power - b.power).slice(0, SACRIFICE_COUNT)
            .forEach(c => {
                S.enemyHand.splice(S.enemyHand.indexOf(c), 1);
                S.enemyDiscard.push(c);
            });
    }
    return pick;
}

function renderHand() {
    const dock = $('handDock');
    if (S.battleMode !== 'monsters') { dock.hidden = true; return; }
    dock.hidden = false;
    const pend = S.pendingSummon;

    $('handRow').innerHTML = S.playerHand.map((c, i) => {
        const chosen = pend && pend.index === i;
        const sac = pend && pend.sacrifices.includes(i);
        return `<button class="hand-card el-${c.el} rar-${rarityOf(c)}${chosen ? ' chosen' : ''}${sac ? ' sacrificed' : ''}"
                data-i="${i}" ${S.busy ? 'disabled' : ''}
                title="${c.name} · ${ABILITIES[c.ability].name}">
            <div class="hand-art${c.img ? ' has-img' : ''}">${artHTML(c)}</div>
            ${needsSacrifice(c) ? `<div class="sac-cost">${SACRIFICE_COUNT}</div>` : ''}
            <div class="hand-pow">${c.power}</div>
        </button>`;
    }).join('');

    if (S.busy) $('handLabel').textContent = 'הקלפים נחשפים...';
    else if (pend) {
        const left = SACRIFICE_COUNT - pend.sacrifices.length;
        $('handLabel').textContent = `בחרו עוד ${left} להקרבה · לחיצה חוזרת מבטלת`;
    } else $('handLabel').textContent = S.war
        ? 'בחרו את הקלף המכריע' : `בחרו קלף לזימון · כוח ${SACRIFICE_MIN_POWER}+ עולה ${SACRIFICE_COUNT} הקרבות`;
    $('handLabel').classList.toggle('warn', !!pend);
}

/* ---- כניסה לסיבוב ---- */

/* קרב מהיר: הקלף העליון נשלף אוטומטית */
function drawRound() {
    if (S.busy || S.battleMode === 'monsters') return;
    const pCard = drawCard('p');
    const eCard = drawCard('e');
    if (!pCard || !eCard) { endGame(); return; }
    revealAndResolve(pCard, eCard);
}

/* קרב מפלצות: השחקן בוחר קלף מהיד.
   קלף בכוח SACRIFICE_MIN_POWER ומעלה דורש בחירת קורבנות לפני הזימון. */
function playFromHand(i) {
    if (S.busy || S.battleMode !== 'monsters') return;
    const card = S.playerHand[i];
    if (!card) return;
    const pend = S.pendingSummon;

    if (pend) {
        if (pend.index === i) { S.pendingSummon = null; renderHand(); return; }   // ביטול
        const at = pend.sacrifices.indexOf(i);
        if (at >= 0) pend.sacrifices.splice(at, 1); else pend.sacrifices.push(i);
        if (pend.sacrifices.length >= SACRIFICE_COUNT) commitSummon(pend.index, pend.sacrifices);
        else renderHand();
        return;
    }

    if (needsSacrifice(card)) {
        if (S.playerHand.length - 1 < SACRIFICE_COUNT) {
            // אין קורבנות. אם גם אין שום מהלך חוקי אחר — מזמנים בחינם כדי לא להיתקע
            if (!hasLegalPlay(S.playerHand)) {
                toast('אין קלפים להקרבה — הזימון עובר בחינם');
                return commitSummon(i, []);
            }
            return toast(`זימון ${card.name} דורש ${SACRIFICE_COUNT} הקרבות — בחרו קלף חלש יותר`);
        }
        S.pendingSummon = { index: i, sacrifices: [] };
        renderHand();
        return;
    }

    commitSummon(i, []);
}

function commitSummon(index, sacIdx) {
    const pCard = S.playerHand[index];
    const sacrificed = sacIdx.map(k => S.playerHand[k]);
    const remove = new Set([index, ...sacIdx]);
    S.playerHand = S.playerHand.filter((_, k) => !remove.has(k));
    S.playerDiscard.push(...sacrificed);
    S.pendingSummon = null;
    S.sacrificeNote = sacrificed.length
        ? `הוקרבו: ${sacrificed.map(c => c.name).join(' · ')}` : '';

    const eCard = botPick();
    if (!eCard) { endGame(); return; }
    revealAndResolve(pCard, eCard);
}

/* חשיפה והכרעה — משותף לשני המצבים ולהכרעת מלחמה */
function revealAndResolve(pCard, eCard) {
    S.busy = true;
    $('btnDraw').disabled = true;
    const isWar = !!S.war;

    if (isWar) {
        const idx = Math.max(S.war.pileP.length, S.war.pileE.length);
        $('playerSlot').insertAdjacentHTML('beforeend', layerHTML(pCard, idx, false));
        $('enemySlot').insertAdjacentHTML('beforeend', layerHTML(eCard, idx, false));
        setVerdict('הכרעה!', 'הקלף המכריע נחשף — היכולות מושבתות והנזק כפול', 'tie');
    } else {
        $('playerSlot').innerHTML = layerHTML(pCard, 0, false);
        $('enemySlot').innerHTML = layerHTML(eCard, 0, false);
        $('playerPower').innerHTML = '';
        $('enemyPower').innerHTML = '';
        $('vsBadge').className = 'vs-badge';
        $('vsBadge').textContent = 'VS';
        setVerdict('נחשפים...', 'הקלפים עולים לזירה', '');
    }
    renderHand();
    updateBars(false);

    setTimeout(() => {
        $('playerSlot').lastElementChild.querySelector('.card').classList.add('flipped');
        $('enemySlot').lastElementChild.querySelector('.card').classList.add('flipped');
    }, 200);

    setTimeout(() => finishRound(pCard, eCard), 880);
}

function finishRound(pCard, eCard) {
    // בהכרעת מלחמה היכולות מושבתות — מכריע הכוח הבסיסי בלבד
    const r = resolveRound(pCard, eCard, !!S.war);
    const pTop = $('playerSlot').lastElementChild;
    const eTop = $('enemySlot').lastElementChild;

    $('playerPower').innerHTML = powerHTML(pCard.power, r.pPow);
    $('enemyPower').innerHTML = powerHTML(eCard.power, r.ePow);

    const notes = r.notes.length ? r.notes.join(' · ') : 'קרב כוח נקי, בלי יכולות';

    if (r.outcome === 'tie') { startWar(pCard, eCard, r, notes); return; }

    const playerWon = r.outcome === 'player';
    const winAb = playerWon ? r.pAb : r.eAb;
    const loseAb = playerWon ? r.eAb : r.pAb;
    const winCard = playerWon ? pCard : eCard;

    (playerWon ? pTop : eTop).classList.add('winner');
    (playerWon ? eTop : pTop).classList.add('loser');
    $('vsBadge').className = 'vs-badge ' + (playerWon ? 'win' : 'lose');
    $('vsBadge').textContent = playerWon ? '▲' : '▼';

    // ---- נזק = ההפרש בין הקלף המנצח למפסיד ----
    // מינימום 1: ניצחון ביכולת "עקשן" קורה בהפרש 0, ובלי רצפה הקרב לא היה מתקדם
    let dmg = Math.max(1, Math.abs(r.pPow - r.ePow));
    const extra = [];

    const wasWar = !!S.war;
    if (wasWar) {
        dmg *= 2;
        extra.push('הכרעת מלחמה — נזק כפול');
    }
    if (winAb === 'steal') { dmg += 2; extra.push(`${winCard.name} גנב: 2+ נזק`); }
    if (loseAb === 'shield') {
        const before = dmg;
        dmg = Math.max(0, dmg - 3);
        if (before !== dmg) extra.push('מגן: 3 נזק נבלמו');
    }

    if (playerWon) {
        S.enemyHP -= dmg; S.stats.dealt += dmg;
        floatDamage('e', dmg, 'dmg');
        if (winAb === 'vampire' && S.playerHP < START_HP) {
            const heal = Math.min(2, START_HP - S.playerHP);
            S.playerHP += heal;
            floatDamage('p', heal, 'heal');
            extra.push(`${winCard.name} ריפא ${heal} חיים`);
        }
        S.stats.wins++;
    } else {
        S.playerHP -= dmg; S.stats.taken += dmg;
        floatDamage('p', dmg, 'dmg');
        if (winAb === 'vampire' && S.enemyHP < S.enemyMaxHP) {
            const heal = Math.min(2, S.enemyMaxHP - S.enemyHP);
            S.enemyHP += heal;
            floatDamage('e', heal, 'heal');
            extra.push(`${winCard.name} ריפא ליריב ${heal} חיים`);
        }
        S.stats.losses++;
    }

    // הקלפים ששוחקו עוברים לערימת ההשלכה ויחזרו אחרי ערבוב
    S.playerDiscard.push(pCard);
    S.enemyDiscard.push(eCard);
    if (wasWar) {
        S.playerDiscard.push(...S.war.pileP);
        S.enemyDiscard.push(...S.war.pileE);
        S.war = null;
        $('warBanner').classList.remove('on');
    }

    if (S.sacrificeNote) { extra.push(S.sacrificeNote); S.sacrificeNote = ''; }
    setVerdict(
        playerWon ? `פגעתם! ${dmg} נזק` : `ספגתם ${dmg} נזק`,
        `${r.pPow} מול ${r.ePow}<br>${[notes, ...extra].join(' · ')}`,
        playerWon ? 'win' : 'lose'
    );
    setDrawButton('שלוף!', false);
    endRound();
}

function endRound() {
    S.round++;
    $('roundNum').textContent = S.round;
    updateBars(true);
    $('btnDraw').disabled = true;

    setTimeout(() => {
        if (S.playerHP <= 0 || S.enemyHP <= 0) { endGame(); return; }
        if (S.battleMode === 'monsters') { refillHand('p'); refillHand('e'); }
        // תנאי הפסד שני: חפיסה שנגמרה
        if (!S.playerDeck.length || !S.enemyDeck.length) { endGame(); return; }
        S.busy = false;
        $('btnDraw').disabled = false;
        renderHand();
    }, 750);
}

/* ---------------- מצב מלחמה ---------------- */

function startWar(pCard, eCard, r, notes) {
    if (!S.war) S.war = { pileP: [], pileE: [], depth: 0 };
    S.war.depth++;
    S.stats.wars++;

    S.war.pileP.push(pCard);
    S.war.pileE.push(eCard);

    $('vsBadge').className = 'vs-badge tie';
    $('vsBadge').textContent = '=';
    $('warBanner').classList.add('on');
    $('playerSlot').lastElementChild.classList.add('shake');
    $('enemySlot').lastElementChild.classList.add('shake');

    const dealt = { p: 0, e: 0 };
    for (let i = 0; i < 2; i++) {
        const pc = drawCard('p'); if (pc) { S.war.pileP.push(pc); dealt.p++; }
        const ec = drawCard('e'); if (ec) { S.war.pileE.push(ec); dealt.e++; }
    }

    setVerdict('מצב מלחמה!',
        `${r.pPow} מול ${r.ePow} — תיקו. ${notes}<br>כל צד הניח ${Math.max(dealt.p, dealt.e)} קלפים הפוכים. הקלף השלישי מכריע, והנזק כפול.`,
        'tie');

    let step = 0;
    const dealNext = () => {
        step++;
        if (step > 2) {
            S.busy = false;
            if (S.battleMode === 'monsters') { refillHand('p'); refillHand('e'); renderHand(); }
            else setDrawButton('שלוף קלף מכריע!', true);
            S.round++;
            $('roundNum').textContent = S.round;
            updateBars(true);
            return;
        }
        const base = S.war.pileP.length - dealt.p - 1 + step;
        if (step <= dealt.p) $('playerSlot').insertAdjacentHTML('beforeend', layerHTML(null, base, false));
        if (step <= dealt.e) $('enemySlot').insertAdjacentHTML('beforeend', layerHTML(null, base, false));
        setTimeout(dealNext, 240);
    };
    setTimeout(dealNext, 500);
}

/* הכרעת מלחמה בקרב מהיר — בקרב מפלצות הקלף המכריע נבחר מהיד */
function warDecider() {
    if (S.busy || S.battleMode === 'monsters') return;
    const pCard = drawCard('p');
    const eCard = drawCard('e');
    if (!pCard || !eCard) { endGame(); return; }
    revealAndResolve(pCard, eCard);
}

/* ---------------- סוף קרב ---------------- */

const TROPHY = `<svg viewBox="0 0 24 24" fill="none" stroke="#4ED89B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>
    <path d="M12 14v4M9 21h6M10 18h4"/></svg>`;
const SKULL = `<svg viewBox="0 0 24 24" fill="none" stroke="#F0928A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 4.5 3 5.5V20h10v-3.5c1.5-1 3-2.5 3-5.5a8 8 0 0 0-8-8Z"/>
    <circle cx="9" cy="11" r="1.8"/><circle cx="15" cy="11" r="1.8"/><path d="M11 16h2"/></svg>`;

function endGame() {
    // שני תנאי סיום: נקודות חיים או חפיסה שנגמרה
    let playerWon, reason;
    const pOut = !S.playerDeck.length, eOut = !S.enemyDeck.length;
    if (S.playerHP <= 0 && S.enemyHP <= 0) { playerWon = S.playerHP > S.enemyHP; reason = 'hp'; }
    else if (S.enemyHP <= 0) { playerWon = true;  reason = 'hp'; }
    else if (S.playerHP <= 0) { playerWon = false; reason = 'hp'; }
    else if (pOut && !eOut)   { playerWon = false; reason = 'deck'; }
    else if (eOut && !pOut)   { playerWon = true;  reason = 'deck'; }
    else if (pOut && eOut)    { playerWon = S.playerHP > S.enemyHP; reason = 'deck-both'; }
    else                      { playerWon = S.playerHP > S.enemyHP; reason = 'hp'; }

    S.pendingSummon = null;
    S.war = null;
    $('warBanner').classList.remove('on');

    const stage = S.mode === 'campaign' ? STAGES[S.stageIdx] : null;
    const rewards = [];

    if (playerWon) {
        P.wins++;
        P.coins += COINS_PER_WIN;
        rewards.push(`${COINS_PER_WIN} מטבעות`);

        // ההתקדמות נזקפת למסלול של מצב הקרב שבו שוחק השלב
        const key = clearedKey(S.battleMode);
        if (stage && (P[key] || 0) < stage.n) {
            P[key] = stage.n;
            P.gems += 2;
            P.coins += FIRST_CLEAR_COINS;
            rewards.push(`${FIRST_CLEAR_COINS} מטבעות ו-2 יהלומים על סיום ראשון`);
        }
        // תיבה על ניצחון — רק אם יש מקום בין ארבעת התאים.
        // גרסה ראשונה; תותאם למפרט של שלבים 4-6 (3 סוגים + שאלת "אין מקום")
        const slot = P.chests.findIndex(c => !c);
        if (slot >= 0) {
            const type = chestForStage(stage ? stage.n : 1);
            P.chests[slot] = { type, readyAt: chestReadyAt(type) };
            rewards.push(CHEST_TYPES[type].name);
        } else {
            rewards.push('כל תאי התיבות מלאים');
        }
    } else {
        P.losses++;
    }
    saveProfile(P);
    refreshCurrency();

    $('resultEmblem').className = 'result-emblem ' + (playerWon ? 'win' : 'lose');
    $('resultEmblem').innerHTML = playerWon ? TROPHY : SKULL;

    if (stage) {
        $('resultTitle').textContent = playerWon ? `שלב ${stage.n} הושלם!` : `${stage.name} ניצח`;
    } else {
        $('resultTitle').textContent = playerWon ? 'הזירה שלכם!' : 'הובסתם';
    }

    const isLast = stage && stage.n === STAGES.length;
    const modeName = S.battleMode === 'monsters' ? 'קרב מפלצות' : 'קרב מהיר';
    let sub;
    if (stage && playerWon) {
        sub = isLast ? `הבסתם את ${stage.name}. סיימתם את כל ${STAGES.length} השלבים ב${modeName}!`
                     : `${stage.name} הובס.`;
    } else if (stage) {
        sub = `${stage.name} עוד חזק מדי. חזקו את החפיסה ונסו שוב.`;
    } else if (reason === 'deck') {
        sub = playerWon ? 'ליריב נגמרו הקלפים בחפיסה.' : 'נגמרו לכם הקלפים בחפיסה.';
    } else if (reason === 'deck-both') {
        sub = 'שתי החפיסות נגמרו — ההכרעה לפי נקודות החיים.';
    } else {
        sub = playerWon ? 'היריב נפל. הזירה שלכם.' : 'נקודות החיים שלכם נגמרו.';
    }
    if (playerWon && rewards.length) sub += ' זכיתם ב: ' + rewards.join(', ') + '.';
    $('resultSub').textContent = sub;

    $('resultStats').innerHTML = `
        <div class="stat-tile"><div class="stat-val">${Math.max(0, S.playerHP)}</div><div class="stat-lbl">חיים שנותרו</div></div>
        <div class="stat-tile"><div class="stat-val">${S.stats.dealt}</div><div class="stat-lbl">נזק שגרמתם</div></div>
        <div class="stat-tile"><div class="stat-val">${S.stats.wars}</div><div class="stat-lbl">מצבי מלחמה</div></div>`;

    const hasNext = stage && playerWon && !isLast;
    $('btnNextStage').style.display = hasNext ? '' : 'none';
    $('btnResultEdit').style.display = (stage && !playerWon) ? '' : 'none';
    $('btnRematch').textContent = stage ? 'שחקו שוב בשלב' : 'קרב חוזר';
    $('resultOverlay').classList.add('open');
    S.busy = false;
}

/* ---------------- מסכים ---------------- */

function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

function startGame(stageIdx = null, battleMode = 'quick') {
    S.mode = stageIdx === null ? 'quick' : 'campaign';
    S.stageIdx = stageIdx;
    S.battleMode = battleMode;
    const stage = stageIdx === null ? null : STAGES[stageIdx];

    S.playerDeck = deckFromCounts(P.deck, 'p');
    S.enemyDeck = deckFromCounts(stage ? stage.deck : enemyCounts(countsPower(P.deck)), 'e');
    S.playerDiscard = []; S.enemyDiscard = [];
    S.playerHand = []; S.enemyHand = [];
    S.pendingSummon = null; S.sacrificeNote = '';
    if (battleMode === 'monsters') { refillHand('p'); refillHand('e'); }

    S.playerHP = START_HP;
    S.enemyMaxHP = stage ? stage.hp : START_HP;
    S.enemyHP = S.enemyMaxHP;

    S.round = 1;
    S.busy = false;
    S.war = null;
    S.stats = { wins: 0, losses: 0, wars: 0, dealt: 0, taken: 0 };

    $('enemyName').textContent = stage ? `${stage.n}. ${stage.name}` : 'היריב';
    $('playerNameLabel').textContent = P.name || 'אתם';
    $('enemyAvatar').innerHTML = stage
        ? `<img class="avatar-img" src="${stage.img}" alt="">`
        : monsterSVG({ body: 'spiky', c1: '#B3372E', c2: '#F0C24A', eyes: 2, eyeStyle: 'angry', horns: 'twin', mouth: 'fangs', extra: 'none', front: 'none' });

    $('roundNum').textContent = '1';
    $('playerSlot').innerHTML = layerHTML(null, 0, false);
    $('enemySlot').innerHTML = layerHTML(null, 0, false);
    $('playerPower').innerHTML = '';
    $('enemyPower').innerHTML = '';
    $('vsBadge').className = 'vs-badge';
    $('vsBadge').textContent = 'VS';
    $('warBanner').classList.remove('on');
    setDrawButton('שלוף!', false);
    $('btnDraw').hidden = battleMode === 'monsters';
    renderHand();
    setVerdict(stage ? `שלב ${stage.n} — ${stage.name}` : (battleMode === 'monsters' ? 'קרב מפלצות' : 'הזירה פתוחה'),
               stage ? stage.taunt
                     : (battleMode === 'monsters'
                        ? `כל צד מחזיק ${HAND_SIZE} קלפים ובוחר איזה לזמן בכל תור`
                        : 'הפסד בסיבוב עולה לכם בהפרש הכוח בנקודות חיים'), '');
    updateBars(false);
    $('resultOverlay').classList.remove('open');
    show('gameScreen');
}

/* ---------------- מפת השלבים ---------------- */

const ICON_LOCK = `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>`;

function deckPower(deck) {
    return Object.entries(deck).reduce((sum, [id, n]) => sum + byId(id).power * n, 0);
}

/* מפתח ההתקדמות תלוי במצב הקרב — לכל מצב מפה משלו */
function clearedKey(mode) { return mode === 'monsters' ? 'clearedMonsters' : 'cleared'; }
function clearedIn(mode) { return P[clearedKey(mode)] || 0; }

function buildMap() {
    const cleared = clearedIn(S.mapMode);
    $('progressLabel').textContent = `${cleared}/${STAGES.length}`;
    document.querySelectorAll('#mapModeTabs .mode-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.mode === S.mapMode));
    $('stageList').innerHTML = STAGES.map((s, i) => {
        const done = s.n <= cleared;
        const open = s.n === cleared + 1;
        const state = done ? 'done' : (open ? 'open' : 'locked');
        const icon = done ? ICON_CHECK : (open ? ICON_PLAY : ICON_LOCK);
        return `<button class="stage-row ${state}" data-i="${i}" ${done || open ? '' : 'disabled'}>
            <div class="stage-num">${s.n}</div>
            <div class="stage-art el-${s.el}"><img src="${s.img}" alt=""></div>
            <div class="stage-info">
                <div class="stage-name">${s.name}</div>
                <div class="stage-title">${s.title}</div>
                <div class="stage-power">כוח ${deckPower(s.deck)} · ${s.hp} חיים</div>
            </div>
            <div class="stage-state">${icon}</div>
        </button>`;
    }).join('');
}

function openMap() {
    buildMap();
    show('mapScreen');
    const next = $('stageList').querySelector('.stage-row.open');
    if (next) next.scrollIntoView({ block: 'center' });
}

/* ---------------- מטבעות ויהלומים ---------------- */

function fmtCur(v) { return v === Infinity ? '∞' : v; }

function refreshCurrency() {
    document.querySelectorAll('.coin-val').forEach(e => e.textContent = fmtCur(coinsOf(P)));
    document.querySelectorAll('.gem-val').forEach(e => e.textContent = fmtCur(gemsOf(P)));
    document.querySelectorAll('.player-name-val').forEach(e => e.textContent = P.name || 'אורח');
    $('adminBadge').style.display = isAdmin(P) ? '' : 'none';
}

/* ---------------- החנות ---------------- */

function buildShop() {
    const owned = ownedOf(P);
    $('shopGrid').innerHTML = CARD_POOL.map(card => {
        const rar = rarityOf(card);
        const price = cardPrice(card);
        const ownedN = owned[card.id] || 0;
        const maxed = ownedN >= MAX_COPIES;
        const afford = coinsOf(P) >= price;
        const dis = maxed || !afford;
        return `<div class="shop-item rar-${rar}">
            <div class="shop-art el-${card.el}${card.img ? ' has-img' : ''}">
                <div class="power-badge">${card.power}</div>
                ${artHTML(card)}
                ${ownedN ? `<div class="own-badge">×${ownedN}</div>` : ''}
            </div>
            <div class="shop-name">${card.name}${card.variant ? `<span class="card-variant">${card.variant}</span>` : ''}</div>
            <div class="shop-rar rar-${rar}">${RARITIES[rar].name}</div>
            <button class="shop-buy${dis ? ' disabled' : ''}" data-id="${card.id}" ${dis ? 'disabled' : ''}>
                ${maxed ? 'מלא (3)' : `<span class="coin-ico"></span>${price}`}
            </button>
        </div>`;
    }).join('');
}

function buyCard(id) {
    const card = byId(id);
    const ownedN = ownedOf(P)[id] || 0;
    if (ownedN >= MAX_COPIES) return toast('כבר יש לכם 3 עותקים מהקלף הזה');
    const price = cardPrice(card);
    if (!spendCoins(P, price)) return toast('אין מספיק מטבעות');
    P.owned[id] = ownedN + 1;
    saveProfile(P);
    refreshCurrency();
    buildShop();
    toast(`${card.name} נוסף לאוסף`);
}

/* ---------------- תיבות ---------------- */

let chestTimer = null;

function fmtLeft(ms) {
    if (ms <= 0) return 'מוכן';
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

const CHEST_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 10a9 9 0 0 1 18 0v9H3v-9Z"/><path d="M3 13h18"/><rect x="10" y="11" width="4" height="5" rx="1"/></svg>`;

function buildChests() {
    const now = Date.now();
    $('chestGrid').innerHTML = P.chests.map((c, i) => {
        if (!c) {
            return `<div class="chest-slot empty">
                <div class="chest-ico">${CHEST_SVG}</div>
                <div class="chest-name">תא ריק</div>
                <div class="chest-sub">נצחו קרב כדי לזכות בתיבה</div>
            </div>`;
        }
        const t = CHEST_TYPES[c.type];
        const left = c.readyAt - now;
        const ready = left <= 0;
        const cost = ready ? 0 : skipCost(left);
        return `<div class="chest-slot el-${t.el}${ready ? ' ready' : ''}" data-i="${i}">
            <div class="chest-ico">${CHEST_SVG}</div>
            <div class="chest-name">${t.name}</div>
            <div class="chest-sub timer" data-i="${i}">${ready ? 'מוכן לפתיחה' : fmtLeft(left)}</div>
            ${ready
                ? `<button class="chest-btn open" data-act="open" data-i="${i}">פתחו</button>`
                : `<button class="chest-btn skip" data-act="skip" data-i="${i}"><span class="gem-ico"></span>${cost} דלגו</button>`}
        </div>`;
    }).join('');
}

function tickChests() {
    const now = Date.now();
    let needRebuild = false;
    P.chests.forEach((c, i) => {
        if (!c) return;
        const el = $('chestGrid').querySelector(`.timer[data-i="${i}"]`);
        if (!el) return;
        const left = c.readyAt - now;
        if (left <= 0) { needRebuild = true; return; }
        el.textContent = fmtLeft(left);
        const btn = $('chestGrid').querySelector(`.chest-btn.skip[data-i="${i}"]`);
        if (btn) btn.innerHTML = `<span class="gem-ico"></span>${skipCost(left)} דלגו`;
    });
    if (needRebuild) buildChests();
}

function buildChestLegend() {
    $('chestLegend').innerHTML = Object.values(CHEST_TYPES).map(t => {
        const best = t.odds.legendary ? `אגדי ${Math.round(t.odds.legendary * 100)}%`
                   : (t.odds.epic ? `אפי ${Math.round(t.odds.epic * 100)}%` : 'רגיל בעיקר');
        const hrs = t.hours < 1 ? `${Math.round(t.hours * 60)} דק׳` : `${t.hours} שעות`;
        return `<div class="legend-row">
            <div class="chest-ico small el-${t.el}">${CHEST_SVG}</div>
            <div><div class="legend-name">${t.name} · ${hrs}</div>
            <div class="legend-desc">${t.cards} קלפים · ${best}</div></div>
        </div>`;
    }).join('');
}

function openChests() {
    buildChests();
    buildChestLegend();
    show('chestScreen');
    clearInterval(chestTimer);
    chestTimer = setInterval(tickChests, 1000);
}

function leaveChests() {
    clearInterval(chestTimer);
    chestTimer = null;
}

function skipChest(i) {
    const c = P.chests[i];
    if (!c) return;
    const left = c.readyAt - Date.now();
    if (left <= 0) return;
    const cost = skipCost(left);
    if (!spendGems(P, cost)) return toast('אין מספיק יהלומים');
    c.readyAt = Date.now();
    saveProfile(P);
    refreshCurrency();
    buildChests();
    toast('התיבה נפתחה מיד');
}

function openChest(i) {
    const c = P.chests[i];
    if (!c || c.readyAt > Date.now()) return;
    const t = CHEST_TYPES[c.type];
    const rw = openChestRewards(c.type);

    // קלף שכבר יש ממנו 3 עותקים מומר למטבעות במקום להיעלם
    let converted = 0;
    rw.cards.forEach(card => {
        const have = P.owned[card.id] || 0;
        if (have >= MAX_COPIES) { converted += Math.round(cardPrice(card) * 0.25); }
        else P.owned[card.id] = have + 1;
    });
    P.coins += rw.coins + converted;
    P.gems += rw.gems;
    P.chests[i] = null;
    saveProfile(P);
    refreshCurrency();
    buildChests();

    $('rewardTitle').textContent = t.name + ' נפתחה!';
    $('rewardCards').innerHTML = rw.cards.map(card => {
        const rar = rarityOf(card);
        return `<div class="reward-card rar-${rar}">
            <div class="shop-art el-${card.el}${card.img ? ' has-img' : ''}">${artHTML(card)}</div>
            <div class="reward-name">${card.name}</div>
            <div class="shop-rar rar-${rar}">${RARITIES[rar].name}</div>
        </div>`;
    }).join('');
    $('rewardCurrency').innerHTML =
        `<div class="reward-cur"><span class="coin-ico"></span>${rw.coins + converted}</div>` +
        (rw.gems ? `<div class="reward-cur"><span class="gem-ico"></span>${rw.gems}</div>` : '') +
        (converted ? `<div class="reward-note">${converted} מטבעות מקלפים כפולים</div>` : '');
    $('rewardOverlay').classList.add('open');
}

/* ---------------- עריכת החפיסה ---------------- */

let draftDeck = {};

function miniArt(card) {
    return `<div class="edit-art el-${card.el}${card.img ? ' has-img' : ''}">
        <div class="power-badge">${card.power}</div>
        ${artHTML(card)}
    </div>`;
}

function renderEditor() {
    // רק קלפים שבבעלות מוצגים; השאר נמצאים בחנות
    const owned = ownedOf(P);
    const ids = Object.keys(owned).filter(id => owned[id] > 0)
        .sort((a, b) => byId(b).power - byId(a).power);
    $('editList').innerHTML = ids.map(id => {
        const card = byId(id);
        const n = draftDeck[id] || 0;
        const own = owned[id];
        const ab = ABILITIES[card.ability];
        const rar = rarityOf(card);
        return `<div class="edit-row${n ? '' : ' empty'}" data-id="${card.id}">
            ${miniArt(card)}
            <div class="edit-info">
                <div class="edit-name">${card.name}${card.variant ? ` <span class="variant-tag">${card.variant}</span>` : ''} <span class="own-note">בבעלות ${own}</span></div>
                <div class="edit-ab ab-${ab.tone}">
                    <svg viewBox="0 0 24 24">${ab.icon}</svg><span>${ab.name} · ${ab.desc}</span>
                </div>
            </div>
            <div class="stepper">
                <button class="step-btn" data-act="minus" aria-label="הסר עותק">−</button>
                <span class="step-count">${n}</span>
                <button class="step-btn" data-act="plus" aria-label="הוסף עותק">+</button>
            </div>
        </div>`;
    }).join('');
    updateEditorMeter();
}

function updateEditorMeter() {
    const total = countsTotal(draftDeck);
    const ok = total === DECK_SIZE;
    $('deckCountLabel').textContent = `${total} / ${DECK_SIZE} קלפים`;
    $('deckCountLabel').classList.toggle('bad', !ok);
    $('deckPowerLabel').textContent = `כוח כולל ${countsPower(draftDeck)}`;
    $('deckMeterBar').style.width = Math.min(100, (total / DECK_SIZE) * 100) + '%';
    $('deckMeterBar').classList.toggle('over', total > DECK_SIZE);
    $('btnSaveDeck').disabled = !ok;
    const gap = Math.abs(DECK_SIZE - total);
    $('btnSaveDeck').textContent = ok ? 'שמור חפיסה' : (total < DECK_SIZE
        ? (gap === 1 ? 'חסר קלף אחד' : `חסרים ${gap} קלפים`)
        : (gap === 1 ? 'יש קלף אחד עודף' : `יש ${gap} קלפים עודפים`));
}

function openEditor() {
    draftDeck = { ...P.deck };
    renderEditor();
    show('editScreen');
}

function stepCard(id, delta) {
    const cur = draftDeck[id] || 0;
    const own = ownedOf(P)[id] || 0;
    const next = cur + delta;
    if (next < 0) return;
    if (next > Math.min(MAX_COPIES, own)) return toast(`יש לכם רק ${own} עותקים`);
    if (delta > 0 && countsTotal(draftDeck) >= DECK_SIZE) return;
    if (next === 0) delete draftDeck[id]; else draftDeck[id] = next;

    const row = $('editList').querySelector(`.edit-row[data-id="${id}"]`);
    row.querySelector('.step-count').textContent = next;
    row.classList.toggle('empty', next === 0);
    updateEditorMeter();
}

/* ---------------- הודעות קצרות ---------------- */

let toastTimer = null;
function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

/* ---------------- אוסף ומקרא ---------------- */

function buildCodex() {
    $('codexGrid').innerHTML = CARD_POOL.map(c => `<div class="codex-card">${cardFrontHTML(c)}</div>`).join('');
}

function buildLegend() {
    $('abilityLegend').innerHTML = Object.values(ABILITIES).map(ab => `
        <div class="legend-row ab-${ab.tone}">
            <svg viewBox="0 0 24 24">${ab.icon}</svg>
            <div><div class="legend-name">${ab.name}</div><div class="legend-desc">${ab.desc}</div></div>
        </div>`).join('');
}

/* ---------------- שם השחקן ---------------- */

function openNameScreen(first) {
    $('nameInput').value = P.name || '';
    $('nameTitle').textContent = first ? 'ברוכים הבאים לזירה' : 'שינוי שם שחקן';
    $('nameSub').textContent = first
        ? 'בחרו שם שחקן כדי להתחיל'
        : 'אפשר לשנות את השם בכל רגע';
    $('btnNameSkip').style.display = first ? 'none' : '';
    show('nameScreen');
    setTimeout(() => $('nameInput').focus(), 150);
}

function saveName() {
    const v = $('nameInput').value.trim();
    if (!v) return toast('צריך להזין שם');
    if (v.length > 16) return toast('שם ארוך מדי (עד 16 תווים)');
    P.name = v;
    saveProfile(P);
    refreshCurrency();
    toast(isAdmin(P) ? 'ברוך הבא, אדמין — כסף אינסופי הופעל' : `שלום ${v}`);
    show('homeScreen');
}

/* ---------------- אתחול ---------------- */

document.addEventListener('DOMContentLoaded', () => {
    P = loadProfile();

    $('crest').innerHTML = `<img class="crest-img" src="art/logo.jpg" alt="הזירה"
        onerror="this.remove(); document.getElementById('crest').innerHTML = monsterSVG(CARD_POOL[0].art);">`;
    $('meAvatar').innerHTML = monsterSVG({ body: 'blob', c1: '#3A65B8', c2: '#BFE4FF', eyes: 2, eyeStyle: 'glow', horns: 'ears', mouth: 'grin', extra: 'none', front: 'none' });

    buildCodex();
    buildLegend();
    refreshCurrency();

    // ניווט ראשי
    $('btnCampaign').addEventListener('click', openMap);
    $('btnPlay').addEventListener('click', () => startGame(null, 'quick'));
    $('btnMonsters').addEventListener('click', () => startGame(null, 'monsters'));
    $('handRow').addEventListener('click', e => {
        const btn = e.target.closest('.hand-card');
        if (!btn || btn.disabled) return;
        playFromHand(+btn.dataset.i);
    });
    $('btnEdit').addEventListener('click', openEditor);
    $('btnShop').addEventListener('click', () => { buildShop(); show('shopScreen'); });
    $('btnChests').addEventListener('click', openChests);
    $('btnCodex').addEventListener('click', () => show('codexScreen'));
    $('btnRules').addEventListener('click', () => $('rulesOverlay').classList.add('open'));
    $('profileChip').addEventListener('click', () => openNameScreen(false));

    // חזרה
    const backHome = () => show('homeScreen');
    $('btnMapBack').addEventListener('click', backHome);
    $('btnShopBack').addEventListener('click', backHome);
    $('btnChestBack').addEventListener('click', () => { leaveChests(); backHome(); });
    $('btnEditBack').addEventListener('click', backHome);
    document.querySelector('.codex-back').addEventListener('click', backHome);

    // קרב
    $('btnDraw').addEventListener('click', drawRound);
    $('btnRematch').addEventListener('click', () => startGame(S.stageIdx, S.battleMode));
    $('btnHome').addEventListener('click', () => {
        $('resultOverlay').classList.remove('open');
        S.mode === 'campaign' ? openMap() : show('homeScreen');
    });
    $('btnQuit').addEventListener('click', () => (S.mode === 'campaign' ? openMap() : show('homeScreen')));
    $('btnNextStage').addEventListener('click', () => {
        $('resultOverlay').classList.remove('open');
        const next = S.stageIdx + 1;
        next < STAGES.length ? startGame(next, S.battleMode) : openMap();
    });
    $('btnResultEdit').addEventListener('click', () => {
        $('resultOverlay').classList.remove('open');
        openEditor();
    });
    $('stageList').addEventListener('click', e => {
        const row = e.target.closest('.stage-row');
        if (!row || row.disabled) return;
        $('resultOverlay').classList.remove('open');
        startGame(+row.dataset.i, S.mapMode);
    });
    $('mapModeTabs').addEventListener('click', e => {
        const tab = e.target.closest('.mode-tab');
        if (!tab || tab.dataset.mode === S.mapMode) return;
        S.mapMode = tab.dataset.mode;
        openMap();
    });

    // חנות
    $('shopGrid').addEventListener('click', e => {
        const btn = e.target.closest('.shop-buy');
        if (!btn || btn.disabled) return;
        buyCard(+btn.dataset.id);
    });

    // תיבות
    $('chestGrid').addEventListener('click', e => {
        const btn = e.target.closest('.chest-btn');
        if (!btn) return;
        const i = +btn.dataset.i;
        btn.dataset.act === 'open' ? openChest(i) : skipChest(i);
    });
    $('btnRewardClose').addEventListener('click', () => $('rewardOverlay').classList.remove('open'));

    // עריכת חפיסה
    $('btnReset').addEventListener('click', () => { draftDeck = repairDeck(ownedOf(P)); renderEditor(); });
    $('editList').addEventListener('click', e => {
        const btn = e.target.closest('.step-btn');
        if (!btn) return;
        stepCard(+btn.closest('.edit-row').dataset.id, btn.dataset.act === 'plus' ? 1 : -1);
    });
    $('btnSaveDeck').addEventListener('click', () => {
        if (countsTotal(draftDeck) !== DECK_SIZE) return;
        P.deck = { ...draftDeck };
        saveProfile(P);
        toast('החפיסה נשמרה');
        show('homeScreen');
    });

    // שם שחקן
    $('btnNameSave').addEventListener('click', saveName);
    $('btnNameSkip').addEventListener('click', () => show('homeScreen'));
    $('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });

    // חוקים
    document.querySelectorAll('.close-overlay').forEach(b =>
        b.addEventListener('click', () => $('rulesOverlay').classList.remove('open')));
    $('rulesOverlay').addEventListener('click', e => {
        if (e.target === $('rulesOverlay')) $('rulesOverlay').classList.remove('open');
    });

    // מסך פתיחה: בחירת שם בהרצה ראשונה
    if (!P.name) openNameScreen(true); else show('homeScreen');
});
