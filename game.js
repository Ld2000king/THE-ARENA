/* ============================================================================
   הזירה — לוגיקת המשחק
   ============================================================================ */

const $ = id => document.getElementById(id);

const DECK_SIZE = 20;
const MAX_COPIES = 3;
const STORE_KEY = 'zira-deck-v1';

const S = {
    playerDeck: [],
    enemyDeck: [],
    round: 1,
    busy: false,
    knockouts: 0,
    war: null,                 // { pileP: [], pileE: [], depth: 1 } כשמצב מלחמה פעיל
    counts: {},                // תצורת החפיסה של השחקן: { cardId: copies }
    stats: { wins: 0, losses: 0, wars: 0 }
};

/* ---------------- עזרים ---------------- */

const byId = id => CARD_POOL.find(c => c.id === id);
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function countsTotal(counts) {
    return Object.values(counts).reduce((a, b) => a + b, 0);
}

function countsPower(counts) {
    return Object.entries(counts).reduce((sum, [id, n]) => sum + byId(+id).power * n, 0);
}

function defaultCounts() {
    const c = {};
    CARD_POOL.forEach(card => { c[card.id] = 1; });
    return c;
}

function loadCounts() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORE_KEY));
        if (raw && countsTotal(raw) === DECK_SIZE) return raw;
    } catch (e) { /* חפיסה שמורה לא תקינה — נשתמש בברירת המחדל */ }
    return defaultCounts();
}

function saveCounts(counts) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(counts)); } catch (e) { /* אין אחסון */ }
}

/* בונה חפיסה מעורבבת מתוך תצורת עותקים */
function deckFromCounts(counts, owner) {
    const cards = [];
    Object.entries(counts).forEach(([id, n]) => {
        for (let i = 0; i < n; i++) {
            cards.push({ ...byId(+id), uid: `${owner}-${id}-${i}` });
        }
    });
    return shuffle(cards);
}

