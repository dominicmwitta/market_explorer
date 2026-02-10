"""Gmail email notifications for pipeline results and price alerts."""

import argparse
import json
import smtplib
import socket
import ssl
from datetime import datetime
from email.mime.text import MIMEText
from pathlib import Path

from dse_explorer.logger import get_logger

CONFIG_FILE = Path("email_config.json")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465

log = get_logger()


def load_email_config() -> dict | None:
    """Read email configuration from disk. Returns None if missing."""
    if not CONFIG_FILE.exists():
        return None
    try:
        config = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        if not config.get("gmail_address") or not config.get("app_password"):
            return None
        return config
    except (json.JSONDecodeError, KeyError):
        return None


def save_email_config(gmail_address: str, app_password: str,
                      enabled: bool = True) -> None:
    """Create or update the email config file."""
    config = {
        "gmail_address": gmail_address,
        "app_password": app_password,
        "enabled": enabled,
    }
    CONFIG_FILE.write_text(json.dumps(config, indent=2), encoding="utf-8")


def send_email(subject: str, body: str) -> bool:
    """Send an email via Gmail SMTP. Returns True on success."""
    config = load_email_config()
    if not config:
        log.debug("Email not configured — skipping notification")
        return False

    if not config.get("enabled", True):
        log.debug("Email notifications disabled — skipping")
        return False

    sender = config["gmail_address"]
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = sender  # send to self

    # Try SMTP_SSL (port 465), then fall back to STARTTLS (port 587)
    for attempt, connect in enumerate([
        lambda: smtplib.SMTP_SSL(SMTP_SERVER, 465, timeout=30),
        lambda: smtplib.SMTP(SMTP_SERVER, 587, timeout=30),
    ]):
        try:
            server = connect()
            server.ehlo("localhost")
            if attempt == 1:  # STARTTLS path
                server.starttls()
                server.ehlo("localhost")
            server.login(sender, config["app_password"])
            server.send_message(msg)
            server.quit()
            log.info(f"Email sent: {subject}")
            return True
        except Exception as e:
            log.debug(f"SMTP attempt {attempt + 1} failed: {e}")
            try:
                server.quit()
            except Exception:
                pass

    log.error("Failed to send email: all SMTP methods failed")
    return False


def notify_pipeline_result(success: bool, details: dict) -> bool:
    """Send a pipeline summary email.

    Parameters
    ----------
    success : bool
        Whether the pipeline completed successfully.
    details : dict
        Keys: source (str), rows_scraped (int), total_rows (int),
        alerts_triggered (int), errors (list[str]).
    """
    status = "SUCCESS" if success else "FAILED"
    subject = f"DSE Pipeline: {status}"

    lines = [
        f"DSE Daily Pipeline — {status}",
        f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        f"Data source: {details.get('source', 'unknown')}",
        f"Rows scraped today: {details.get('rows_scraped', 0)}",
        f"Total rows in master CSV: {details.get('total_rows', 0)}",
    ]

    alerts_count = details.get("alerts_triggered", 0)
    if alerts_count:
        lines.append(f"Price alerts triggered: {alerts_count}")

    errors = details.get("errors", [])
    if errors:
        lines.append("")
        lines.append("Errors:")
        for err in errors:
            lines.append(f"  - {err}")

    body = "\n".join(lines)
    return send_email(subject, body)


def notify_alerts(triggered_alerts: list[dict]) -> bool:
    """Send an email for triggered price alerts.

    Parameters
    ----------
    triggered_alerts : list[dict]
        Each dict has: company, condition, price, current_price.
    """
    if not triggered_alerts:
        return False

    if len(triggered_alerts) == 1:
        a = triggered_alerts[0]
        subject = (f"DSE Alert: {a['company']} price "
                   f"{a['condition']} {a['price']}")
    else:
        subject = f"DSE Alert: {len(triggered_alerts)} price alerts triggered"

    lines = [
        f"DSE Price Alerts — {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
    ]
    for a in triggered_alerts:
        lines.append(
            f"  {a['company']}: price is {a['condition']} {a['price']} "
            f"(current: {a['current_price']:.2f})"
        )

    body = "\n".join(lines)
    return send_email(subject, body)


