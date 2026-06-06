import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RefreshCw, Zap, Sliders, Layers } from 'lucide-react';

interface ThreeDWaterfallProps {
  analyserNode: AnalyserNode | null;
  audioCtx: AudioContext | null;
  simulatedBuffer: Uint8Array | null;
  themeColor: string;
  lang?: 'fa' | 'en';
}

export default function ThreeDWaterfall({
  analyserNode,
  audioCtx,
  simulatedBuffer,
  themeColor,
  lang = 'fa'
}: ThreeDWaterfallProps) {
  const isEn = lang === 'en';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // 3D camera controls
  const [yaw, setYaw] = useState<number>(-0.6); // Yaw (Left/Right angle)
  const [pitch, setPitch] = useState<number>(0.85); // Pitch (Tilt angle - 0.85 default presents a more top-down oblique view)
  const [zoom, setZoom] = useState<number>(1.2);
  const [heightScale, setHeightScale] = useState<number>(1.4);
  const [gridDensity, setGridDensity] = useState<number>(64); // number of frequency bins to render
  const [speed, setSpeed] = useState<number>(2); // step speed
  const [colorPalette, setColorPalette] = useState<'thermal' | 'cyberpunk' | 'toxic'>('thermal');
  const [isPaused, setIsPaused] = useState<number>(0); // 0 = play, 1 = frozen

  // Refs to avoid stale values inside the high-speed rendering animation frame loop
  const yawRef = useRef(yaw);
  const pitchRef = useRef(pitch);
  const zoomRef = useRef(zoom);
  const heightScaleRef = useRef(heightScale);
  const gridDensityRef = useRef(gridDensity);
  const speedRef = useRef(speed);
  const colorPaletteRef = useRef(colorPalette);
  const isPausedRef = useRef(isPaused);

  useEffect(() => { yawRef.current = yaw; }, [yaw]);
  useEffect(() => { pitchRef.current = pitch; }, [pitch]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { heightScaleRef.current = heightScale; }, [heightScale]);
  useEffect(() => { gridDensityRef.current = gridDensity; }, [gridDensity]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { colorPaletteRef.current = colorPalette; }, [colorPalette]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // Buffer holding historic frequency arrays
  const historyRef = useRef<Float32Array[]>([]);
  const maxHistoryRows = 55;

  // Track drag state
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const reset3D = () => {
    setYaw(-0.6);
    setPitch(0.85);
    setZoom(1.2);
    setHeightScale(1.4);
  };

  const clearHistory = () => {
    historyRef.current = [];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    
    // Fit canvas to dimensions
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = (rect?.width || 800) * (window.devicePixelRatio || 1);
      canvas.height = (rect?.height || 500) * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Render / logic loop
    const renderLoop = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      // Clear with dark atmospheric background
      ctx.fillStyle = '#0a0b10';
      ctx.fillRect(0, 0, width, height);

      // Add subtle glow in center
      const centerGlow = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, width*0.5);
      centerGlow.addColorStop(0, 'rgba(30, 27, 75, 0.25)'); // Indigo base shadow
      centerGlow.addColorStop(1, '#0a0b10');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);

      const fDensity = Math.round(gridDensityRef.current);
      let floatData = new Float32Array(fDensity);

      // 1. GATHER DATA
      if (!isPausedRef.current) {
        if (analyserNode) {
          // Real Mic Data
          // Use byte frequency data because analyser returns logarithmic-relative dB representations
          const byteData = new Uint8Array(analyserNode.frequencyBinCount);
          analyserNode.getByteFrequencyData(byteData);
          
          // Downsample or average out to match gridDensity bins
          const stepSize = Math.floor(byteData.length / fDensity) || 1;
          for (let i = 0; i < fDensity; i++) {
            let sum = 0;
            const startIdx = i * stepSize;
            for (let j = 0; j < stepSize; j++) {
              sum += byteData[startIdx + j] || 0;
            }
            // Normalize raw scale [0..255] to floats [0..1]
            floatData[i] = (sum / stepSize) / 255.0;
          }
        } else if (simulatedBuffer) {
          // Simulator Active
          const stepSize = Math.floor(simulatedBuffer.length / fDensity) || 1;
          for (let i = 0; i < fDensity; i++) {
            let sum = 0;
            const startIdx = i * stepSize;
            for (let j = 0; j < stepSize; j++) {
              sum += simulatedBuffer[startIdx + j] || 0;
            }
            floatData[i] = (sum / stepSize) / 255.0;
          }
        } else {
          // Quiet / ambient hum simulation
          for (let i = 0; i < fDensity; i++) {
            floatData[i] = 0.02 + Math.random() * 0.01;
          }
        }

        // Apply spatial/frequency smoothing
        for (let i = 1; i < fDensity - 1; i++) {
          floatData[i] = floatData[i - 1] * 0.15 + floatData[i] * 0.7 + floatData[i + 1] * 0.15;
        }

        // Add to history
        historyRef.current.unshift(floatData);
        if (historyRef.current.length > maxHistoryRows) {
          historyRef.current.pop();
        }
      }

      // If history is empty, initialize it with flat rows
      if (historyRef.current.length === 0) {
        for (let r = 0; r < maxHistoryRows; r++) {
          historyRef.current.push(new Float32Array(fDensity));
        }
      }

      // Draw grid guide at bottom floor
      const gridWidth = Math.min(width * 0.75, 480);
      const gridDepth = 330;
      const originX = width / 2;
      const originY = height / 2 + 10;

      const project3D = (gx: number, gy: number, gz: number) => {
        // Center-align 3D coords
        // x goes -gridWidth/2 to gridWidth/2
        // z goes -gridDepth/2 to gridDepth/2
        // yaw around Y axis
        const cyaw = Math.cos(yawRef.current);
        const syaw = Math.sin(yawRef.current);
        const cpitch = Math.cos(pitchRef.current);
        const spitch = Math.sin(pitchRef.current);

        // Standard 3D rotations
        // Yaw
        const xRot = gx * cyaw - gz * syaw;
        const zRot = gx * syaw + gz * cyaw;

        // Pitch
        const yRot = gy * cpitch - zRot * spitch;
        const depth = gy * spitch + zRot * cpitch;

        // Perspective mapping
        const camDistance = 330;
        const s = camDistance / (camDistance + depth);
        const screenX = originX + xRot * s * zoomRef.current;
        const screenY = originY - yRot * s * zoomRef.current;

        return { x: screenX, y: screenY, scale: s };
      };

      // 2. RENDER THE 3D MOUNTAIN SLICES
      // Dynamically sort rows from furthest to closest to support 360-degree rotation with Painter's Algorithm
      const rowsCount = historyRef.current.length;
      const palette = colorPaletteRef.current;

      const rowIndices = Array.from({ length: rowsCount }, (_, i) => i);
      const cyaw = Math.cos(yawRef.current);
      const syaw = Math.sin(yawRef.current);
      const cpitch = Math.cos(pitchRef.current);
      const spitch = Math.sin(pitchRef.current);

      rowIndices.sort((a, b) => {
        const zValueA = ((a / (maxHistoryRows - 1)) - 0.5) * gridDepth;
        const zValueB = ((b / (maxHistoryRows - 1)) - 0.5) * gridDepth;
        
        // Depth projection of the center of each row at gy = 0 floor baseline
        const depthA = zValueA * cyaw * cpitch;
        const depthB = zValueB * cyaw * cpitch;
        
        // Sort descending: highest depth (furthest) to lowest depth (closest)
        return depthB - depthA;
      });

      rowIndices.forEach((r, idx) => {
        const rowData = historyRef.current[r];
        const zValue = ((r / (maxHistoryRows - 1)) - 0.5) * gridDepth;

        // Begin line drawing for this row slice
        ctx.beginPath();
        let firstPoint = true;

        for (let col = 0; col < fDensity; col++) {
          const rawVal = rowData[col];
          const xValue = ((col / (fDensity - 1)) - 0.5) * gridWidth;
          
          // Apply height scaling
          const peakHeight = rawVal * 110 * heightScaleRef.current;

          // Project
          const proj = project3D(xValue, peakHeight, zValue);

          if (firstPoint) {
            ctx.moveTo(proj.x, proj.y);
            firstPoint = false;
          } else {
            ctx.lineTo(proj.x, proj.y);
          }
        }

        // Color styling based on selected theme & depth fade
        const depthFade = 1.0 - (r / maxHistoryRows); // 1 at front, fades out at back
        ctx.lineWidth = 1.25 * (depthFade * 0.7 + 0.3);

        let strokeColor = '';
        if (palette === 'thermal') {
          // Warm fiery cascade
          // Low = dark purple, Med = bright orange, High = white hot
          const rColor = Math.floor(depthFade * 150 + 105);
          const gColor = Math.min(255, Math.floor(depthFade * 70 + 30));
          const bColor = Math.min(255, Math.floor(depthFade * 30 + 10));
          strokeColor = `rgba(${rColor}, ${gColor}, ${bColor}, ${depthFade * 0.82})`;
        } else if (palette === 'cyberpunk') {
          // Cyberpunk Cyan / Neon pink cascade
          const gColor = Math.floor(depthFade * 200 + 55);
          strokeColor = `rgba(6, 182, 212, ${depthFade * 0.82})`; // Cyan base
        } else {
          // Toxic Acid Green / Yellow
          strokeColor = `rgba(16, 185, 129, ${depthFade * 0.82})`;
        }

        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        // 3. FILL SOLID BASE UNDER THE SURFACE (For realistic solid structural terrain occlusions)
        if (idx > 0) {
          ctx.beginPath();
          let pStart = project3D(-0.5 * gridWidth, 0, zValue);
          ctx.moveTo(pStart.x, pStart.y);

          for (let col = 0; col < fDensity; col++) {
            const rawVal = rowData[col];
            const xValue = ((col / (fDensity - 1)) - 0.5) * gridWidth;
            const peakHeight = rawVal * 110 * heightScaleRef.current;
            const p = project3D(xValue, peakHeight, zValue);
            ctx.lineTo(p.x, p.y);
          }

          let pEnd = project3D(0.5 * gridWidth, 0, zValue);
          ctx.lineTo(pEnd.x, pEnd.y);
          ctx.closePath();

          // Create surface-elevation dark occlusion fill
          ctx.fillStyle = 'rgba(10, 11, 16, 0.95)'; // dense solid dark masking
          ctx.fill();
        }
      });

      // Draw subtle axis guidelines at the floor level
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      
      const p1 = project3D(-gridWidth/2, 0, -gridDepth/2);
      const p2 = project3D(gridWidth/2, 0, -gridDepth/2);
      const p3 = project3D(gridWidth/2, 0, gridDepth/2);
      const p4 = project3D(-gridWidth/2, 0, gridDepth/2);

      // Floor boundary wireframe
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.stroke();

      // Draw labels along X-axis (Frequency logarithmic increments)
      const labelFreqs = ['20Hz', '250Hz', '1kHz', '4kHz', '16kHz', '24kHz+'];
      ctx.fillStyle = 'rgba(156, 163, 175, 0.6)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';

      labelFreqs.forEach((label, idx) => {
        const pct = idx / (labelFreqs.length - 1);
        const xVal = (pct - 0.5) * gridWidth;
        const floorPt = project3D(xVal, -8, gridDepth/2); // slightly below front edge
        ctx.fillText(label, floorPt.x, floorPt.y + 12);
      });

      // Direction indicator text
      ctx.fillStyle = 'rgba(156, 163, 175, 0.4)';
      const frontCenter = project3D(0, -6, gridDepth/2);
      ctx.fillText('◄ LOW FREQS (بم) | HIGH FREQS (زیر) ►', frontCenter.x, frontCenter.y + 26);

      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    // Native mouse wheel zooming with passive listener false to allow e.preventDefault()
    const handleCanvasWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(prev => Math.max(0.4, Math.min(3.5, prev - e.deltaY * 0.001)));
    };
    canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('wheel', handleCanvasWheel);
    };
  }, [analyserNode, simulatedBuffer]);

  // Handle Dragging rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;
    
    // Smooth angular update
    setYaw(prev => prev + deltaX * 0.007);
    // Allow pitch to go up to 1.57 (perfectly vertical overhead top-down view)
    setPitch(prev => Math.max(-1.57, Math.min(1.57, prev + deltaY * 0.007))); 

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  return (
    <div className="relative flex flex-col h-full bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-md overflow-hidden">
      {/* Visualizer header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-lg text-white">
            <Layers className="w-4 h-4 animate-pulse" />
          </span>
          <div>
            <h3 className="font-sans font-medium text-slate-100 flex items-center gap-2">
              <span>{isEn ? '3D Waterfall Spectrogram' : 'طیف‌نگار سه‌بعدی آبشاری'}</span>
              {!isEn && <span className="text-xs text-slate-400 font-mono">3D Waterfall Spectrogram</span>}
            </h3>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              {isEn ? 'Tracks historical sound peaks as virtual terrain topography over time.' : 'ترسیم بلندی فرکانس‌ها به صورت سلسله کوه‌های زمین‌شناسی در بازه زمان'}
            </p>
          </div>
        </div>

        {/* Toolbar parameters */}
        <div className="flex items-center gap-2">
          {/* Palette Selector */}
          <div className="flex items-center bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setColorPalette('thermal')}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${colorPalette === 'thermal' ? 'bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {isEn ? 'Thermal' : 'آتشفشانی'}
            </button>
            <button
              onClick={() => setColorPalette('cyberpunk')}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${colorPalette === 'cyberpunk' ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {isEn ? 'Cyberpunk' : 'سایبرپانک'}
            </button>
            <button
              onClick={() => setColorPalette('toxic')}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${colorPalette === 'toxic' ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {isEn ? 'Toxic' : 'اسیدی'}
            </button>
          </div>

          <button
            onClick={() => setIsPaused(prev => prev === 0 ? 1 : 0)}
            className="p-2 bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title={isEn ? (isPaused ? "Resume waterfall" : "Pause waterfall") : (isPaused ? "ادامه روند نمایش" : "متوقف کردن حرکت آبشاری")}
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
          </button>

          <button
            onClick={clearHistory}
            className="p-2 bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-800 text-slate-300 hover:text-white transition-colors animate-hover"
            title={isEn ? "Clear frequency logs" : "پاک‌سازی تاریخچه فرکانس‌ها"}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Render Area */}
      <div 
        className="relative flex-1 cursor-grab active:cursor-grabbing select-none overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        {/* Interaction hint overlay */}
        <div className="absolute bottom-4 right-4 pointer-events-none bg-slate-950/80 backdrop-blur-sm border border-slate-800 px-3 py-1.5 rounded-lg text-[10px] text-slate-400 font-sans leading-relaxed">
          {isEn ? '💡 Drag to rotate 3D camera angle • Scroll wheel to zoom' : '💡 ماوس را بکشید (Drag) تا زاویه دوربین تغییر کند • غلتک ماوس برای زوم'}
        </div>
      </div>

      {/* Detail Slider Parameters at Bottom */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/80 bg-slate-950/20">
        {/* Detail Density */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-300 flex justify-between font-sans">
            <span>{isEn ? 'Bin Density' : 'تراکم شیارها (Bin Density)'}</span>
            <span className="font-mono text-cyan-400">{gridDensity} bins</span>
          </label>
          <input
            type="range"
            min="32"
            max="128"
            step="8"
            value={gridDensity}
            onChange={(e) => setGridDensity(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
        </div>

        {/* Height Multiplying Amplification */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-300 flex justify-between font-sans">
            <span>{isEn ? 'Amplitude Scale' : 'ضریب ارتفاع کوه‌ها (Amplitude Scale)'}</span>
            <span className="font-mono text-cyan-400">{heightScale.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={heightScale}
            onChange={(e) => setHeightScale(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
        </div>

        {/* Preset angles Reset parameter */}
        <div className="flex items-center justify-end">
          <button
            onClick={reset3D}
            className="w-full md:w-auto px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs text-white font-medium rounded-lg shadow-lg hover:shadow-indigo-500/10 transition-all flex items-center justify-center gap-2"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isEn ? 'Reset Camera Angle' : 'ریستارت زاویه دوربین سه‌بعدی'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
