import { useState } from 'react';
import { Download, FileText, Code, Check } from 'lucide-react';

const FORMATS = [
  { id: 'csv',  label: 'CSV',  icon: FileText },
  { id: 'json', label: 'JSON', icon: Code },
  { id: 'pdf',  label: 'PDF',  icon: Download },
];

export default function ExportCard({ onExport }) {
  const [activeFormat, setActiveFormat] = useState('csv');
  const [isExporting,  setIsExporting]  = useState(false);
  const [done,         setDone]         = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setDone(false);
    try {
      if (onExport) await onExport(activeFormat);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-card">
      <div className="export-card__header">
        <div className="export-card__title">Export Asset Report</div>
        <div className="export-card__subtitle">Download full attack surface inventory telemetry</div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className={`btn btn--primary ${isExporting ? 'loading' : ''}`}
          onClick={handleExport}
          disabled={isExporting}
        >
          {done ? <Check size={14} color="var(--low)" /> : <Download size={14} />}
          <span>{done ? 'Exported!' : isExporting ? 'Generating...' : `Export ${activeFormat.toUpperCase()}`}</span>
        </button>

        <div className="export-card__format-options" role="group">
          {FORMATS.map((fmt) => {
            const FmtIcon = fmt.icon;
            return (
              <button
                key={fmt.id}
                className={`format-pill ${activeFormat === fmt.id ? 'active' : ''}`}
                onClick={() => setActiveFormat(fmt.id)}
              >
                <FmtIcon size={12} style={{ marginRight: 4 }} />
                {fmt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
