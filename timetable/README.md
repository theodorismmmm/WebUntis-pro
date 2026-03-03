# Kippenberg Timetable

A premium, lightweight timetable web application for **Kippenberg Gymnasium**, powered by the WebUntis API.

## Features

- 🎨 Premium dark UI with smooth animations
- 📅 Weekly view with day-by-day navigation
- 📱 Mobile-friendly with single-day tab view
- 🔴 Visual indicators for cancelled/substituted lessons
- 🖱️ Click any lesson for full details
- ⚡ Lightweight – zero frontend frameworks

## Setup

### 1. Install dependencies

```bash
cd timetable
npm install
```

### 2. Configure credentials

Copy `.env.example` to `.env` and fill in your details:

```bash
cp .env.example .env
```

Edit `.env`:

```
SCHOOL=kippenberg-gymnasium
UNTIS_HOST=nessa.webuntis.com
UNTIS_USER=your.username
UNTIS_PASSWORD=yourpassword
PORT=3000
```

> **Note:** Never commit your `.env` file. It is already listed in `.gitignore`.

### 3. Start the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Finding your WebUntis host

1. Go to [webuntis.com](https://webuntis.com) and search for "Kippenberg"
2. The URL shown (e.g. `nessa.webuntis.com`) is your `UNTIS_HOST`
3. The school identifier (e.g. `kippenberg-gymnasium`) is your `SCHOOL`
