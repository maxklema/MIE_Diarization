import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';

const Waveform = forwardRef(({ audioUrl, onFinish }, ref) => {
  const containerRef = useRef(null);
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
          labelColor: '#fff'
        })
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

  return <div ref={containerRef} className="w-full h-24" />;
});

export default Waveform;