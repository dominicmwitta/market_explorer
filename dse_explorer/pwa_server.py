#!/usr/bin/env python3
"""
PWA Server - Serves the Streamlit dashboard as a Progressive Web App.
Run this instead of 'dse-dashboard' for mobile PWA installation support.
"""

import functools
import http.server
import socketserver
import threading
import webbrowser
import sys
import time
from pathlib import Path

PORT = 8502

def start_streamlit():
    from streamlit.web.cli import main as st_main
    sys.argv = ["streamlit", "run", str(Path(__file__).parent.parent / "dse_explorer" / "dashboard.py"), "--server.port=8501"]
    st_main()

def main():
    pwa_dir = Path(__file__).parent / "pwa_assets"
    if not pwa_dir.exists():
        print(f"ERROR: PWA assets directory not found: {pwa_dir}")
        return 1

    print("=" * 50)
    print("DSE Stock Analytics PWA Server")
    print("=" * 50)
    print()

    streamlit_thread = threading.Thread(target=start_streamlit, daemon=True)
    streamlit_thread.start()
    print("Starting Streamlit dashboard on port 8501...")

    time.sleep(3)

    handler_class = http.server.SimpleHTTPRequestHandler
    handler_class.extensions_map.update({
        '.webmanifest': 'application/manifest+json',
        '.js': 'application/javascript',
    })
    Handler = functools.partial(handler_class, directory=str(pwa_dir))

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"PWA server running on http://localhost:{PORT}")
        print()
        print("To install on your phone:")
        print(f"  1. Open http://YOUR_IP:{PORT} on your phone")
        print("  2. Open the browser menu (⋮ or •••)")
        print("  3. Tap 'Add to Home Screen' or 'Install App'")
        print()
        print("=" * 50)
        print()
        print("Press Ctrl+C to stop the server")
        print()

        webbrowser.open(f"http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    sys.exit(main() or 0)
