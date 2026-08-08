/* ============================================================================
   הזירה — גשר ל-Firebase: התחברות אדמין ועריכת קלפים גלובלית
   ============================================================================
   קובץ זה הוא ES module (טעון עם type="module"), ולכן רץ בסקופ נפרד
   מ-monsters.js / economy.js / game.js (סקריפטים רגילים). הגישור נעשה
   דרך window: הקובץ הזה חושף window.FirebaseAdmin, וקורא ל-
   window.setAdminSessionActive שמוגדר ב-economy.js.

   אם הדף רץ בלי אינטרנט, או ש-Firestore/Authentication עדיין לא
   הופעלו בפרויקט, כל הפעולות כאן נכשלות בשקט והמשחק ממשיך לרוץ
   עם ערכי ברירת המחדל המקומיים של הקלפים (CARD_POOL). זהו הגיבוי
   האופליין — אין לו קוד נפרד, הוא פשוט המצב שבו אף override לא הוחל.
   ============================================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
    getFirestore, doc, onSnapshot, setDoc, updateDoc, deleteField, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyBkVcklb9PM5L62_MFZ0rE_jFd3uNPmc5U',
    authDomain: 'the-arena-game.firebaseapp.com',
    projectId: 'the-arena-game',
    storageBucket: 'the-arena-game.firebasestorage.app',
    messagingSenderId: '107502274004'
};

/* שם המשתמש "ld2000" ממופה לכתובת דוא"ל פנימית קבועה — Firebase
   Authentication מזהה משתמשים לפי אימייל, לא לפי שם משתמש חופשי.
   זו לא תיבת דוא"ל אמיתית, רק מזהה. */
const ADMIN_USERNAME = 'ld2000';
const ADMIN_EMAIL = 'ld2000@thearena.local';
const OVERRIDES_DOC = ['gameConfig', 'cardOverrides'];

let app, auth, db;
let firebaseReady = false;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseReady = true;
} catch (e) {
    console.warn('Firebase לא אותחל — המשחק ימשיך במצב מקומי בלבד:', e);
}

if (firebaseReady) {
    onAuthStateChanged(auth, user => {
        const active = !!(user && user.email === ADMIN_EMAIL);
        if (typeof window.setAdminSessionActive === 'function') window.setAdminSessionActive(active);
    });
}

/* ---------------- התחברות / התנתקות ---------------- */

async function login(username, password) {
    if (!firebaseReady) throw new Error('לא ניתן להתחבר — Firebase לא זמין כרגע');
    if ((username || '').trim().toLowerCase() !== ADMIN_USERNAME) {
        throw new Error('שם משתמש שגוי');
    }
    try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    } catch (e) {
        if (e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed') {
            throw new Error('SETUP_REQUIRED');   // Authentication עדיין לא הופעל בקונסולת Firebase
        }
        if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
            throw new Error('שם משתמש או סיסמה שגויים');
        }
        throw new Error('שגיאת התחברות: ' + (e.code || e.message));
    }
}

async function logout() {
    if (!firebaseReady) return;
    try { await signOut(auth); } catch (e) { /* כבר מנותק */ }
}

/* ---------------- עריכת קלפים גלובלית ---------------- */

/* מאזין בזמן אמת ל-overrides. מחזיר פונקציית ביטול-מנוי. */
function subscribeCardOverrides(applyFn) {
    if (!firebaseReady) return () => {};
    try {
        return onSnapshot(
            doc(db, ...OVERRIDES_DOC),
            snap => applyFn(snap.exists() ? snap.data() : {}),
            err => console.warn('סנכרון עריכות קלפים נכשל — נשארים על ברירת המחדל המקומית:', err.message)
        );
    } catch (e) {
        console.warn('לא ניתן להירשם לעדכוני קלפים:', e);
        return () => {};
    }
}

/* fields: אובייקט עם name/power/ability/priceOverride.
   ערך null מוחק את השדה הספציפי וחוזר לברירת המחדל של הקלף. */
async function saveCardOverride(cardId, fields) {
    if (!firebaseReady) throw new Error('אין חיבור לשרת');
    const ref = doc(db, ...OVERRIDES_DOC);
    const updates = {};
    for (const [k, v] of Object.entries(fields)) {
        updates[`${cardId}.${k}`] = (v === null || v === undefined) ? deleteField() : v;
    }
    updates[`${cardId}.updatedAt`] = serverTimestamp();
    try {
        await updateDoc(ref, updates);
    } catch (e) {
        if (e.code === 'not-found') {
            // המסמך עוד לא קיים — כתיבה ראשונה יוצרת אותו
            const clean = {};
            for (const [k, v] of Object.entries(fields)) if (v !== null && v !== undefined) clean[k] = v;
            clean.updatedAt = serverTimestamp();
            await setDoc(ref, { [cardId]: clean }, { merge: true });
        } else {
            throw e;
        }
    }
}

/* מוחק את כל ה-override של קלף מסוים, חזרה לברירת המחדל */
async function resetCardOverride(cardId) {
    if (!firebaseReady) throw new Error('אין חיבור לשרת');
    const ref = doc(db, ...OVERRIDES_DOC);
    try {
        await updateDoc(ref, { [cardId]: deleteField() });
    } catch (e) {
        if (e.code !== 'not-found') throw e;   // אם המסמך לא קיים ממילא אין מה לאפס
    }
}

window.FirebaseAdmin = {
    ready: firebaseReady,
    login, logout,
    subscribeCardOverrides, saveCardOverride, resetCardOverride
};

/* הסקריפט הזה טעון עם async כדי שרשת איטית/חסומה לעולם לא תעכב
   את עליית המשחק. game.js לא יכול להניח ש-window.FirebaseAdmin
   כבר קיים ב-DOMContentLoaded, ולכן מחכה לאירוע הזה במקום. */
window.dispatchEvent(new CustomEvent('firebaseAdminReady'));
