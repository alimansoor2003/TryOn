import SilhouetteGuide from './SilhouetteGuide.jsx';

/**
 * The viewfinder. A `<video>` and a static guide — nothing per-frame.
 *
 * The mirror lives on a wrapper rather than the video so anything layered on
 * top inherits it, and so the capture path can undo it with one flag instead of
 * reasoning about transformed coordinates.
 */
export default function CameraView({ videoRef, mirrored, showGuide = true }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div className="absolute inset-0" style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}>
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
      </div>
      {/* Outside the mirrored wrapper: a flipped guide is still symmetrical, but
          flipped caption text is not. */}
      {showGuide && <SilhouetteGuide />}
    </div>
  );
}
