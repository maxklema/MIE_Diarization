import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import WaveSurfer from 'wavesurfer.js';

const Waveform = forwardRef(({ audioUrl }, ref) => {
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
    });

    waveSurferRef.current.load(audioUrl);

    return () => {
      waveSurferRef.current?.destroy();
    };
  }, [audioUrl]);

  return <div ref={containerRef} className="w-full h-24" />;
});

export default Waveform;