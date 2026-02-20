export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="demo__mode-toggle" role="group" aria-label="Select analysis mode">
      <button
        className={`demo__mode-btn ${mode === 'traditional' ? 'demo__mode-btn--active' : ''}`}
        onClick={() => onChange('traditional')}
        aria-pressed={mode === 'traditional'}
      >
        Traditional
      </button>
      <button
        className={`demo__mode-btn ${mode === 'streaming' ? 'demo__mode-btn--active' : ''}`}
        onClick={() => onChange('streaming')}
        aria-pressed={mode === 'streaming'}
      >
        Streaming
      </button>
    </div>
  );
}
