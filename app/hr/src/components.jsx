import React from "react";

const paths = {
  bridge: (
    <>
      <path d="M4 18V6h5v12M15 18V6h5v12M9 12h6" />
      <path d="M2 20h20" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V4h8v3M3 12c6 3 12 3 18 0M10 13h4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0112 0v2M16 5a3 3 0 010 6M18 14a5 5 0 013 5" />
    </>
  ),
  report: (
    <>
      <path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" />
    </>
  ),
  task: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M9 3h6v4H9zM8 12h8M8 16h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  arrow: <path d="M4 12h16M14 6l6 6-6 6" />,
  back: <path d="M20 12H4m6-6l-6 6 6 6" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  check: <path d="M5 12l4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 016 0c0 2-3 2-3 4M12 17h.01" />
    </>
  ),
  reset: (
    <>
      <path d="M3 10a9 9 0 111 8M3 4v6h6" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4zM20 3v4M18 5h4" />
    </>
  ),
  pin: (
    <>
      <path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 0114 0z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3L2 8l10 5 10-5zM2 12l10 5 10-5M2 16l10 5 10-5" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3v17h17M8 16v-5M13 16V7M18 16V4" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M16 8l-2 6-6 2 2-6z" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H5v18h14V8zM14 3v5h5M8 13h8M8 17h5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5l5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  send: (
    <>
      <path d="M22 2L9 15M22 2l-7 20-6-7-7-6z" />
    </>
  ),
  bulb: (
    <>
      <path d="M8 15a7 7 0 118 0l-1 3H9zM9 21h6" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M15 15l6 6" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 007 0l4-4a5 5 0 00-7-7l-3 3M14 11a5 5 0 00-7 0l-4 4a5 5 0 007 7l3-3" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3L2 21h20zM12 9v5M12 17h.01" />
    </>
  ),
  play: <path d="M7 3l14 9-14 9z" />,
};
export function Icon({ name, size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.file}
    </svg>
  );
}
export function Button({
  children,
  icon,
  variant = "secondary",
  className = "",
  ...props
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}
export function Badge({ children, tone = "neutral", dot = true }) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="status-dot" />}
      {children}
    </span>
  );
}
export function Card({ children, className = "", ...props }) {
  return (
    <section className={`card ${className}`} {...props}>
      {children}
    </section>
  );
}
export function SectionTitle({ eyebrow, title, children }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function EmptyState({ icon = "task", title, children, action }) {
  return (
    <Card className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={30} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </Card>
  );
}
export function FileRow({ name, meta, onClick }) {
  return (
    <button className="file-row" onClick={onClick}>
      <span className={`file-icon ${name.endsWith(".csv") ? "csv" : ""}`}>
        <Icon name={name.endsWith(".csv") ? "database" : "file"} />
      </span>
      <span>
        <strong>{name}</strong>
        <small>
          {meta ||
            (name.endsWith(".csv")
              ? "CSV · Demo resource"
              : "Document · Demo resource")}
        </small>
      </span>
      <Icon name="chevron" size={15} />
    </button>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-heading">
        <div>
          <div className="eyebrow">EVIDENCEBRIDGE</div>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function ChannelChart({ compact = false }) {
  const values = [
    ["Organic", 3.8, 3.5],
    ["Paid Search", 3.2, 1.8],
    ["Social", 2.8, 2.1],
    ["Email", 4.5, 4.4],
    ["Direct", 3.49, 2.66],
  ];
  return (
    <div className={`channel-chart ${compact ? "compact" : ""}`}>
      <div className="chart-legend">
        <span>
          <i className="previous" />
          Previous month
        </span>
        <span>
          <i />
          Last 4 weeks
        </span>
      </div>
      <div
        className="chart-bars"
        role="img"
        aria-label="Conversion by channel. Paid Search declined from 3.2% to 1.8%, the largest decline."
      >
        {values.map(([name, before, after]) => (
          <div
            className={`bar-group ${name === "Paid Search" ? "highlight" : ""}`}
            key={name}
          >
            <div className="bar-pair">
              <div
                className="bar previous"
                style={{ height: `${(before / 5) * 100}%` }}
              >
                <span>{before}%</span>
              </div>
              <div className="bar" style={{ height: `${(after / 5) * 100}%` }}>
                <span>{after}%</span>
              </div>
            </div>
            <small>{name}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
