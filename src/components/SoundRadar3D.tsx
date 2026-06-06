import React, { useRef, useEffect, useState } from 'react';
import { Compass, Volume2, Move, HelpCircle, Sparkles, Orbit, Signal, Plus, Trash2 } from 'lucide-react';
import { SoundEmitter, FREQUENCY_BANDS } from '../types';

interface SoundRadar3DProps {
  emitters: SoundEmitter[];
  onUpdateEmitter: (id: string, updated: Partial<SoundEmitter>) => void;
  onAddEmitter: (emitter: SoundEmitter) => void;
  onRemoveEmitter: (id: string) => void;
  // Live mic details if operating in live mode
  isLiveMode: boolean;
  livePan: number; // -1 to 1 representing horizontal panning L to R
  liveDistance: number; // 0 to 100 estimated distance (volume based)
  liveHeight: number; // -100 to 100 estimated height based on spectral centroid/pitch
  liveVolume: number; // Current volume amplitude
  livePeakFreq: number; // Current peak frequency
  lang?: 'fa' | 'en';
}

export default function SoundRadar3D({
  emitters,
  onUpdateEmitter,
  onAddEmitter,
  onRemoveEmitter,
  isLiveMode,
  livePan,
  liveDistance,
  liveHeight,
  liveVolume,
  livePeakFreq,
  lang = 'fa',
}: SoundRadar3DProps) {
  const isEn = lang === 'en';
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedEmitterId, setSelectedEmitterId] = useState<string>(emitters[0]?.id || '');

  // 3D Grid viewing angle (isometric orbit angle)
  const [orbitAngle, setOrbitAngle] = useState<number>(0.4); // radian yaw
  const orbitAngleRef = useRef(orbitAngle);
  useEffect(() => { orbitAngleRef.current = orbitAngle; }, [orbitAngle]);

  const isDragging = useRef(false);
  const lastMouseX = useRef(0);

  // Quick sound generator presets
  const generatorPresets = [
    { name: 'پشه مینیاتوری (فرازون)', nameEn: 'Mosquito Buzz', hz: 17400, type: 'human-high', icon: '🦟', desc: 'بال زدن حشره با فرکانس بسیار بالا نزدیک محدوده شنوایی انسان' },
    { name: 'پاسپورت خفاش (فراصوت)', nameEn: 'Bat Echo-click', hz: 23500, type: 'ultrasound', icon: '🦇', desc: 'صدای رفلکس جهت‌یابی خفاش خارج از توان شنوایی طبیعی انسان' },
    { name: 'ترانسفورماتور سنگین (بم)', nameEn: 'Sub-bass Hum', hz: 50, type: 'human-bass', icon: '⚡', desc: 'زمزمه برق ۵۰ هرتز شبکه برق متناوب با طول موج بلند' },
    { name: 'صدای سوت ریتمیک (زیر)', nameEn: 'Whistle Sweep', hz: 3500, type: 'human-mid', icon: '😗', desc: 'سوت ممتد انسان در محدوده حساس شنوایی متوسط' },
    { name: 'سیگنال زلزله (فروصوت)', nameEn: 'Earthquake Sub', hz: 12, type: 'infrasound', icon: '🌋', desc: 'نوسانات بسیار آهسته صفحات درون زمین حاصل از ارتعاش عمیق' }
  ];

  const handleCreatePreset = (preset: typeof generatorPresets[0]) => {
    const newEmitter: SoundEmitter = {
      id: Math.random().toString(),
      name: preset.nameEn,
      nameFa: preset.name,
      type: preset.type as any,
      frequency: preset.hz,
      volume: 65,
      x: (Math.random() - 0.5) * 120,
      y: Math.random() * 80 + 10, // positive height above surface
      z: (Math.random() - 0.5) * 120,
      icon: preset.icon,
      description: preset.nameEn,
      descriptionFa: preset.desc
    };
    onAddEmitter(newEmitter);
    setSelectedEmitterId(newEmitter.id);
  };

  const selectedEmitter = emitters.find(e => e.id === selectedEmitterId);

  // Drag handles for rotate of coordinates
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouseX.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastMouseX.current;
    setOrbitAngle(prev => prev + deltaX * 0.01);
    lastMouseX.current = e.clientX;
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  // Sound Wave Phases for animating wave crests from emitters
  const emitterPhaseRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resizeRadar = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = (rect?.width || 500) * (window.devicePixelRatio || 1);
      canvas.height = (rect?.height || 400) * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resizeRadar();
    window.addEventListener('resize', resizeRadar);

    const drawRadarLoop = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      // Dark futuristic slate radar style
      ctx.fillStyle = '#0a0b12';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2 + 30;
      const scaleFactor = 1.3; // scale coordinates on screen

      // Perspective projection helper for radar floor
      // Coordinates X (horizontal L-R), Y (Vertical up-down from floor), Z (depth front-back)
      const projectRadar3D = (rx: number, ry: number, rz: number) => {
        const angle = orbitAngleRef.current;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Yaw Rotation around Y axis
        const rotX = rx * cosA - rz * sinA;
        const rotZ = rx * sinA + rz * cosA;

        // Apply a isometric mock tilt angle (approx 30 degree tilt)
        const tiltX = rotX;
        const tiltY = ry - rotZ * 0.45; // simulated depth squishing

        return {
          x: centerX + tiltX * scaleFactor,
          y: centerY - tiltY * scaleFactor,
          depth: rotZ
        };
      };

      // 1. DRAW COORD PLATFORM FLOOR
      ctx.lineWidth = 1;
      
      // Dynamic rings corresponding to distances
      const distances = [40, 80, 120];
      distances.forEach((dist, i) => {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(51, 65, 85, ${0.4 - i * 0.1})`;
        
        // draw circular ring projected in 3D
        const steps = 64;
        for (let s = 0; s <= steps; s++) {
          const rAngle = (s / steps) * Math.PI * 2;
          const rx = Math.cos(rAngle) * dist;
          const rz = Math.sin(rAngle) * dist;
          const pt = projectRadar3D(rx, 0, rz);
          if (s === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.stroke();

        // Distance text labels along X-axis
        const edgePt = projectRadar3D(dist, 0, 0);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${dist}m`, edgePt.x + 3, edgePt.y + 3);
      });

      // Lateral Compass lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
      ctx.beginPath();
      // East-West line
      const ptE = projectRadar3D(-140, 0, 0);
      const ptW = projectRadar3D(140, 0, 0);
      ctx.moveTo(ptE.x, ptE.y);
      ctx.lineTo(ptW.x, ptW.y);
      // North-South line
      const ptN = projectRadar3D(0, 0, -140);
      const ptS = projectRadar3D(0, 0, 140);
      ctx.moveTo(ptN.x, ptN.y);
      ctx.lineTo(ptS.x, ptS.y);
      ctx.stroke();

      // Labels relative to directions
      const arrowEast = projectRadar3D(150, 0, 0);
      const arrowWest = projectRadar3D(-150, 0, 0);
      const arrowNorth = projectRadar3D(0, 0, -150);
      const arrowSouth = projectRadar3D(0, 0, 150);
      
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('L (چپ)', arrowWest.x, arrowWest.y);
      ctx.fillText('R (راست)', arrowEast.x, arrowEast.y);
      ctx.fillText('N (جلو)', arrowNorth.x, arrowNorth.y);
      ctx.fillText('South', arrowSouth.x, arrowSouth.y);

      // 2. DRAW THE ROOT LISTENER / MICROPHONE IN THE CENTER
      const listenerPt = projectRadar3D(0, 0, 0);
      
      // Draw dynamic pulsing spatial aura for user head/mic
      const listenerPulsing = (Date.now() % 2000) / 2000;
      ctx.beginPath();
      ctx.strokeStyle = isLiveMode ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)';
      ctx.lineWidth = 1.5;
      
      const auraMaxRadius = 25;
      const curAuraRadius = listenerPulsing * auraMaxRadius;
      // Draw ellipse to align with depth perspective
      ctx.ellipse(
        listenerPt.x, 
        listenerPt.y, 
        curAuraRadius * scaleFactor, 
        curAuraRadius * scaleFactor * 0.45, 
        0, 0, Math.PI * 2
      );
      ctx.stroke();

      // Main listener node circle
      ctx.beginPath();
      const glowGrad = ctx.createRadialGradient(listenerPt.x, listenerPt.y, 2, listenerPt.x, listenerPt.y, 10);
      glowGrad.addColorStop(0, '#ffffff');
      glowGrad.addColorStop(0.3, isLiveMode ? '#10b981' : '#6366f1'); // Green live, Indigo sim
      glowGrad.addColorStop(1, 'rgba(10, 11, 18, 0.2)');
      ctx.fillStyle = glowGrad;
      ctx.arc(listenerPt.x, listenerPt.y, 9, 0, Math.PI*2);
      ctx.fill();

      // Central core symbol
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(listenerPt.x, listenerPt.y, 3, 0, Math.PI*2);
      ctx.fill();

      // Direction Cone highlight if live sound detected
      if (isLiveMode && liveVolume > 0.05) {
        // pan is -1 (L) to 1 (R). Represent as angle.
        const panAngle = (livePan * Math.PI) / 2; // pan sweeps -90 to +90 degrees (facing front edge)
        const radAngle = -Math.PI / 2 + panAngle; // adjust relative to camera north center
        
        const beamLength = Math.max(30, Math.min(100, liveDistance * 1.5));
        const coneX = Math.cos(radAngle) * beamLength;
        const coneZ = Math.sin(radAngle) * beamLength;

        // Angle vector in simulated height
        const actualHt = liveHeight;

        const targetAudioPt = projectRadar3D(coneX, actualHt, coneZ);

        // Beam lines
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(listenerPt.x, listenerPt.y);
        ctx.lineTo(targetAudioPt.x, targetAudioPt.y);
        ctx.stroke();

        // Pulsing active detection node
        ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
        ctx.beginPath();
        ctx.arc(targetAudioPt.x, targetAudioPt.y, 6, 0, Math.PI*2);
        ctx.fill();

        // Draw altitude line from floor up to the elevated sound peak
        const floorTargetPt = projectRadar3D(coneX, 0, coneZ);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(floorTargetPt.x, floorTargetPt.y);
        ctx.lineTo(targetAudioPt.x, targetAudioPt.y);
        ctx.stroke();
        ctx.setLineDash([]); // clear dash

        // Draw shadow/puck on floor
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.beginPath();
        ctx.ellipse(floorTargetPt.x, floorTargetPt.y, 6, 6 * 0.45, 0, 0, Math.PI*2);
        ctx.fill();

        // Dynamic textual readout
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`LIVE CAPTURE: ${Math.round(livePeakFreq)}Hz | ${Math.round(liveDistance)}m (${livePan > 0 ? "راست" : "چپ"})`, targetAudioPt.x, targetAudioPt.y - 12);
        ctx.shadowBlur = 0;
      }

      // 3. DRAW SYNTHETIC SOUND SOURCES (IN SIMULATOR MODE)
      if (!isLiveMode) {
        emitters.forEach((emitter) => {
          const isSelected = emitter.id === selectedEmitterId;
          
          // Phase tracking for wave ripple animation
          if (!emitterPhaseRef.current[emitter.id]) {
            emitterPhaseRef.current[emitter.id] = 0;
          }
          // Increment phase based on frequency frequency
          // lower sounds pulse slower, higher sounds pulse faster
          emitterPhaseRef.current[emitter.id] += (0.01 + (emitter.frequency / 25000) * 0.05);
          if (emitterPhaseRef.current[emitter.id] > 1) {
            emitterPhaseRef.current[emitter.id] = 0;
          }

          const currentPhase = emitterPhaseRef.current[emitter.id];
          const bandInfo = FREQUENCY_BANDS[emitter.type];
          const emitterColor = bandInfo ? bandInfo.color : '#6366f1';

          // Coordinates
          const srcPt = projectRadar3D(emitter.x, emitter.y, emitter.z);
          const floorPt = projectRadar3D(emitter.x, 0, emitter.z);

          // Draw altitude pedestal line (vertical indicator height)
          ctx.beginPath();
          ctx.strokeStyle = isSelected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(148, 163, 184, 0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.moveTo(floorPt.x, floorPt.y);
          ctx.lineTo(srcPt.x, srcPt.y);
          ctx.stroke();
          ctx.setLineDash([]); // clear dash

          // Floor circular projection plate representing sound source footprint
          ctx.beginPath();
          ctx.fillStyle = drawsColorWithAlpha(emitterColor, 0.08);
          ctx.strokeStyle = drawsColorWithAlpha(emitterColor, 0.25);
          ctx.lineWidth = isSelected ? 1.5 : 1;
          ctx.ellipse(floorPt.x, floorPt.y, 8 * scaleFactor, 8 * scaleFactor * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Ripple animated spatial wave emitted from source node
          const maxRippleBytes = 35;
          const currentRippleRadius = currentPhase * maxRippleBytes;
          ctx.beginPath();
          ctx.strokeStyle = drawsColorWithAlpha(emitterColor, (1.0 - currentPhase) * 0.45);
          ctx.lineWidth = 1.25;
          ctx.ellipse(srcPt.x, srcPt.y, currentRippleRadius, currentRippleRadius * 0.55, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Core node circle
          ctx.beginPath();
          const radialGrad = ctx.createRadialGradient(srcPt.x, srcPt.y, 1, srcPt.x, srcPt.y, 8);
          radialGrad.addColorStop(0, '#ffffff');
          radialGrad.addColorStop(0.2, emitterColor);
          radialGrad.addColorStop(0.8, drawsColorWithAlpha(emitterColor, 0.2));
          radialGrad.addColorStop(1, 'transparent');
          
          ctx.fillStyle = radialGrad;
          ctx.arc(srcPt.x, srcPt.y, 9, 0, Math.PI*2);
          ctx.fill();

          // Emitter Icon symbol in center of source
          ctx.fillStyle = '#ffffff';
          ctx.font = '11px Apple Color Emoji, Segoe UI Emoji, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(emitter.icon, srcPt.x, srcPt.y + 3.5);

          // Selection glow ring
          if (isSelected) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(srcPt.x, srcPt.y, 11, 0, Math.PI*2);
            ctx.stroke();
          }

          // Labels
          ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(241, 245, 249, 0.7)';
          ctx.font = isSelected ? 'bold 10px Inter, sans-serif' : '9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(isEn ? emitter.name : emitter.nameFa, srcPt.x, srcPt.y - 14);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
          ctx.font = '8px JetBrains Mono, monospace';
          ctx.fillText(`${emitter.frequency}Hz`, srcPt.x, srcPt.y - 24);
        });
      }

      animId = requestAnimationFrame(drawRadarLoop);
    };

    drawRadarLoop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeRadar);
    };
  }, [emitters, selectedEmitterId, isLiveMode, livePan, liveDistance, liveHeight, liveVolume, livePeakFreq]);

  // Helper utility to draw rgba from hex string
  const drawsColorWithAlpha = (hex: string, alpha: number) => {
    const sanitizedHex = hex.replace('#', '');
    const r = parseInt(sanitizedHex.substring(0, 2), 16);
    const g = parseInt(sanitizedHex.substring(2, 4), 16);
    const b = parseInt(sanitizedHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-5 bg-slate-905">
      
      {/* 3D Coords representation dome */}
      <div className="flex-1 min-h-[300px] bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-md overflow-hidden flex flex-col">
        {/* Header toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </span>
            <div>
              <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono">3D Spatial Acoustic</span>
              <h4 className="font-sans font-medium text-slate-100 mt-0.5">
                {isEn ? '3D Soundscape Triangulation Radar' : 'شبیه‌ساز سه‌بعدی محیط صوتی'}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-full">
            <span className={`w-2 h-2 rounded-full ${isLiveMode ? 'bg-emerald-500 animate-ping' : 'bg-indigo-500'}`} />
            <span className="text-[10px] text-slate-300 font-sans font-medium">
              {isLiveMode 
                ? (isEn ? 'Active Mic Array' : 'سنسور میکروفون فعال') 
                : (isEn ? 'Frequency Simulator' : 'شبیه‌ساز فرکانس مصنوعی')}
            </span>
          </div>
        </div>

        {/* Radar Map container */}
        <div 
          className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          <canvas ref={radarCanvasRef} className="w-full h-full block" />
          
          <div className="absolute top-4 left-4 bg-slate-950/90 border border-slate-800 p-3 rounded-xl max-w-[200px] pointer-events-none text-slate-300 space-y-2">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              {isEn ? 'Compass Legend Guide' : 'راهنمای سیستم جهت‌یاب'}
            </p>
            <div className="text-[10px] space-y-1 font-sans">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{isEn ? 'Altitude (Acoustics Pitch)' : 'ارتفاع (Pitch/زیروبمی صوتی)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>{isEn ? 'Azimuth Angle (L/R Balance)' : 'زاویه (اختلاف دامنه‌ کانال چپ/راست)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>{isEn ? 'Proximity (Amplitude Decibels)' : 'فاصله (بلندی و حجم صدا)'}</span>
              </div>
            </div>
          </div>

          {/* Quick instructions / Orbit drag hint */}
          <div className="absolute bottom-4 right-4 pointer-events-none bg-slate-950/70 border border-slate-800/60 px-3 py-1 rounded-md text-[10px] text-slate-400 font-sans">
            {isEn ? 'Orbit Angle: Drag mouse on map to rotate' : 'چرخش نقشه صوتی: چپ کِشیدن ماوس روی نقشه'}
          </div>
        </div>
      </div>

      {/* Simulator Emitters controllers sidebar */}
      {!isLiveMode ? (
        <div className="w-full lg:w-80 flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800 p-5 backdrop-blur-md">
          <div className="flex justify-between items-center mb-4">
            <h5 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Signal className="w-4 h-4 text-violet-400" />
              <span>{isEn ? 'Sound Source Orchestrator' : 'مدیریت چشمه‌های صوت'}</span>
            </h5>
          </div>

          {/* Preset quick spawners */}
          <p className="text-xs text-slate-400 mb-2 font-sans">
            {isEn ? 'Create quick sample sound sources:' : 'ایجاد سریع منابع صوتی نمونه:'}
          </p>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {generatorPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleCreatePreset(preset)}
                className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl text-center text-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer font-sans"
                title={`${isEn ? preset.nameEn : preset.name} - ${preset.hz}Hz`}
              >
                {preset.icon}
              </button>
            ))}
          </div>

          {/* Selected emitter controller card */}
          {selectedEmitter ? (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-950/40 rounded-xl border border-slate-800 p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="text-lg">{selectedEmitter.icon}</span>
                  <span className="text-xs font-bold font-sans line-clamp-1">
                    {isEn ? selectedEmitter.name : selectedEmitter.nameFa}
                  </span>
                </div>
                {emitters.length > 1 && (
                  <button
                    onClick={() => {
                      onRemoveEmitter(selectedEmitter.id);
                      const remaining = emitters.filter(e => e.id !== selectedEmitter.id);
                      if (remaining.length) setSelectedEmitterId(remaining[0].id);
                    }}
                    className="p-1 px-1.5 rounded-md hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Coordinates controllers scrollable */}
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {/* Frequency range */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] font-sans">
                    <span className="text-slate-400">{isEn ? 'Emitted Wave Frequency' : 'فرکانس صوت تولیدی'}</span>
                    <span className="font-mono text-cyan-400">{selectedEmitter.frequency} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="24000"
                    step="10"
                    value={selectedEmitter.frequency}
                    onChange={(e) => onUpdateEmitter(selectedEmitter.id, { frequency: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-sans">
                    <span>{isEn ? '10Hz (Deep Sub-bass)' : '10Hz (بم عمیق)'}</span>
                    <span>{isEn ? '24kHz (Ultrasound)' : '24kHz (فراصوت)'}</span>
                  </div>
                </div>

                {/* X Coordinate - Left / Right Direction */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] font-sans">
                    <span className="text-slate-400">{isEn ? 'Horizontal Position (X Offset)' : 'جهت افقی افست (L / R)'}</span>
                    <span className="font-mono text-cyan-400">X: {selectedEmitter.x.toFixed(0)}m</span>
                  </div>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={selectedEmitter.x}
                    onChange={(e) => onUpdateEmitter(selectedEmitter.id, { x: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-sans">
                    <span>{isEn ? '◄ Left (-120m)' : '◄ چپ (-120m)'}</span>
                    <span>{isEn ? 'Right (+120m) ►' : 'راست (+120m) ►'}</span>
                  </div>
                </div>

                {/* Y Coordinate - Height relative to ground */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] font-sans">
                    <span className="text-slate-400">{isEn ? 'Vertical Altitude (Y Offset)' : 'ارتفاع چشمه نسبت به زمین'}</span>
                    <span className="font-mono text-cyan-400">Y: {selectedEmitter.y.toFixed(0)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedEmitter.y}
                    onChange={(e) => onUpdateEmitter(selectedEmitter.id, { y: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-sans">
                    <span>{isEn ? 'Floor level (0m)' : 'روی زمین (0m)'}</span>
                    <span>{isEn ? 'High ceiling (100m)' : 'پرواز بالا (100m)'}</span>
                  </div>
                </div>

                {/* Z Coordinate - Depth */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] font-sans">
                    <span className="text-slate-400">{isEn ? 'Space Depth/Distance (Z-Axis)' : 'فاصله/عمق در اتاق (پیش/پس)'}</span>
                    <span className="font-mono text-cyan-400">Z: {selectedEmitter.z.toFixed(0)}m</span>
                  </div>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={selectedEmitter.z}
                    onChange={(e) => onUpdateEmitter(selectedEmitter.id, { z: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-sans">
                    <span>{isEn ? '◄ Front (North)' : '◄ جلو (شمال)'}</span>
                    <span>{isEn ? 'Back (South) ►' : 'عقب (جنوب) ►'}</span>
                  </div>
                </div>

                {/* Volume of Emitter */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] font-sans">
                    <span className="text-slate-400">{isEn ? 'Speaker Volume Amplitude' : 'شدت صوت (ولوم اسپیکر)'}</span>
                    <span className="font-mono text-cyan-400">{selectedEmitter.volume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedEmitter.volume}
                    onChange={(e) => onUpdateEmitter(selectedEmitter.id, { volume: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded appearance-none accent-violet-500"
                  />
                </div>
              </div>

              {/* Mini descriptive help */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 text-[10px] text-slate-400 leading-normal font-sans">
                {isEn 
                  ? '🛡️ In this simulator, repositioning emitters shifts stereo balances. As distance scales farther outward, acoustic decibels decay based on atmospheric absorption curves.'
                  : '🛡️ در این شبیه‌ساز، هرچه منبع صوتی را به چپ یا راست نزدیک کنید، شدت توازن استریو در میکروفون تغییر کرده و با افزایش فاصله، حجم کلی افت می‌کند.'}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800 rounded-xl p-4 text-center">
              <span className="text-xs text-slate-500">
                {isEn ? 'No sound source selected' : 'هیچ منبعی صوتی انتخاب نشده است'}
              </span>
            </div>
          )}

          {/* List of active emitters selectors */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-400 mb-2 font-sans">
              {isEn ? 'Other active sound emitters:' : 'سایر منابع صوتی در فضا:'}
            </p>
            <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto pr-1">
              {emitters.map(e => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEmitterId(e.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 font-sans transition-all cursor-pointer ${e.id === selectedEmitterId ? 'bg-violet-600 border-violet-500 text-white shadow-md' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                >
                  <span>{e.icon}</span>
                  <span className="text-[10px] line-clamp-1">{isEn ? e.name : e.nameFa}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full lg:w-80 flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800 p-5 backdrop-blur-md">
          <h5 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3 font-sans">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>{isEn ? 'Real Environment Parameters' : 'شاخص‌های محیط واقعی'}</span>
          </h5>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
            {isEn 
              ? 'Using real microphone input feeds, the DSP model instantaneously maps stereo arrival balance, dBFS volume, and the dominant spectral peak:'
              : 'در محدوده میکروفون واقعی، سیستم به صورت هوشمند زوایای اختلاف استریو، بلندی موج و نقطه اوج فرکانسی محیط را لحظه‌ای آنالیز می‌کند:'}
          </p>

          <div className="space-y-4 flex-1">
            {/* Live Pan slider visually indicating L/R balanced */}
            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between text-xs text-slate-300 mb-2 font-sans">
                <span>{isEn ? 'Stereo Dynamic Balance (Pan)' : 'تعادل جهت افقی (Pan)'}</span>
                <span className="font-mono text-emerald-400">
                  {livePan === 0 
                    ? (isEn ? 'Center' : 'مرکز') 
                    : livePan > 0 
                      ? `${(livePan*100).toFixed(0)}% ${isEn ? 'Right' : 'راست'}` 
                      : `${(Math.abs(livePan)*100).toFixed(0)}% ${isEn ? 'Left' : 'چپ'}`}
                </span>
              </div>
              {/* slider indicator tracking livePan */}
              <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden flex items-center">
                <div className="absolute left-[50%] -translate-x-[50%] w-0.5 h-full bg-slate-600 z-10" />
                <div 
                  className="absolute h-full bg-emerald-500/80 transition-all duration-75"
                  style={{
                    left: livePan >= 0 ? '50%' : 'auto',
                    right: livePan < 0 ? '50%' : 'auto',
                    width: `${Math.abs(livePan) * 50}%`
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-1 uppercase font-mono">
                <span>Left CH</span>
                <span>Right CH</span>
              </div>
            </div>

            {/* Estimated distance indicator */}
            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-sans">
                <span>{isEn ? 'Estimated Proximity' : 'تخمین فاصله تا حسگر'}</span>
                <span className="font-mono text-emerald-400">~{liveDistance.toFixed(0)}m</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-100"
                  style={{ width: `${Math.max(5, Math.min(100, 100 - liveDistance))}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal font-sans">
                {liveDistance < 30 
                  ? (isEn ? '🔥 High acoustic intensity close to sensor' : '🔥 صوتی در نزدیکی حسگر') 
                  : (isEn ? '🌀 Distant or ambient low-intensity sound waves' : '🌀 فاصله دور یا ممتد صوتی')}
              </p>
            </div>

            {/* Estimated Altitude height indicator */}
            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-sans">
                <span>{isEn ? 'Estimated Altitude (Pitch Index)' : 'تخمین ارتفاع (Pitch Index)'}</span>
                <span className="font-mono text-emerald-400">{Math.round(liveHeight)}m</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-100"
                  style={{ width: `${Math.min(100, Math.max(0, (liveHeight + 100) / 2))}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal font-sans">
                {isEn 
                  ? 'Spectral centroids with higher frequency averages translate to higher vertical positioning indices.'
                  : 'معدل فرکانس‌های زیرتر صوتی ارتفاع مرتفع را تداعی می‌کند.'}
              </p>
            </div>
            
            {/* Live Metrics readout banner */}
            <div className="bg-emerald-950/10 border border-emerald-900/30 p-3.5 rounded-xl text-slate-300 text-xs flex gap-2 items-start font-sans">
              <Signal className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-emerald-400">{isEn ? 'Sensory Decibel & Peak Analysis' : 'آنالیز دسی‌بل حسگر'}</p>
                <div className="grid grid-cols-2 gap-x-4 text-[11px] text-slate-400 font-mono">
                  <span>Peak: {Math.round(livePeakFreq)} Hz</span>
                  <span>dBFS: -{(Math.max(0, 120 - liveVolume * 120)).toFixed(1)} dB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
