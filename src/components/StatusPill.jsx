export function StatusPill({ variant = 'success', children }) {
  return <span className={`status-pill ${variant}`}>{children}</span>;
}

export default StatusPill;
