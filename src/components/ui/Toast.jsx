'use client';

const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <div className="toast-icon">{ICONS[t.type]}</div>
          <div style={{ flex: 1 }}>
            <div className="toast-title">{t.title}</div>
            {t.message && (
              <div
                className="toast-msg"
                dangerouslySetInnerHTML={{ __html: t.message }}
              />
            )}
          </div>
          <button className="toast-close" onClick={() => onRemove(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
