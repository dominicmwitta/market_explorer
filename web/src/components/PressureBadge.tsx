const STYLES: Record<string, string> = {
  "Strong Buy Pressure": "bg-status-good/15 text-status-good",
  "Strong Buy Pressure (No Offers)": "bg-status-good/15 text-status-good",
  "Sell Pressure": "bg-status-critical/15 text-status-critical",
  Neutral: "bg-text-muted/15 text-text-secondary",
};

export default function PressureBadge({ pressure }: { pressure: string }) {
  const style = STYLES[pressure] ?? STYLES.Neutral;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {pressure}
    </span>
  );
}
