/** An empty screen is an instruction, not a shrug. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-start gap-3 px-5 py-10">
      <p className="text-sm font-semibold text-navy">{title}</p>
      {hint ? <p className="max-w-prose text-sm text-muted">{hint}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