/* חפיסת יריב אקראית וחוקית, בעוצמה קרובה לזו של השחקן */
function enemyCounts(targetPower) {
    const ids = CARD_POOL.map(c => c.id);
    const counts = {};
    let placed = 0;
    while (placed < DECK_SIZE) {
        const id = rnd(ids);
        if ((counts[id] || 0) < MAX_COPIES) { counts[id] = (counts[id] || 0) + 1; placed++; }
    }
    // תיקון הדרגתי לכיוון עוצמת היעד — החלפת קלף בקלף חזק/חלש יותר
    for (let i = 0; i < 3000; i++) {
        const diff = countsPower(counts) - targetPower;
        if (Math.abs(diff) <= 2) break;
        const stronger = diff < 0;
        const from = rnd(Object.keys(counts).filter(id => counts[id] > 0));
        const options = ids.filter(id => (counts[id] || 0) < MAX_COPIES &&
            (stronger ? byId(id).power > byId(+from).power : byId(id).power < byId(+from).power));
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

/* ציור הקלף: תמונה אם הוגדרה, אחרת המפלצת המצוירת.
   אם קובץ התמונה חסר — onerror מסמן את המסגרת ונופלים חזרה לציור. */
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

/* נופלים חזרה למפלצת המצוירת כשקובץ התמונה חסר או פגום */
function markArtFailed(img) {
    const box = img.closest('.card-art, .edit-art');
    if (box) box.classList.add('img-failed');
}

function cardFrontHTML(card) {
    return `<div class="card-face card-front el-${card.el}">
        <div class="card-art${card.img ? ' has-img' : ''}">
            <div class="power-badge">${card.power}</div>
            ${artHTML(card)}
        </div>
        <div class="card-name">${card.name}</div>
        ${abilityChip(card.ability)}
    </div>`;
}

const SIGIL = `<svg class="sigil" viewBox="0 0 100 100">
    <path d="M50 8 L86 30 V70 L50 92 L14 70 V30 Z"/>
    <path d="M50 24 L72 37 V63 L50 76 L28 63 V37 Z"/>
    <circle cx="50" cy="50" r="8"/>
</svg>`;

const backHTML = () => `<div class="card-face card-back">${SIGIL}</div>`;

/* שכבת קלף בערימה. index קובע את ההיסט הוויזואלי */
function layerHTML(card, index, faceUp) {
    return `<div class="card-layer" style="--i:${index}">
        <div class="card${faceUp ? ' flipped' : ''}">
            ${backHTML()}
            ${card ? cardFrontHTML(card) : ''}
        </div>
    </div>`;
}

/* ---------------- חישוב הקרב ---------------- */

function resolveRound(pCard, eCard) {
    const notes = [];

    // "מבטל" מנטרל את יכולת היריב
    let pAb = pCard.ability, eAb = eCard.ability;
    if (eAb === 'nullify' && pAb !== 'none') { pAb = 'none'; notes.push(`${eCard.name} ביטל את היכולת שלכם`); }
    if (pCard.ability === 'nullify' && eAb !== 'none') { eAb = 'none'; notes.push(`${pCard.name} ביטל את יכולת היריב`); }

    let pPow = pCard.power, ePow = eCard.power;

    // "נועז" — נמדד מול הכוח הבסיסי
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

/* ---------------- תצוגה ---------------- */

function updateBars(anim) {
    $('playerCount').textContent = S.playerDeck.length;
    $('enemyCount').textContent = S.enemyDeck.length;
    $('playerBar').style.width = Math.min(100, (S.playerDeck.length / DECK_SIZE) * 100) + '%';
    $('enemyBar').style.width = Math.min(100, (S.enemyDeck.length / DECK_SIZE) * 100) + '%';
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

/* ---------------- מהלך הסיבוב ---------------- */

function drawRound() {
    if (S.busy) return;
    if (S.war) { warDecider(); return; }

    S.busy = true;
    $('btnDraw').disabled = true;

    const pCard = S.playerDeck.shift();
    const eCard = S.enemyDeck.shift();

    $('playerSlot').innerHTML = layerHTML(pCard, 0, false);
    $('enemySlot').innerHTML = layerHTML(eCard, 0, false);
    $('playerPower').innerHTML = '';
    $('enemyPower').innerHTML = '';
    $('vsBadge').className = 'vs-badge';
    $('vsBadge').textContent = 'VS';
    setVerdict('שולפים...', 'הקלפים נחשפים', '');
    updateBars(false);

    setTimeout(() => {
        $('playerSlot').querySelector('.card').classList.add('flipped');
        $('enemySlot').querySelector('.card').classList.add('flipped');
    }, 200);

    setTimeout(() => finishRound(pCard, eCard), 880);
}

function finishRound(pCard, eCard) {
    const r = resolveRound(pCard, eCard);
    const pTop = $('playerSlot').lastElementChild;
    const eTop = $('enemySlot').lastElementChild;

    $('playerPower').innerHTML = powerHTML(pCard.power, r.pPow);
    $('enemyPower').innerHTML = powerHTML(eCard.power, r.ePow);

    const notes = r.notes.length ? r.notes.join(' · ') : 'קרב כוח נקי, בלי יכולות';

    if (r.outcome === 'tie') {
        startWar(pCard, eCard, r, notes);
        return;
    }

    const playerWon = r.outcome === 'player';
    const winnerDeck = playerWon ? S.playerDeck : S.enemyDeck;
    const loserDeck = playerWon ? S.enemyDeck : S.playerDeck;
    const winCard = playerWon ? pCard : eCard;
    const loseCard = playerWon ? eCard : pCard;
    const winAb = playerWon ? r.pAb : r.eAb;
    const loseAb = playerWon ? r.eAb : r.pAb;

    (playerWon ? pTop : eTop).classList.add('winner');
    (playerWon ? eTop : pTop).classList.add('loser');
    $('vsBadge').className = 'vs-badge ' + (playerWon ? 'win' : 'lose');
    $('vsBadge').textContent = playerWon ? '▲' : '▼';

    const extra = [];

    if (S.war) {
        // הכרעת מלחמה — המנצח לוקח את כל הערימה משני הצדדים
        const spoils = [...S.war.pileP, ...S.war.pileE, winCard, loseCard];
        winnerDeck.push(...shuffle(spoils));
        extra.push(`לקח את כל ${spoils.length} הקלפים שבערימה`);
        S.war = null;
        $('warBanner').classList.remove('on');
    } else {
        // סיבוב רגיל — המנצח חוזר לחפיסה, המפסיד מודח
        winnerDeck.push(winCard);
        if (loseAb === 'shield') {
            loserDeck.push(loseCard);
            extra.push(`${loseCard.name} הגן על עצמו ושרד`);
        } else {
            S.knockouts++;
            extra.push(`${loseCard.name} הודח מהזירה`);
        }
        if (winAb === 'steal' && loserDeck.length > 0) {
            winnerDeck.push(loserDeck.shift());
            extra.push(`${winCard.name} גנב קלף נוסף`);
        }
    }

    if (playerWon) S.stats.wins++; else S.stats.losses++;

    setVerdict(
        playerWon ? 'ניצחתם בסיבוב!' : 'היריב לקח את הסיבוב',
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
        if (S.playerDeck.length === 0 || S.enemyDeck.length === 0) endGame();
        else { S.busy = false; $('btnDraw').disabled = false; }
    }, 700);
}

/* ---------------- מצב מלחמה ---------------- */

function startWar(pCard, eCard, r, notes) {
    const first = !S.war;
    if (first) S.war = { pileP: [], pileE: [], depth: 0 };
    S.war.depth++;
    S.stats.wars++;

    // הקלפים שהתקבלו בתיקו נשארים בערימה
    S.war.pileP.push(pCard);
    S.war.pileE.push(eCard);

    $('vsBadge').className = 'vs-badge tie';
    $('vsBadge').textContent = '=';
    $('warBanner').classList.add('on');
    $('playerSlot').lastElementChild.classList.add('shake');
    $('enemySlot').lastElementChild.classList.add('shake');

    // כל צד מניח עד 2 קלפים הפוכים מעל הקלף הנוכחי
    const dealt = { p: 0, e: 0 };
    for (let i = 0; i < 2; i++) {
        if (S.playerDeck.length > 0) { S.war.pileP.push(S.playerDeck.shift()); dealt.p++; }
        if (S.enemyDeck.length > 0) { S.war.pileE.push(S.enemyDeck.shift()); dealt.e++; }
    }

    setVerdict('מצב מלחמה!',
        `${r.pPow} מול ${r.ePow} — תיקו. ${notes}<br>כל צד הניח ${Math.max(dealt.p, dealt.e)} קלפים הפוכים. הקלף השלישי מכריע — המנצח לוקח הכול.`,
        'tie');

    // אנימציית הנחה של הקלפים ההפוכים
    let step = 0;
    const dealNext = () => {
        step++;
        if (step > 2) {
            setDrawButton('שלוף קלף מכריע!', true);
            S.busy = false;
            S.round++;
            $('roundNum').textContent = S.round;
            updateBars(true);
            return;
        }
        const base = S.war.pileP.length - dealt.p - 1 + step;   // מיקום השכבה בערימה
        if (step <= dealt.p) $('playerSlot').insertAdjacentHTML('beforeend', layerHTML(null, base, false));
        if (step <= dealt.e) $('enemySlot').insertAdjacentHTML('beforeend', layerHTML(null, base, false));
        setTimeout(dealNext, 240);
    };
    setTimeout(dealNext, 500);
}

function warDecider() {
    if (S.busy) return;
    // אם לצד כלשהו אין קלף להכרעה — המשחק נגמר
    if (S.playerDeck.length === 0 || S.enemyDeck.length === 0) { endGame(); return; }

    S.busy = true;
    $('btnDraw').disabled = true;

    const pCard = S.playerDeck.shift();
    const eCard = S.enemyDeck.shift();
    const idx = Math.max(S.war.pileP.length, S.war.pileE.length);

    $('playerSlot').insertAdjacentHTML('beforeend', layerHTML(pCard, idx, false));
    $('enemySlot').insertAdjacentHTML('beforeend', layerHTML(eCard, idx, false));
    setVerdict('הכרעה!', 'הקלף המכריע נחשף', 'tie');
    updateBars(false);

    setTimeout(() => {
        $('playerSlot').lastElementChild.querySelector('.card').classList.add('flipped');
        $('enemySlot').lastElementChild.querySelector('.card').classList.add('flipped');
    }, 200);

    setTimeout(() => finishRound(pCard, eCard), 880);
}

/* ---------------- סוף משחק ---------------- */

const TROPHY = `<svg viewBox="0 0 24 24" fill="none" stroke="#4ED89B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>
    <path d="M12 14v4M9 21h6M10 18h4"/></svg>`;
const SKULL = `<svg viewBox="0 0 24 24" fill="none" stroke="#F0928A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 4.5 3 5.5V20h10v-3.5c1.5-1 3-2.5 3-5.5a8 8 0 0 0-8-8Z"/>
    <circle cx="9" cy="11" r="1.8"/><circle cx="15" cy="11" r="1.8"/><path d="M11 16h2"/></svg>`;

function endGame() {
    const playerWon = S.playerDeck.length > 0;
    S.war = null;
    $('warBanner').classList.remove('on');
    $('resultEmblem').className = 'result-emblem ' + (playerWon ? 'win' : 'lose');
    $('resultEmblem').innerHTML = playerWon ? TROPHY : SKULL;
    $('resultTitle').textContent = playerWon ? 'הזירה שלכם!' : 'הובסתם';
    $('resultSub').textContent = (playerWon
        ? 'ליריב נגמרו הקלפים. אתם שולטים בזירה.'
        : 'החפיסה שלכם התרוקנה. הזירה עברה ליריב.')
        + ` ${S.knockouts} מפלצות הודחו לאורך ${S.round - 1} סיבובים.`;
    $('resultStats').innerHTML = `
        <div class="stat-tile"><div class="stat-val">${S.stats.wins}</div><div class="stat-lbl">סיבובים שניצחתם</div></div>
        <div class="stat-tile"><div class="stat-val">${S.stats.losses}</div><div class="stat-lbl">סיבובים שהפסדתם</div></div>
        <div class="stat-tile"><div class="stat-val">${S.stats.wars}</div><div class="stat-lbl">מצבי מלחמה</div></div>`;
    $('resultOverlay').classList.add('open');
    S.busy = false;
}

/* ---------------- מסכים ---------------- */

function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

function startGame() {
    S.playerDeck = deckFromCounts(S.counts, 'p');
    S.enemyDeck = deckFromCounts(enemyCounts(countsPower(S.counts)), 'e');
    S.round = 1;
    S.busy = false;
    S.war = null;
    S.knockouts = 0;
    S.stats = { wins: 0, losses: 0, wars: 0 };

    $('roundNum').textContent = '1';
    $('playerSlot').innerHTML = layerHTML(null, 0, false);
    $('enemySlot').innerHTML = layerHTML(null, 0, false);
    $('playerPower').innerHTML = '';
    $('enemyPower').innerHTML = '';
    $('vsBadge').className = 'vs-badge';
    $('vsBadge').textContent = 'VS';
    $('warBanner').classList.remove('on');
    setDrawButton('שלוף!', false);
    setVerdict('הזירה פתוחה', 'לחצו "שלוף!" כדי לחשוף את הקלפים העליונים', '');
    updateBars(false);
    $('resultOverlay').classList.remove('open');
    show('gameScreen');
}

/* ---------------- עריכת החפיסה ---------------- */

let draftCounts = {};

function miniArt(card) {
    return `<div class="edit-art el-${card.el}${card.img ? ' has-img' : ''}">
        <div class="power-badge">${card.power}</div>
        ${artHTML(card)}
    </div>`;
}

function renderEditor() {
    $('editList').innerHTML = CARD_POOL.map(card => {
        const n = draftCounts[card.id] || 0;
        const ab = ABILITIES[card.ability];
        return `<div class="edit-row${n ? '' : ' empty'}" data-id="${card.id}">
            ${miniArt(card)}
            <div class="edit-info">
                <div class="edit-name">${card.name}</div>
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
    const total = countsTotal(draftCounts);
    const ok = total === DECK_SIZE;
    $('deckCountLabel').textContent = `${total} / ${DECK_SIZE} קלפים`;
    $('deckCountLabel').classList.toggle('bad', !ok);
    $('deckPowerLabel').textContent = `כוח כולל ${countsPower(draftCounts)}`;
    $('deckMeterBar').style.width = Math.min(100, (total / DECK_SIZE) * 100) + '%';
    $('deckMeterBar').classList.toggle('over', total > DECK_SIZE);
    $('btnSaveDeck').disabled = !ok;
    const gap = Math.abs(DECK_SIZE - total);
    $('btnSaveDeck').textContent = ok ? 'שמור והתחל קרב' : (total < DECK_SIZE
        ? (gap === 1 ? 'חסר קלף אחד' : `חסרים ${gap} קלפים`)
        : (gap === 1 ? 'יש קלף אחד עודף' : `יש ${gap} קלפים עודפים`));
}

function openEditor() {
    draftCounts = { ...S.counts };
    renderEditor();
    show('editScreen');
}

function stepCard(id, delta) {
    const cur = draftCounts[id] || 0;
    const next = cur + delta;
    if (next < 0 || next > MAX_COPIES) return;
    if (delta > 0 && countsTotal(draftCounts) >= DECK_SIZE) return;   // אין מקום בחפיסה
    if (next === 0) delete draftCounts[id]; else draftCounts[id] = next;

    const row = $('editList').querySelector(`.edit-row[data-id="${id}"]`);
    row.querySelector('.step-count').textContent = next;
    row.classList.toggle('empty', next === 0);
    updateEditorMeter();
}

/* ---------------- אתחול ---------------- */

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

document.addEventListener('DOMContentLoaded', () => {
    S.counts = loadCounts();

    // לוגו המשחק; אם הקובץ חסר נופלים חזרה למפלצת המצוירת
    $('crest').innerHTML = `<img class="crest-img" src="art/logo.jpg" alt="הזירה"
        onerror="this.remove(); document.getElementById('crest').innerHTML = monsterSVG(CARD_POOL[0].art);">`;
    $('enemyAvatar').innerHTML = monsterSVG({ body: 'spiky', c1: '#B3372E', c2: '#F0C24A', eyes: 2, eyeStyle: 'angry', horns: 'twin', mouth: 'fangs', extra: 'none', front: 'none' });
    $('meAvatar').innerHTML = monsterSVG({ body: 'blob', c1: '#3A65B8', c2: '#BFE4FF', eyes: 2, eyeStyle: 'glow', horns: 'ears', mouth: 'grin', extra: 'none', front: 'none' });

    buildCodex();
    buildLegend();

    $('btnPlay').addEventListener('click', startGame);
    $('btnDraw').addEventListener('click', drawRound);
    $('btnRematch').addEventListener('click', startGame);
    $('btnHome').addEventListener('click', () => { $('resultOverlay').classList.remove('open'); show('homeScreen'); });
    $('btnQuit').addEventListener('click', () => show('homeScreen'));
    $('btnCodex').addEventListener('click', () => show('codexScreen'));
    document.querySelector('.codex-back').addEventListener('click', () => show('homeScreen'));

    // עריכת חפיסה
    $('btnEdit').addEventListener('click', openEditor);
    $('btnEditBack').addEventListener('click', () => show('homeScreen'));
    $('btnReset').addEventListener('click', () => { draftCounts = defaultCounts(); renderEditor(); });
    $('editList').addEventListener('click', e => {
        const btn = e.target.closest('.step-btn');
        if (!btn) return;
        stepCard(+btn.closest('.edit-row').dataset.id, btn.dataset.act === 'plus' ? 1 : -1);
    });
    $('btnSaveDeck').addEventListener('click', () => {
        if (countsTotal(draftCounts) !== DECK_SIZE) return;
        S.counts = { ...draftCounts };
        saveCounts(S.counts);
        startGame();
    });

    // חוקים
    $('btnRules').addEventListener('click', () => $('rulesOverlay').classList.add('open'));
    document.querySelectorAll('.close-overlay').forEach(b =>
        b.addEventListener('click', () => $('rulesOverlay').classList.remove('open')));
    $('rulesOverlay').addEventListener('click', e => {
        if (e.target === $('rulesOverlay')) $('rulesOverlay').classList.remove('open');
    });
});
