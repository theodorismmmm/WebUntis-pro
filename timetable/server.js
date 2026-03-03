'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Dynamic import shim for ESM-based webuntis package
let WebUntis;

async function loadWebUntis() {
    const mod = await import('webuntis');
    WebUntis = mod.WebUntis;
}

const app = express();
const PORT = process.env.PORT || 3000;

const SCHOOL = process.env.SCHOOL || 'kippenberg-gymnasium';
const UNTIS_HOST = process.env.UNTIS_HOST || 'nessa.webuntis.com';
const UNTIS_USER = process.env.UNTIS_USER || '';
const UNTIS_PASSWORD = process.env.UNTIS_PASSWORD || '';

/** Shared WebUntis session reused across requests. */
let untisSession = null;

async function getSession() {
    if (!UNTIS_USER || !UNTIS_PASSWORD) {
        throw new Error('Server is not configured. Please set UNTIS_USER and UNTIS_PASSWORD environment variables.');
    }
    if (untisSession) {
        try {
            const valid = await untisSession.validateSession();
            if (valid) return untisSession;
        } catch (_) {
            // session expired – create a new one
        }
    }
    const instance = new WebUntis(SCHOOL, UNTIS_USER, UNTIS_PASSWORD, UNTIS_HOST, 'KippenbergTimetable');
    await instance.login();
    untisSession = instance;
    return instance;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

/** Rate limit: max 60 requests per minute per IP. */
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

/**
 * Format a WebUntis date number (YYYYMMDD) to a JS Date.
 */
function untisDateToDate(dateNum) {
    const s = String(dateNum);
    const year = parseInt(s.slice(0, 4), 10);
    const month = parseInt(s.slice(4, 6), 10) - 1;
    const day = parseInt(s.slice(6, 8), 10);
    return new Date(year, month, day);
}

/**
 * Format a WebUntis time number (HHMM or HMM) to a readable string.
 */
function untisTimeToString(timeNum) {
    const s = String(timeNum).padStart(4, '0');
    return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

/**
 * Returns Monday–Friday dates for the ISO week containing the given date.
 */
function getWeekDates(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun, 1=Mon, ...
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return Array.from({ length: 5 }, (_, i) => {
        const dt = new Date(monday);
        dt.setDate(monday.getDate() + i);
        return dt;
    });
}

/**
 * GET /api/timetable?date=YYYY-MM-DD
 * Returns the timetable for the week containing the given date.
 */
app.get('/api/timetable', async (req, res) => {
    try {
        const dateParam = req.query.date;
        const targetDate = dateParam ? new Date(dateParam) : new Date();

        const weekDates = getWeekDates(targetDate);
        const monday = weekDates[0];
        const friday = weekDates[4];

        const untis = await getSession();
        const timetable = await untis.getOwnTimetableForRange(monday, friday);

        // Normalise and sort lessons
        const lessons = timetable
            .map((lesson) => ({
                id: lesson.id,
                date: lesson.date,
                dateLabel: untisDateToDate(lesson.date).toISOString().slice(0, 10),
                startTime: lesson.startTime,
                endTime: lesson.endTime,
                startLabel: untisTimeToString(lesson.startTime),
                endLabel: untisTimeToString(lesson.endTime),
                subject: lesson.su && lesson.su.length > 0 ? lesson.su[0] : null,
                teachers: lesson.te || [],
                rooms: lesson.ro || [],
                classes: lesson.kl || [],
                code: lesson.code || null,
                info: lesson.info || null,
                substText: lesson.substText || null,
                activityType: lesson.activityType || null,
                lsnumber: lesson.lsnumber,
            }))
            .sort((a, b) => a.date - b.date || a.startTime - b.startTime);

        res.json({
            school: SCHOOL,
            weekStart: monday.toISOString().slice(0, 10),
            weekEnd: friday.toISOString().slice(0, 10),
            lessons,
        });
    } catch (err) {
        console.error('Timetable fetch error:', err.message);
        const status = err.message.includes('not configured') ? 503 : 500;
        res.status(status).json({ error: err.message });
    }
});

/**
 * GET /api/status
 * Connectivity check and school info.
 */
app.get('/api/status', (req, res) => {
    res.json({
        school: SCHOOL,
        host: UNTIS_HOST,
        configured: Boolean(UNTIS_USER && UNTIS_PASSWORD),
    });
});

// Serve the SPA for all other routes
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

(async () => {
    await loadWebUntis();
    app.listen(PORT, () => {
        console.log(`\n  Kippenberg Timetable running at http://localhost:${PORT}\n`);
    });
})();
