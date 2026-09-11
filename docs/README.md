# Event Management Portal — CCGNDEC

> **Official Cultural Committee Web Application**  
> **Guru Nanak Dev Engineering College, Ludhiana**

A modern web application built with **React 19**, **Vite**, and **Firebase** to manage college events, multi-day Youth Festivals, faculty and student committees, meeting attendance, sponsorships, and automated PDF performa exports.

---

## 📖 Comprehensive Documentation

A complete, detailed system manual with architecture diagrams, workflow walkthroughs, and screenshot placements is available in:

👉 **[SYSTEM_GUIDE.md](./SYSTEM_GUIDE.md)**

---

## 🚀 Key Features

- **Dual-Mode Event Architecture**: Single-day college events and multi-day **Youth Festivals** (both GNDEC as **Host College** and visiting **Contingent**).
- **Youth Festival Host Engine**: Participating colleges roster, gate check-in desk, venue mapping, hostel room allotment, and automated trophy/point calculation.
- **Committee & Attendance Management**: Student sub-committees, faculty coordinators, meetings, and attendance tracking.
- **Automated PDF Export**: Instant publication-ready reports via `jsPDF` and `jspdf-autotable`.
- **Real-Time Notifications & PWA**: Micro-interaction notification popover, mobile bottom sheet drawer (`< 576px`), and global shortcut `Ctrl+Shift+N`.
- **Command Palette (`Ctrl+K`)**: Rapid keyboard-driven navigation across events and tools with auto-scrolling.
- **Broadcast Email Center**: Multi-template announcements powered by EmailJS.
- **Dark Mode Support**: Full light/dark theme switching with persistent state.

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, React Router DOM v7, React-Bootstrap, Bootstrap 5.3
- **Backend & Database**: Firebase Authentication, Cloud Firestore
- **Utilities**: jsPDF, jspdf-autotable, @emailjs/browser, read-excel-file
- **Code Quality**: ESLint 9

---

## 💻 Local Development Setup

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Ensure your Firebase configuration is defined in `src/firebase.js`.

### 3. Start Development Server
```bash
npm run dev
```

### 4. Code Quality & Linting
```bash
npm run lint
```
*(Note: Use `npm run lint` for code quality checks).*

---

## 📸 Screenshots Directory

All documentation screenshots are mapped and stored in:
```
docs/screenshots/
```
Refer to [Section 6 of SYSTEM_GUIDE.md](./SYSTEM_GUIDE.md#6-master-screenshot-guide--asset-index) for the complete screenshot checklist and instructions.
