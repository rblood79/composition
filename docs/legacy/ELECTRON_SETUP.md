# composition Electron Setup Guide

This guide explains how to set up and build composition as an Electron desktop application with local PGlite database support.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Development](#development)
5. [Building](#building)
6. [Deployment](#deployment)
7. [Architecture](#architecture)
8. [Troubleshooting](#troubleshooting)

---

## 📦 Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **OS**: Windows, macOS, or Linux

**No additional software required!** PGlite runs in-process without PostgreSQL installation.

---

## 🚀 Installation

### 1. Install Dependencies

```bash
# Install PGlite
npm install @electric-sql/pglite

# Install Electron
npm install --save-dev electron electron-builder

# Install TypeScript types for Electron
npm install --save-dev @types/electron
```

### 2. Update `package.json`

Add Electron-specific scripts:

```json
{
  "name": "composition",
  "version": "1.0.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "electron:dev": "concurrently \"vite\" \"electron electron/main.ts\"",
    "electron:build": "npm run build && electron-builder",
    "electron:preview": "npm run build && electron dist-electron/main.js"
  },
  "build": {
    "appId": "com.composition.app",
    "productName": "composition",
    "directories": {
      "output": "release"
    },
    "files": ["dist/**/*", "dist-electron/**/*"],
    "mac": {
      "category": "public.app-category.developer-tools",
      "target": ["dmg", "zip"]
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "linux": {
      "target": ["AppImage", "deb", "rpm"]
    }
  }
}
```

### 3. Install Additional Dev Dependencies

```bash
# Concurrent execution of Vite + Electron
npm install --save-dev concurrently

# Electron builder
npm install --save-dev electron-builder
```

---

## ⚙️ Configuration

### 1. TypeScript Configuration

Create `electron/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "../dist-electron",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 2. Vite Configuration

Update `vite.config.ts` to handle Electron builds:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: process.env.ELECTRON === "true" ? "./" : "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### 3. Environment Variables

Create `.env.electron`:

```env
# PGlite (local database)
VITE_DB_TYPE=pglite

# Optional: Supabase fallback for internet mode
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 💻 Development

### 1. Start Development Server

```bash
npm run electron:dev
```

This will:

1. Start Vite dev server on `http://localhost:5173`
2. Launch Electron window
3. Hot reload on file changes

### 2. Database Location

During development, PGlite database is stored at:

- **macOS**: `~/Library/Application Support/composition/composition.pglite`
- **Windows**: `%APPDATA%/composition/composition.pglite`
- **Linux**: `~/.config/composition/composition.pglite`

### 3. Debug Logs

Open DevTools in Electron:

- Main process: Check terminal output
- Renderer process: DevTools console (auto-opens in dev mode)

---

## 🏗️ Building

### 1. Build Electron App

```bash
npm run electron:build
```

This will:

1. Build Vite app (`dist/`)
2. Compile Electron main process (`dist-electron/`)
3. Package app with `electron-builder`

### 2. Output Files

Build artifacts are in `release/`:

- **macOS**: `composition-1.0.0.dmg`, `composition-1.0.0-mac.zip`
- **Windows**: `composition Setup 1.0.0.exe`, `composition 1.0.0.exe` (portable)
- **Linux**: `composition-1.0.0.AppImage`, `composition_1.0.0_amd64.deb`, `composition-1.0.0.x86_64.rpm`

---

## 📤 Deployment

### Closed-Network Deployment

For environments without internet access (폐쇄망):

1. **Build the app**:

   ```bash
   npm run electron:build
   ```

2. **Distribute installer**:
   - Windows: `composition Setup 1.0.0.exe` or `composition 1.0.0.exe` (portable, no installation)
   - macOS: `composition-1.0.0.dmg`
   - Linux: `composition-1.0.0.AppImage` (no installation)

3. **No additional dependencies**:
   - ✅ PGlite is bundled in the app
   - ✅ PostgreSQL installation NOT required
   - ✅ Works 100% offline

### Internet-Connected Deployment

For environments with internet access:

1. **Hybrid mode**: App automatically detects internet and allows users to choose:
   - **Local database** (PGlite, default)
   - **Cloud database** (Supabase)

2. **User preference**: Saved in `localStorage`:
   ```typescript
   localStorage.setItem("composition-db-preference", "pglite"); // or 'supabase'
   ```

---

## 🏛️ Architecture

### Environment Detection Flow

```
┌─────────────────────────────────────────────────────────┐
│                    composition Launch                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ Environment Detector │
          └──────────┬───────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
  ┌──────────┐              ┌──────────┐
  │   Web    │              │ Electron │
  │ Browser  │              │   App    │
  └────┬─────┘              └─────┬────┘
       │                          │
       ▼                          ▼
┌─────────────┐         ┌─────────────────┐
│  Supabase   │         │  Check Internet │
│   Adapter   │         └────────┬────────┘
└─────────────┘                  │
                     ┌───────────┴───────────┐
                     │                       │
                     ▼                       ▼
              ┌─────────────┐         ┌─────────────┐
              │   Online    │         │  Offline    │
              │  (인터넷)   │         │  (폐쇄망)  │
              └──────┬──────┘         └──────┬──────┘
                     │                       │
            ┌────────┴────────┐              │
            │                 │              │
            ▼                 ▼              ▼
      ┌──────────┐      ┌──────────┐  ┌──────────┐
      │ PGlite   │      │ Supabase │  │ PGlite   │
      │ (Local)  │      │ (Cloud)  │  │ (Local)  │
      └──────────┘      └──────────┘  └──────────┘
       (default)         (optional)     (forced)
```

### Database Adapter Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                      │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Database Abstraction Layer (DAL)        │   │
│  │         - Unified DbAdapter Interface           │   │
│  └─────────────────┬───────────────────────────────┘   │
│                    │                                     │
│     ┌──────────────┼──────────────┐                     │
│     │              │               │                     │
│     ▼              ▼               ▼                     │
│  ┌────────┐  ┌────────────┐  ┌──────────┐              │
│  │PGlite  │  │  Supabase  │  │ PGlite   │              │
│  │  IPC   │  │  Adapter   │  │ Adapter  │              │
│  │Adapter │  │  (Cloud)   │  │ (Direct) │              │
│  └────┬───┘  └──────┬─────┘  └─────┬────┘              │
│       │             │               │                     │
└───────┼─────────────┼───────────────┼─────────────────────┘
        │             │               │
        │             │               │ (Not used in renderer)
        │             │               │
        ▼             ▼               ▼
   ┌────────┐   ┌─────────┐     ┌─────────┐
   │  IPC   │   │ HTTPS   │     │  N/A    │
   │ Bridge │   │  API    │     │         │
   └────┬───┘   └─────────┘     └─────────┘
        │
        │
┌───────┼─────────────────────────────────────────────────┐
│       ▼          Main Process                            │
│  ┌─────────┐                                             │
│  │ PGlite  │                                             │
│  │Database │                                             │
│  │         │                                             │
│  │ (Local  │                                             │
│  │  File)  │                                             │
│  └─────────┘                                             │
└──────────────────────────────────────────────────────────┘
```

### File Structure

```
composition/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # IPC bridge (contextBridge)
│   └── tsconfig.json        # TypeScript config for Electron
├── src/
│   ├── services/
│   │   └── database/
│   │       ├── types.ts              # DbAdapter interface
│   │       ├── pgliteAdapter.ts      # PGlite (main process)
│   │       ├── pgliteIpcAdapter.ts   # PGlite (renderer via IPC)
│   │       ├── supabaseAdapter.ts    # Supabase (cloud)
│   │       ├── environmentDetector.ts # Environment detection
│   │       ├── dbFactory.ts          # Adapter factory
│   │       ├── migrations.ts         # Schema migrations
│   │       └── index.ts              # Public API
│   └── types/
│       └── electron.d.ts    # TypeScript definitions for window.electron
├── dist/                    # Vite build output
├── dist-electron/           # Electron build output
└── release/                 # Final installers
```

---

## 🐛 Troubleshooting

### 1. "Database not initialized" Error

**Solution**: Ensure `initializeDatabase()` is called before using `db`:

```typescript
import { initializeDatabase } from "./services/database";

// App initialization
await initializeDatabase();
```

### 2. IPC Bridge Not Available

**Symptoms**: `window.electron is undefined`

**Solution**:

1. Check `electron/preload.ts` is loaded in BrowserWindow config
2. Verify `contextIsolation: true` in `webPreferences`

### 3. Migration Errors

**Symptoms**: `table already exists` or `migration failed`

**Solution**:

- Delete database file and restart:
  ```bash
  rm ~/Library/Application\ Support/composition/composition.pglite  # macOS
  ```
- Migrations run automatically on first launch

### 4. Database Size Issues

**Check database size**:

```typescript
const db = await getDb();
const size = await db.getDbSize();
console.log(`Database size: ${(size / 1024 / 1024).toFixed(2)} MB`);
```

**Optimize database**:

```typescript
await db.vacuum();
```

### 5. Switching Between Databases

**Switch from PGlite to Supabase** (internet mode):

```typescript
import { switchDb } from "./services/database";

await switchDb("supabase");
```

**WARNING**: This closes the current database. Save all changes first!

---

## 📚 API Reference

### Database API

```typescript
import { db } from "./services/database";

// Select
const projects = await db.select("projects", {
  where: { created_by: userId },
  orderBy: [{ column: "created_at", ascending: false }],
  limit: 10,
});

// Insert
const newProject = await db.insert("projects", {
  name: "My Project",
  created_by: userId,
});

// Update
await db.update("projects", projectId, {
  name: "Updated Name",
});

// Delete
await db.delete("projects", projectId);

// Raw SQL
const results = await db.query("SELECT * FROM projects WHERE name ILIKE $1", [
  "%search%",
]);

// RPC function
const tokens = await db.rpc("resolve_theme_tokens", {
  p_theme_id: themeId,
});
```

### Environment Detection

```typescript
import {
  detectEnvironment,
  isElectron,
  hasInternetAccess,
  getUserDbPreference,
  setUserDbPreference,
} from "./services/database";

// Detect environment
const envInfo = await detectEnvironment();
console.log(envInfo.environment); // 'web' | 'electron-closed' | 'electron-internet'

// Check platform
if (isElectron()) {
  console.log("Running in Electron");
}

// Check internet
if (await hasInternetAccess()) {
  console.log("Internet available");
}

// User preference
setUserDbPreference("pglite"); // or 'supabase'
const pref = getUserDbPreference();
```

---

## 🎯 Next Steps

1. **Test build**: Run `npm run electron:build` and test the installer
2. **Code signing** (for production): Configure certificate in `electron-builder`
3. **Auto-update** (optional): Add `electron-updater` for automatic updates
4. **Custom installer**: Customize NSIS installer with custom UI

---

## 📖 Additional Resources

- [PGlite Documentation](https://github.com/electric-sql/pglite)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- composition Component Migration

---

## ✅ Summary

✅ **Local Database**: PGlite (PostgreSQL-compatible, no installation)
✅ **Cloud Database**: Supabase (optional, for internet mode)
✅ **Hybrid Mode**: Auto-detect environment and allow user choice
✅ **Zero Dependencies**: No PostgreSQL, Docker, or additional software
✅ **Offline Support**: 100% functional in closed-network environments
✅ **Cross-Platform**: Windows, macOS, Linux support

**Ready to build!** 🚀
