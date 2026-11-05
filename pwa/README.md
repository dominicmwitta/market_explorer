# DSE Stock Analytics PWA

A Progressive Web App (PWA) version of the DSE Stock Analytics dashboard that can be installed on Android/iOS devices.

## Quick Start

### Option 1: Use the PWA Server (Recommended)

```bash
# Install pillow for icon generation
pip install pillow

# Generate app icons (optional, already included)
python dse_explorer/pwa_assets/generate_icons.py

# Start the PWA server
dse-pwa-server
```

Then on your phone:
1. Open `http://YOUR_COMPUTER_IP:8502`
2. Tap the browser menu (⋮ or •••)
3. Select "Add to Home Screen" or "Install App"

### Option 2: Deploy to a Web Server

Upload the `dse_explorer/pwa_assets/` folder to any static web host (GitHub Pages, Netlify, Vercel, etc.) and serve the `index.html`.

**Note:** The Streamlit dashboard must be running separately on port 8501.

## Features

- **Mobile-optimized interface** - Works great on phones and tablets
- **Offline support** - Cached data accessible without internet
- **Installable** - Add to home screen like a native app
- **Dark mode** - Beautiful dark theme matching the app

## Files

The PWA runtime assets live inside the installable package at
`dse_explorer/pwa_assets/` so they ship in the wheel; only this README stays
at the repo-level `pwa/` directory.

```
dse_explorer/
├── pwa_server.py             # Combined Streamlit + PWA server
└── pwa_assets/
    ├── index.html            # PWA entry point
    ├── manifest.json         # PWA manifest
    ├── sw.js                 # Service worker
    ├── offline.html          # Offline fallback page
    ├── generate_icons.py     # Icon generator script (dev-only, not shipped in wheel)
    └── icons/                # App icons in various sizes
```

Start the server with the installed console script:

```bash
dse-pwa-server
```

## Usage

### Android

1. Open the PWA URL in Chrome
2. Tap the menu (⋮)
3. Select "Add to Home Screen"
4. The app will appear as a standalone app

### iOS

1. Open the PWA URL in Safari
2. Tap the Share button (□↑)
3. Scroll down and tap "Add to Home Screen"
4. The app will appear as a standalone app

## Troubleshooting

**"Install" button not showing:**
- Make sure you're accessing via HTTPS or localhost
- Try refreshing the page

**App not loading:**
- Ensure the Streamlit dashboard is running on port 8501
- Check if port 8502 is not blocked by firewall

**Offline mode not working:**
- Service worker needs to be registered first (try refreshing once while online)
