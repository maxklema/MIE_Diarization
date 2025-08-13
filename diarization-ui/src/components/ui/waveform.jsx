import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import WaveSurfer from 'wavesurfer.js'
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js'
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js'

const Waveform = forwardRef(({ audioUrl, onFinish, initialZoom = 120 }, ref) => {
  const scrollWrapperRef = useRef(null)
  const contentRef = useRef(null)            // Shared inner wrapper
  const containerRef = useRef(null)          // Waveform container
  const timelineRef = useRef(null)           // Timeline container
  const waveSurferRef = useRef(null)
  const currentPxPerSecRef = useRef(initialZoom)

  useImperativeHandle(ref, () => ({
    playPause: () => waveSurferRef.current?.playPause(),
    isPlaying: () => waveSurferRef.current?.isPlaying() || false,
    setZoom: (pxPerSec) => {
      if (waveSurferRef.current) {
        const next = pxPerSec ?? initialZoom
        currentPxPerSecRef.current = next
        waveSurferRef.current.zoom(next)
        syncContentWidth()
      }
    },
  }))

  useEffect(() => {
    if (!audioUrl || !containerRef.current) return

    if (waveSurferRef.current) {
      waveSurferRef.current.destroy()
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#ddd',
      progressColor: '#3b82f6',
      height: 100,
      responsive: true,
      dragToSeek: true,
      minPxPerSec: initialZoom,
      fillParent: false, // allow horizontal overflow
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
            color: '#6b7280',
          },
        }),
      ],
    })

    waveSurferRef.current = ws

    const syncContentWidth = () => {
      // Compute width using duration * pxPerSec to ensure both waveform & timeline match
      const duration = ws.getDuration?.() || 0
      const pxPerSec = currentPxPerSecRef.current || initialZoom
      const widthPx = Math.max(1, Math.ceil(duration * pxPerSec))

      if (contentRef.current) {
        contentRef.current.style.width = `${widthPx}px`
      }
    }

    ws.on('ready', () => {
      // Defer width calc slightly so timeline has mounted
      requestAnimationFrame(() => {
        syncContentWidth()
      })
    })

    ws.on('zoom', (pxPerSec) => {
      currentPxPerSecRef.current = pxPerSec
      syncContentWidth()
    })

    ws.on('redraw', syncContentWidth)
    window.addEventListener('resize', syncContentWidth)

    ws.load(audioUrl)

    ws.on('finish', () => {
      onFinish?.()
    })

    return () => {
      window.removeEventListener('resize', syncContentWidth)
      waveSurferRef.current?.destroy()
    }
  }, [audioUrl, initialZoom])

  return (
    <div className="w-full">
      {/* Scrollable wrapper so long waveforms can be panned horizontally */}
      <div ref={scrollWrapperRef} className="w-full overflow-x-auto">
        {/* Inner content whose width we control explicitly */}
        <div ref={contentRef}>
          <div ref={containerRef} className="h-24" />
          <div ref={timelineRef} className="h-5 mt-1" />
        </div>
      </div>
    </div>
  )
})

export default Waveform