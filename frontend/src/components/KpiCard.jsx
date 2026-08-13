export default function KpiCard({ title, value, change, trend, icon: Icon, color = 'blue' }) {
  return (
    <div className={`kpi-card kpi-card--${color}`}>
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
          {change}
        </div>
      )}
    </div>
  );
}