def diagnose() -> None:
    """Step-by-step connection test with detailed output."""
    config = load_email_config()
    if not config:
        print("Not configured. Run 'dse-notify --configure' first.")
        return

    sender = config["gmail_address"]
    print(f"Gmail: {sender}")
    print()

    # Step 1: DNS resolution
    print("[1/4] Resolving smtp.gmail.com ...")
    try:
        ip = socket.getaddrinfo(SMTP_SERVER, SMTP_PORT)[0][4][0]
        print(f"  OK — resolved to {ip}")
    except Exception as e:
        print(f"  FAIL — DNS resolution error: {e}")
        return

    # Step 2: TCP connection
    print(f"[2/4] TCP connect to {SMTP_SERVER}:{SMTP_PORT} ...")
    try:
        sock = socket.create_connection((SMTP_SERVER, SMTP_PORT), timeout=15)
        print(f"  OK — connected")
        sock.close()
    except Exception as e:
        print(f"  FAIL — {e}")
        print("  -> Port may be blocked by firewall or antivirus")
        return

    # Step 3 & 4: Try both connection methods
    methods = [
        ("SSL (port 465)", 465, True),
        ("STARTTLS (port 587)", 587, False),
    ]
    for label, port, use_ssl in methods:
        print(f"[3/4] {label} — connecting ...")
        server = None
        try:
            if use_ssl:
                server = smtplib.SMTP_SSL(SMTP_SERVER, port, timeout=15)
            else:
                server = smtplib.SMTP(SMTP_SERVER, port, timeout=15)
            code, resp = server.ehlo("localhost")
            print(f"  OK — EHLO response: {code}")
            if not use_ssl:
                server.starttls()
                server.ehlo("localhost")
                print("  OK — STARTTLS upgraded")
        except Exception as e:
            print(f"  FAIL — {e}")
            if server:
                try:
                    server.quit()
                except Exception:
                    pass
            continue

        print(f"[4/4] {label} — authenticating ...")
        try:
            server.login(sender, config["app_password"])
            print("  OK — login successful!")
            server.quit()
            print()
            print(f"All checks passed with {label}!")
            return
        except smtplib.SMTPAuthenticationError as e:
            print(f"  FAIL — {e}")
            print("  -> Wrong credentials. Use an App Password, not your Gmail password.")
            print("     Generate one at: https://myaccount.google.com/apppasswords")
            try:
                server.quit()
            except Exception:
                pass
            return
        except Exception as e:
            print(f"  FAIL — {type(e).__name__}: {e}")
            try:
                server.quit()
            except Exception:
                pass

    print()
    print("Both methods failed. Check that:")
    print("  1. 2-Step Verification is ON in your Google account")
    print("  2. You generated an App Password (not regular password)")
    print("  3. No antivirus/firewall is intercepting SMTP traffic")


def configure() -> None:
    """Interactive CLI to set up email credentials."""
    print("Gmail Email Notification Setup")
    print("=" * 40)
    print()
    print("You need a Gmail App Password (not your regular password).")
    print("Generate one at: https://myaccount.google.com/apppasswords")
    print()

    gmail_address = input("Gmail address: ").strip()
    if not gmail_address:
        print("Aborted — no address entered.")
        return

    app_password = input("App password: ").strip()
    if not app_password:
        print("Aborted — no password entered.")
        return

    save_email_config(gmail_address, app_password)
    print(f"\nConfig saved to {CONFIG_FILE}")
    print("Run 'dse-notify --test' to send a test email.")


def main():
    parser = argparse.ArgumentParser(
        description="DSE Email Notification Manager"
    )
    parser.add_argument("--configure", action="store_true",
                        help="Set up Gmail credentials interactively")
    parser.add_argument("--test", action="store_true",
                        help="Send a test email to verify setup")
    parser.add_argument("--diagnose", action="store_true",
                        help="Step-by-step connection diagnostic")
    parser.add_argument("--enable", action="store_true",
                        help="Enable email notifications")
    parser.add_argument("--disable", action="store_true",
                        help="Disable email notifications")
    parser.add_argument("--status", action="store_true",
                        help="Show current notification config status")

    args = parser.parse_args()

    if args.configure:
        configure()
    elif args.diagnose:
        diagnose()
    elif args.test:
        config = load_email_config()
        if not config:
            print("Not configured. Run 'dse-notify --configure' first.")
            return
        ok = send_email(
            "DSE Notify: Test Email",
            f"This is a test email from dse-notify.\n"
            f"Sent at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.\n"
            f"If you received this, notifications are working!",
        )
        print("Test email sent!" if ok else "Failed to send test email.")
    elif args.enable or args.disable:
        config = load_email_config()
        if not config:
            print("Not configured. Run 'dse-notify --configure' first.")
            return
        enabled = args.enable
        save_email_config(config["gmail_address"], config["app_password"],
                          enabled=enabled)
        print(f"Email notifications {'enabled' if enabled else 'disabled'}.")
    elif args.status:
        config = load_email_config()
        if not config:
            print("Not configured. Run 'dse-notify --configure' first.")
        else:
            enabled = config.get("enabled", True)
            print(f"Gmail: {config['gmail_address']}")
            print(f"Status: {'enabled' if enabled else 'disabled'}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
