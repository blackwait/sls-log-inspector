# Sidebar Collapse Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a persistent collapsible left sidebar to SLS Log Inspector.

**Architecture:** Extend the existing local preference object with `sidebarCollapsed`, add a toggle button in the sidebar header, and drive the layout with an `app-shell.sidebar-collapsed` class. The implementation stays client-side and reuses existing `localStorage` persistence.

**Tech Stack:** Plain HTML, CSS, vanilla JavaScript, Python deployment script.

---

### Task 1: Add Markup Hooks

**Files:**
- Modify: `/Users/black/IdeaProjects/sls-log-inspector/index.html`

**Steps:**
1. Add `id="appShell"` to `.app-shell`.
2. Add `id="sidebar"` to `.sidebar`.
3. Add a `button#sidebarToggle` inside `.brand` with `aria-label` and `title`.

### Task 2: Add Persistent State

**Files:**
- Modify: `/Users/black/IdeaProjects/sls-log-inspector/app.js`

**Steps:**
1. Read `saved.sidebarCollapsed` in `loadPrefs()`.
2. Include `sidebarCollapsed` in `savePrefs()`.
3. Add `sidebarCollapsed` to `state`.
4. Add `appShell`, `sidebar`, and `sidebarToggle` references to `els`.

### Task 3: Implement Sidebar Toggle

**Files:**
- Modify: `/Users/black/IdeaProjects/sls-log-inspector/app.js`

**Steps:**
1. Add `setupSidebarCollapse()` and call it from `bindEvents()`.
2. Add `applySidebarState()` to toggle `sidebar-collapsed`, button text, title, and ARIA state.
3. Save preferences whenever the user toggles the sidebar.

### Task 4: Style Collapsed Layout

**Files:**
- Modify: `/Users/black/IdeaProjects/sls-log-inspector/styles.css`

**Steps:**
1. Add a compact collapsed grid column.
2. Hide sidebar content except the brand mark and toggle button.
3. Keep button dimensions stable and accessible.
4. Add responsive handling under `820px`.

### Task 5: Verify Without Tests

**Commands:**
- `node --check /Users/black/IdeaProjects/sls-log-inspector/app.js`
- Start the local Python service and inspect the page in the browser.

**Note:** No unit, integration, or E2E test command should be run unless explicitly approved by the user.

### Task 6: Deploy

**Command:**
- `python3 /Users/black/IdeaProjects/sls-log-inspector/deploy_remote.py`

**Expected:**
- Uploads `index.html`, `app.js`, `styles.css`, `server.py`, and `online.html`.
- Restarts `sls-log-inspector`.
- Prints active service status and HTTP `200` for `/api/presence`.
