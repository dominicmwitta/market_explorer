"""Create Windows desktop shortcuts for DSE Explorer tools."""

import shutil
import subprocess
import sys
from pathlib import Path


SHORTCUTS = [
    {
        "name": "DSE Dashboard",
        "target": "dse-dashboard",
        "description": "Launch the DSE Stock Analytics Dashboard",
    },
    {
        "name": "DSE Scraper",
        "target": "dse-scrape",
        "description": "Run the DSE market data scraper",
    },
]


def _find_exe(name: str) -> Path | None:
    """Locate a CLI entry-point executable."""
    path = shutil.which(name)
    return Path(path) if path else None


def _create_shortcut(name: str, target: Path, description: str, desktop: Path):
    """Create a .lnk shortcut on the desktop via PowerShell."""
    lnk = desktop / f"{name}.lnk"
    ps_script = (
        "$ws = New-Object -ComObject WScript.Shell; "
        f"$s = $ws.CreateShortcut('{lnk}'); "
        f"$s.TargetPath = '{target}'; "
        f"$s.Description = '{description}'; "
        f"$s.WorkingDirectory = '{desktop}'; "
        "$s.Save()"
    )
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps_script],
        check=True,
        capture_output=True,
    )
    return lnk


def main():
    desktop = Path.home() / "Desktop"
    if not desktop.exists():
        print(f"Desktop folder not found at {desktop}")
        sys.exit(1)

    for shortcut in SHORTCUTS:
        exe = _find_exe(shortcut["target"])
        if exe is None:
            print(f"  SKIP  {shortcut['name']} - '{shortcut['target']}' not found on PATH")
            continue
        lnk = _create_shortcut(shortcut["name"], exe, shortcut["description"], desktop)
        print(f"  OK    {lnk}")

    print("\nDone. Shortcuts created on your Desktop.")


if __name__ == "__main__":
    main()
