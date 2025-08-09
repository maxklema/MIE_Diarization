import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';

const Waveform = forwardRef(({ audioUrl, onFinish }, ref) => {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const waveSurferRef = useRef(null);

  useImperativeHandle(ref, () => ({
    playPause: () => waveSurferRef.current?.playPause(),
    isPlaying: () => waveSurferRef.current?.isPlaying() || false,
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
  }, [audioUrl]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full h-24" />
      <div ref={timelineRef} className="w-full h-5 mt-1" />
    </div>
  );
});

export default Waveform;