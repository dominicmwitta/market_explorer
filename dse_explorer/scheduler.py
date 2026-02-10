"""Windows Task Scheduler integration for automated daily pipeline runs."""

import argparse
import os
import subprocess
import sys
import shutil

TASK_NAME = "DSE_Daily_Pipeline"


def _find_dse_pipeline() -> str:
    """Locate the dse-pipeline executable."""
    path = shutil.which("dse-pipeline")
    if path:
        return path
    # Fallback: use the Python module directly
    return f'"{sys.executable}" -m dse_explorer.pipeline'


def _create_batch_file(work_dir: str, cmd_to_run: str) -> str:
    """Create a launcher batch file that sets the working directory."""
    bat_path = os.path.join(work_dir, "run_pipeline.bat")
    log_path = os.path.join(work_dir, "logs", "task_output.log")
    lines = [
        "@echo off",
        f"cd /d {work_dir}",
        f"{cmd_to_run} >> \"{log_path}\" 2>&1",
    ]
    with open(bat_path, "w") as f:
        f.write("\r\n".join(lines) + "\r\n")
    return bat_path


def install_schedule(time: str = "18:00",
                     working_dir: str | None = None) -> bool:
    """Create a daily Windows scheduled task."""
    cmd_to_run = _find_dse_pipeline()
    work_dir = working_dir or os.getcwd()

    # Create a batch file launcher for reliable execution
    bat_path = _create_batch_file(work_dir, cmd_to_run)

    result = subprocess.run(
        [
            "schtasks", "/Create",
            "/TN", TASK_NAME,
            "/TR", bat_path,
            "/SC", "DAILY",
            "/ST", time,
            "/F",  # force overwrite if exists
        ],
        capture_output=True, text=True,
    )

    if result.returncode == 0:
        print(f"Scheduled task '{TASK_NAME}' created to run daily at {time}")
        print(f"Working directory: {work_dir}")
        print(f"Launcher: {bat_path}")
        return True
    else:
        print(f"Failed to create scheduled task: {result.stderr.strip()}")
        return False


def remove_schedule() -> bool:
    """Remove the scheduled task."""
    result = subprocess.run(
        ["schtasks", "/Delete", "/TN", TASK_NAME, "/F"],
        capture_output=True, text=True,
    )

    if result.returncode == 0:
        print(f"Scheduled task '{TASK_NAME}' removed")
        return True
    else:
        print(f"Failed to remove task: {result.stderr.strip()}")
        return False


def show_schedule() -> bool:
    """Display the current scheduled task status."""
    result = subprocess.run(
        ["schtasks", "/Query", "/TN", TASK_NAME, "/V", "/FO", "LIST"],
        capture_output=True, text=True,
    )

    if result.returncode == 0:
        print(result.stdout)
        return True
    else:
        print(f"No scheduled task found: {TASK_NAME}")
        return False


def main():
    parser = argparse.ArgumentParser(description="DSE Pipeline Scheduler (Windows)")
    parser.add_argument("--install", action="store_true",
                        help="Install daily scheduled task")
    parser.add_argument("--time", default="18:00",
                        help="Time to run (HH:MM, default 18:00)")
    parser.add_argument("--remove", action="store_true",
                        help="Remove the scheduled task")
    parser.add_argument("--status", action="store_true",
                        help="Show current schedule status")

    args = parser.parse_args()

    if args.install:
        install_schedule(args.time)
    elif args.remove:
        remove_schedule()
    elif args.status:
        show_schedule()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
