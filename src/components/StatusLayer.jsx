function Panel({ title, body, action }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-950/92 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm text-center">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
        {action}
      </div>
    </div>
  );
}

function Button({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

/**
 * Everything that can stand between a shopper and a working viewfinder, in the
 * order they'd hit it. Each state says what to actually do about it — a person
 * standing in a shop is not going to debug a generic error string.
 */
export default function StatusLayer({ camera, model, assetsFailed, onRetry }) {
  if (camera.status === 'unsupported') {
    return (
      <Panel
        title="Camera needs a secure connection"
        body={camera.error}
      />
    );
  }

  if (camera.status === 'denied') {
    return (
      <Panel
        title="Camera permission needed"
        body="Try-on runs entirely on your phone — nothing is recorded or uploaded. Allow camera access in your browser's site settings, then tap retry."
        action={<Button onClick={onRetry}>Retry</Button>}
      />
    );
  }

  if (camera.status === 'error') {
    return <Panel title="Camera unavailable" body={camera.error} action={<Button onClick={onRetry}>Try again</Button>} />;
  }

  if (camera.status === 'idle') {
    return (
      <Panel
        title="Ready when you are"
        body="Tap to open the camera and see the suit on yourself."
        action={<Button onClick={onRetry}>Start try-on</Button>}
      />
    );
  }

  if (model.status === 'error') {
    return <Panel title="Pose tracking unavailable" body={model.error} action={<Button onClick={() => window.location.reload()}>Reload</Button>} />;
  }

  if (camera.status === 'requesting' || model.status !== 'ready') {
    return (
      <Panel
        title={camera.status === 'requesting' ? 'Starting camera…' : 'Loading body tracking…'}
        body={
          camera.status === 'requesting'
            ? 'Accept the permission prompt to continue.'
            : 'One-time download, a few seconds on first open.'
        }
      />
    );
  }

  if (assetsFailed.length) {
    return (
      <Panel
        title="Garment art missing"
        body={`Could not load the overlay for ${assetsFailed.join(', ')}. Check the file paths in src/data/garments.js.`}
      />
    );
  }

  return null;
}
