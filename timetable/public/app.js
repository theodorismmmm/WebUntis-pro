'use strict';

/* ─── State ─────────────────────────────────────────────────────────────── */
const state = {
    currentDate: new Date(),
    activeDay: 0, // 0..4 Mon..Fri (mobile)
    data: null,
};

/* ─── Day / Month names (German) ─────────────────────────────────────────── */
const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const DAYS_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/* ─── Unique subject colours ─────────────────────────────────────────────── */
const COLOUR_PALETTE = [
    '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
    '#0ea5e9', '#f59e0b', '#10b981', '#f97316',
    '#a855f7', '#06b6d4', '#84cc16', '#ef4444',
];
const subjectColour = new Map();
let colourIdx = 0;

function getSubjectColour(name) {
    if (!name) return COLOUR_PALETTE[0];
    if (!subjectColour.has(name)) {
        subjectColour.set(name, COLOUR_PALETTE[colourIdx % COLOUR_PALETTE.length]);
        colourIdx++;
    }
    return subjectColour.get(name);
}

/* ─── Date helpers ───────────────────────────────────────────────────────── */
function isoDate(date) {
    return date.toISOString().slice(0, 10);
}

function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

function getWeekDates(monday) {
    return Array.from({ length: 5 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
}

function formatWeekLabel(monday, friday) {
    const sameMonth = monday.getMonth() === friday.getMonth();
    const sameYear = monday.getFullYear() === friday.getFullYear();
    const m1 = `${monday.getDate()}. ${MONTHS[monday.getMonth()]}`;
    const m2 = `${friday.getDate()}. ${MONTHS[friday.getMonth()]}`;
    const yr = sameYear ? monday.getFullYear() : `${monday.getFullYear()} – ${friday.getFullYear()}`;
    return sameMonth
        ? `${monday.getDate()}. – ${friday.getDate()}. ${MONTHS[monday.getMonth()]} ${yr}`
        : `${m1} – ${m2} ${yr}`;
}

/* ─── API ────────────────────────────────────────────────────────────────── */
async function fetchTimetable(date) {
    const res = await fetch(`/api/timetable?date=${isoDate(date)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
    }
    return res.json();
}

/* ─── Render ─────────────────────────────────────────────────────────────── */
function renderTimetable(data) {
    const timetable = document.getElementById('timetable');
    const timetableWrap = document.getElementById('timetable-wrap');
    const loading = document.getElementById('loading');
    const errorState = document.getElementById('error-state');

    loading.classList.add('hidden');
    errorState.classList.add('hidden');
    timetableWrap.classList.remove('hidden');

    // Group lessons by date
    const byDate = {};
    for (const lesson of data.lessons) {
        if (!byDate[lesson.dateLabel]) byDate[lesson.dateLabel] = [];
        byDate[lesson.dateLabel].push(lesson);
    }

    const monday = new Date(data.weekStart);
    const weekDates = getWeekDates(monday);
    const todayIso = isoDate(new Date());

    // Collect all unique time slots
    const timeSlots = [...new Set(
        data.lessons.map((l) => `${l.startTime}-${l.endTime}`)
    )].sort().map((key) => {
        const [start, end] = key.split('-');
        return { start: parseInt(start), end: parseInt(end) };
    });

    // Build day tabs (mobile)
    buildDayTabs(weekDates, todayIso);

    // Build grid
    const grid = document.createElement('div');
    grid.className = 'timetable-grid';

    // Header row
    const emptyHeader = document.createElement('div');
    emptyHeader.className = 'col-header time-col';
    grid.appendChild(emptyHeader);

    weekDates.forEach((date, i) => {
        const iso = isoDate(date);
        const isToday = iso === todayIso;
        const header = document.createElement('div');
        header.className = 'col-header' + (isToday ? ' today' : '');
        header.dataset.day = i;
        header.innerHTML = `
            <div class="col-header-day">${DAYS_SHORT[i]}</div>
            <div class="col-header-date">${date.getDate()}</div>
        `;
        grid.appendChild(header);
    });

    // Time rows
    if (timeSlots.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--text-muted);';
        empty.textContent = 'Keine Stunden diese Woche.';
        grid.appendChild(empty);
    } else {
        for (const slot of timeSlots) {
            // Time label cell
            const timeCell = document.createElement('div');
            timeCell.className = 'time-label';
            timeCell.textContent = formatTime(slot.start);
            grid.appendChild(timeCell);

            // Day cells
            weekDates.forEach((date, i) => {
                const iso = isoDate(date);
                const cell = document.createElement('div');
                cell.className = 'day-cell';
                cell.dataset.day = i;

                const lessons = (byDate[iso] || []).filter(
                    (l) => l.startTime === slot.start
                );

                for (const lesson of lessons) {
                    cell.appendChild(buildLessonCard(lesson));
                }
                grid.appendChild(cell);
            });
        }
    }

    timetable.innerHTML = '';
    timetable.appendChild(grid);

    applyMobileDayFilter(state.activeDay);
}

function buildLessonCard(lesson) {
    const card = document.createElement('div');
    const status = lesson.code || 'normal';
    card.className = `lesson-card ${status}`;

    const subjectName = lesson.subject ? (lesson.subject.longname || lesson.subject.name) : '–';
    const subjectShort = lesson.subject ? lesson.subject.name : '–';
    const teacher = lesson.teachers.length > 0 ? lesson.teachers[0].name : '';
    const room = lesson.rooms.length > 0 ? lesson.rooms[0].name : '';
    const colour = getSubjectColour(subjectShort);

    card.style.setProperty('--card-colour', colour);
    card.style.color = colour;

    card.innerHTML = `
        ${status !== 'normal' ? `<span class="lesson-badge">${status === 'cancelled' ? 'Entfall' : 'Vertret.'}</span>` : ''}
        <div class="lesson-subject">${esc(subjectShort)}</div>
        ${teacher ? `<div class="lesson-meta">&#128101; ${esc(teacher)}</div>` : ''}
        ${room ? `<div class="lesson-meta">&#128205; ${esc(room)}</div>` : ''}
        <div class="lesson-time">${lesson.startLabel} – ${lesson.endLabel}</div>
    `;

    // Drawer on click
    card.addEventListener('click', () => openDrawer(lesson, subjectName, colour));

    return card;
}

function buildDayTabs(weekDates, todayIso) {
    const nav = document.getElementById('day-tabs');
    nav.innerHTML = '';

    // Determine which day should be active: today if visible in this week, else keep state.activeDay
    const todayIdx = weekDates.findIndex((d) => isoDate(d) === todayIso);
    const targetActive = todayIdx >= 0 ? todayIdx : Math.min(state.activeDay, 4);
    state.activeDay = targetActive;

    weekDates.forEach((date, i) => {
        const btn = document.createElement('button');
        btn.className = 'day-tab' + (i === state.activeDay ? ' active' : '');
        btn.textContent = `${DAYS_SHORT[i]} ${date.getDate()}.`;
        btn.addEventListener('click', () => {
            state.activeDay = i;
            document.querySelectorAll('.day-tab').forEach((t, j) => t.classList.toggle('active', j === i));
            applyMobileDayFilter(i);
        });
        nav.appendChild(btn);
    });
}

function applyMobileDayFilter(dayIdx) {
    // Show/hide columns based on active day (mobile only)
    document.querySelectorAll('[data-day]').forEach((el) => {
        el.style.display = '';
    });
    if (window.innerWidth <= 768) {
        document.querySelectorAll('[data-day]').forEach((el) => {
            if (el.dataset.day !== String(dayIdx)) {
                el.style.display = 'none';
            }
        });
    }
}

function formatTime(t) {
    const s = String(t).padStart(4, '0');
    return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ─── Drawer ─────────────────────────────────────────────────────────────── */
function openDrawer(lesson, subjectName, colour) {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('drawer');
    const content = document.getElementById('drawer-content');

    const teacher = lesson.teachers.map((t) => t.longname || t.name).join(', ') || '–';
    const room = lesson.rooms.map((r) => r.longname || r.name).join(', ') || '–';
    const classes = lesson.classes.map((k) => k.name).join(', ') || '–';

    const cancelledNote = lesson.code === 'cancelled'
        ? `<div class="cancelled-note">⚠ Diese Stunde fällt aus${lesson.info ? ': ' + esc(lesson.info) : '.'}</div>` : '';
    const substNote = lesson.code === 'irregular'
        ? `<div class="subst-note">↔ Vertretung${lesson.substText ? ': ' + esc(lesson.substText) : '.'}</div>` : '';

    content.innerHTML = `
        <h2 style="color: ${colour}">${esc(subjectName)}</h2>
        <div class="drawer-row">
            <span class="drawer-row-label">Zeit</span>
            <span class="drawer-row-value">${lesson.startLabel} – ${lesson.endLabel}</span>
        </div>
        <div class="drawer-row">
            <span class="drawer-row-label">Lehrkraft</span>
            <span class="drawer-row-value">${esc(teacher)}</span>
        </div>
        <div class="drawer-row">
            <span class="drawer-row-label">Raum</span>
            <span class="drawer-row-value">${esc(room)}</span>
        </div>
        <div class="drawer-row">
            <span class="drawer-row-label">Klasse</span>
            <span class="drawer-row-value">${esc(classes)}</span>
        </div>
        ${lesson.info ? `<div class="drawer-row"><span class="drawer-row-label">Info</span><span class="drawer-row-value">${esc(lesson.info)}</span></div>` : ''}
        ${cancelledNote}
        ${substNote}
    `;

    overlay.classList.remove('hidden');
    drawer.classList.remove('hidden');
}

function closeDrawer() {
    document.getElementById('drawer-overlay').classList.add('hidden');
    document.getElementById('drawer').classList.add('hidden');
}

/* ─── Load data ──────────────────────────────────────────────────────────── */
async function loadWeek(date) {
    const timetable = document.getElementById('timetable');
    const timetableWrap = document.getElementById('timetable-wrap');
    const loading = document.getElementById('loading');
    const errorState = document.getElementById('error-state');
    const weekLabel = document.getElementById('week-label');

    // Show loading, hide others
    loading.classList.remove('hidden');
    errorState.classList.add('hidden');
    timetableWrap.classList.add('hidden');
    timetable.innerHTML = '';

    const monday = getMondayOfWeek(date);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    weekLabel.textContent = formatWeekLabel(monday, friday);

    try {
        const data = await fetchTimetable(date);
        state.data = data;
        renderTimetable(data);
    } catch (err) {
        loading.classList.add('hidden');
        timetableWrap.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('error-msg').textContent = err.message;
    }
}

/* ─── Navigation ─────────────────────────────────────────────────────────── */
function navigate(weeksOffset) {
    state.currentDate = new Date(state.currentDate);
    state.currentDate.setDate(state.currentDate.getDate() + weeksOffset * 7);
    loadWeek(state.currentDate);
}

/* ─── Init ───────────────────────────────────────────────────────────────── */
(function init() {
    document.getElementById('btn-prev').addEventListener('click', () => navigate(-1));
    document.getElementById('btn-next').addEventListener('click', () => navigate(1));
    document.getElementById('btn-today').addEventListener('click', () => {
        state.currentDate = new Date();
        navigate(0);
    });
    document.getElementById('drawer-close').addEventListener('click', closeDrawer);
    document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

    // Responsive re-render on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (state.data) renderTimetable(state.data);
        }, 200);
    });

    // Default to today's week
    const today = new Date();
    const monday = getMondayOfWeek(today);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    document.getElementById('week-label').textContent = formatWeekLabel(monday, friday);

    // Set default active day to today (Mon=0..Fri=4), or Mon if weekend
    const todayDay = today.getDay();
    state.activeDay = todayDay >= 1 && todayDay <= 5 ? todayDay - 1 : 0;

    loadWeek(state.currentDate);
})();
