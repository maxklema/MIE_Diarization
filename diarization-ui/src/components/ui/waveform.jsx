import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';

const Waveform = forwardRef(({ audioUrl, onFinish, initialZoom = 120 }, ref) => {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const scrollWrapperRef = useRef(null);
  const waveSurferRef = useRef(null);

  useImperativeHandle(ref, () => ({
    playPause: () => waveSurferRef.current?.playPause(),
    isPlaying: () => waveSurferRef.current?.isPlaying() || false,
    // Expose a zoom method so parents can control zoom if desired
    setZoom: (pxPerSec) => waveSurferRef.current?.zoom(pxPerSec ?? initialZoom),
  }));

  useEffect(() => {
    if (!audioUrl || !containerRef.current) return;

    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
    }

    waveSurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#ddd',
      progressColor: '#3b82f6',
      height: 100,
      responsive: true,
      dragToSeek: true,
      // Make long audio horizontally scrollable by increasing pixels per second
      // and letting the canvas exceed the parent width
      minPxPerSec: initialZoom, // adjust default zoom here
      fillParent: false,
      plugins: [
        Hover.create({
          lineColor: '#ef4444',
          labelBackground: 'rgba(17,24,39,0.9)',
          labelColor: '#fff',
        }),
        Timeline.create({
          container: timelineRef.current,
          height: 20,
          primaryLabelInterval: 5,
          secondaryLabelInterval: 1,
          style: {
            fontSize: '12px',
            color: '#6b7280', // gray-500
          },
        }),
      ],
    });

    waveSurferRef.current.load(audioUrl);

    waveSurferRef.current.on('finish', () => {
      onFinish?.(); // Call the parent's callback when audio finishes
    });

    return () => {
      waveSurferRef.current?.destroy();
    };
  }, [audioUrl, initialZoom]);

  return (
    <div className="w-full">
      {/* Scroll container so long waveforms can be panned horizontally */}
      <div ref={scrollWrapperRef} className="w-full overflow-x-auto">
        <div ref={containerRef} className="h-24" />
        <div ref={timelineRef} className="h-5 mt-1" />
      </div>
    </div>
  );
});

export default Waveform;