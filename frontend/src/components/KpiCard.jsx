export default function KpiCard({ id, title, value, change, trend, icon: Icon, color = 'blue', meta, progress }) {
  return (
    <div className={`kpi-card kpi-card--${color}`} id={id}>
      <div className="kpi-card__header">
        <span className="kpi-card__title">{title}</span>
        {Icon && (
          <div className="kpi-card__icon">
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="kpi-card__value">{value}</div>

      {change && (
        <div className={`kpi-card__change kpi-card__change--${trend || 'up'}`}>
          {trend === 'up' ? '▲' : '▼'} {change}
        </div>
      )}

      {progress !== undefined && (
        <div className="kpi-card__progress">
          <div className="kpi-card__progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}

      {meta && (
        <div className="kpi-card__meta">
          <span>{meta.left}</span>
          <span>{meta.right}</span>
        </div>
      )}
    </div>
  );
}
