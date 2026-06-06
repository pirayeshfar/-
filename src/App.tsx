import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Volume2, 
  Activity, 
  Cpu, 
  Compass, 
  Layers, 
  Play, 
  VolumeX, 
  HelpCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { SoundEmitter, FrequencyBandType, FREQUENCY_BANDS } from './types';
import ThreeDWaterfall from './components/ThreeDWaterfall';
import SoundRadar3D from './components/SoundRadar3D';
import BandClassifier from './components/BandClassifier';
import AiAcousticExpert from './components/AiAcousticExpert';

export default function App() {
  // Mode selection: true = real microphone, false = 3D Space Simulator
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [micActive, setMicActive] = useState<boolean>(false);

  // Web Audio Context refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Stereo analysers for live tracking
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const mainAnalyserRef = useRef<AnalyserNode | null>(null); // merged / mono fallback for waterfall

  // Live indicators
  const [livePeakFreq, setLivePeakFreq] = useState<number>(0);
  const [liveAvgFreq, setLiveAvgFreq] = useState<number>(0);
  const [liveVolume, setLiveVolume] = useState<number>(0); // 0 to 1 scaling
  const [livePan, setLivePan] = useState<number>(0); // -1 (Left) to 1 (Right)
  const [liveDistance, setLiveDistance] = useState<number>(10); // Volume maps to distance
  const [liveHeight, setLiveHeight] = useState<number>(0); // spectral centroid based

  const [activeBand, setActiveBand] = useState<FrequencyBandType>('human-mid');
  const [bandAmplitudes, setBandAmplitudes] = useState<Record<FrequencyBandType, number>>({
    'infrasound': 0.01,
    'human-bass': 0.05,
    'human-mid': 0.02,
    'human-high': 0.01,
    'ultrasound': 0.00
  });

  // Simulator mode Emitters state
  const [emitters, setEmitters] = useState<SoundEmitter[]>([
    {
      id: 'emitter-1',
      name: 'سیگنال فروصوت زمین‌لرزه',
      nameFa: 'سیگنال فروصوت زمین‌لرزه',
      type: 'infrasound',
      frequency: 14,
      volume: 80,
      x: -50,
      y: 2, // low on floor
      z: 80, // far back
      icon: '🌋',
      description: 'امواج فرکانس عمیق تکتونیکی ناشی از لرزش لایه‌های زمین',
      descriptionFa: 'امواج فرکانس عمیق تکتونیکی ناشی از لرزش لایه‌های زمین'
    },
    {
      id: 'emitter-2',
      name: 'مکالمه آواز انسان (میانه)',
      nameFa: 'مکالمه آواز انسان (میانه)',
      type: 'human-mid',
      frequency: 620,
      volume: 75,
      x: 45,
      y: 12, // standing height
      z: 30, // medium close
      icon: '🗣️',
      description: 'امواج صوتی گفتاری انسان فرکانس میانه',
      descriptionFa: 'امواج صوتی گفتاری انسان فرکانس میانه'
    },
    {
      id: 'emitter-3',
      name: 'ردیابی فراصوت خفاش',
      nameFa: 'ردیابی فراصوت خفاش',
      type: 'ultrasound',
      frequency: 22800,
      volume: 90,
      x: -35,
      y: 65, // flying very high
      z: -40, // close front
      icon: '🦇',
      description: 'سیگنال رفلکس پیزوالکتریک بیولوژیکی جهت‌یابی خفاش',
      descriptionFa: 'سیگنال رفلکس پیزوالکتریک بیولوژیکی جهت‌یابی خفاش'
    }
  ]);

  // Buffer generated for the 3D spectrogram waterfall during simulation mode
  const [simulatedBuffer, setSimulatedBuffer] = useState<Uint8Array | null>(null);

  // UTC clock display
  const [utcTime, setUtcTime] = useState<string>('2026-06-06 17:44:28');

  // Trigger clock ticker
  useEffect(() => {
    const clockTimer = setInterval(() => {
      const now = new Date();
      const pad = (num: number) => String(num).padStart(2, '0');
      const formatted = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
      setUtcTime(formatted);
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Update specific emitter details
  const handleUpdateEmitter = (id: string, updated: Partial<SoundEmitter>) => {
    setEmitters(prev => prev.map(emitter => {
      if (emitter.id === id) {
        const merged = { ...emitter, ...updated };
        // auto-adjust category type based on Frequency
        let type: FrequencyBandType = 'human-mid';
        if (merged.frequency < 20) type = 'infrasound';
        else if (merged.frequency < 250) type = 'human-bass';
        else if (merged.frequency < 4000) type = 'human-mid';
        else if (merged.frequency < 20000) type = 'human-high';
        else type = 'ultrasound';
        return { ...merged, type };
      }
      return emitter;
    }));
  };

  // Add Emitter
  const handleAddEmitter = (newEmitter: SoundEmitter) => {
    setEmitters(prev => [...prev, newEmitter]);
  };

  // Remove Emitter
  const handleRemoveEmitter = (id: string) => {
    setEmitters(prev => prev.filter(e => e.id !== id));
  };

  // ACTIVATE OR DEACTIVATE MICROPHONE WITH SAFETY USER INTERACTION PATTERN
  const toggleMicrophone = async () => {
    if (micActive) {
      // Turn OFF
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setMicActive(false);
      return;
    }

    try {
      // Initialize Audio Context on user click gesture
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Request micro check
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      streamRef.current = stream;
      
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Create main/fallback mono analyzer for general spectrum & waterfall
      const mainAnalyser = audioCtx.createAnalyser();
      mainAnalyser.fftSize = 1024;
      mainAnalyser.smoothingTimeConstant = 0.75;
      source.connect(mainAnalyser);
      mainAnalyserRef.current = mainAnalyser;

      // Try stereo channel separation for directional sound angle estimation!
      try {
        const channelCount = source.channelCount;
        console.log(`Input microphone channel count: ${channelCount}`);
        
        const splitter = audioCtx.createChannelSplitter(2);
        
        const analyserL = audioCtx.createAnalyser();
        analyserL.fftSize = 512;
        const analyserR = audioCtx.createAnalyser();
        analyserR.fftSize = 512;

        source.connect(splitter);
        // Connect outputs
        splitter.connect(analyserL, 0, 0);
        // Fallback or connect second output channel
        if (channelCount >= 2) {
          splitter.connect(analyserR, 1, 0);
        } else {
          // If mono hardware force connect same to avoid crashes
          splitter.connect(analyserR, 0, 0);
        }

        analyserLRef.current = analyserL;
        analyserRRef.current = analyserR;
      } catch (err) {
        console.warn("Advanced stereo splitter not fully supported on this hardware. Falling back to simulated stereo direction tracking.", err);
        analyserLRef.current = mainAnalyser;
        analyserRRef.current = mainAnalyser;
      }

      setMicActive(true);
      setIsLiveMode(true); // switch to live mode automatically
    } catch (error: any) {
      console.error("Microphone Capture Denied/Error:", error);
      alert("⚠️ مجوز میکروفون دریافت نشد یا این مرورگر از دسترسی صوتی در فریم پشتیبانی نمی‌کند. در صورتی که دکمه پاپ‌آپ مسدودسازی فعال است، لطفاً مجوز را صادر کنید.");
    }
  };

  // LIVE MICROPHONE ANALYSER RECURRING DATA TICKER
  useEffect(() => {
    let animId: number;
    const bufferSize = 512;
    const byteData = new Uint8Array(bufferSize);

    const updateLiveMetrics = () => {
      if (isLiveMode && micActive && mainAnalyserRef.current && audioCtxRef.current) {
        const analyser = mainAnalyserRef.current;
        const sampleRate = audioCtxRef.current.sampleRate;
        const binCount = analyser.frequencyBinCount;
        
        const freqData = new Uint8Array(binCount);
        analyser.getByteFrequencyData(freqData);

        // 1. SOLVE FOR PEAK FREQUENCY (Hz)
        let maxVal = -1;
        let peakIdx = 0;
        for (let i = 0; i < binCount; i++) {
          if (freqData[i] > maxVal) {
            maxVal = freqData[i];
            peakIdx = i;
          }
        }
        const peakHz = (peakIdx * (sampleRate / 2)) / binCount;
        setLivePeakFreq(peakHz || 0);

        // 2. SOLVE FOR AVERAGE FREQUENCY / SPECTRAL CENTROID
        let totalAmp = 0;
        let weightedSum = 0;
        let volumeSum = 0;

        for (let i = 0; i < binCount; i++) {
          const amp = freqData[i] / 255.0;
          const currentHz = (i * (sampleRate / 2)) / binCount;
          totalAmp += amp;
          weightedSum += amp * currentHz;
          volumeSum += freqData[i];
        }

        const avgHz = totalAmp > 0 ? weightedSum / totalAmp : 0;
        setLiveAvgFreq(avgHz);

        // Standard Relative volume loudness db
        const avgVol = volumeSum / binCount / 255.0; // scale 0 to 1
        setLiveVolume(avgVol);

        // Volume maps inverse to distance
        // Low sound = far, Loud sound = very close
        const computedDist = Math.max(3, Math.min(100, 100 - avgVol * 95));
        setLiveDistance(computedDist);

        // centroid height mapping index
        const computedHeight = ((avgHz / 12000) - 0.5) * 160; // scale to -80 .. 80 relative coords
        setLiveHeight(computedHeight);

        // 3. STEREO PAN ANALYSIS
        if (analyserLRef.current && analyserRRef.current) {
          const freqL = new Uint8Array(analyserLRef.current.frequencyBinCount);
          const freqR = new Uint8Array(analyserRRef.current.frequencyBinCount);
          analyserLRef.current.getByteFrequencyData(freqL);
          analyserRRef.current.getByteFrequencyData(freqR);

          let sumL = 0;
          let sumR = 0;
          for (let i = 0; i < freqL.length; i++) {
            sumL += freqL[i];
            sumR += freqR[i];
          }

          // Balance formula
          const diff = sumL - sumR;
          const sumTotal = sumL + sumR || 1;
          const panRatio = diff / sumTotal; // will be in -1 to 1 space
          
          // Smoothen live pan output
          setLivePan(prev => prev * 0.75 + panRatio * 0.25);
        }

        // 4. CATEGORIZE ACTIVE BAND
        let dominantBand: FrequencyBandType = 'human-mid';
        if (peakHz < 20) dominantBand = 'infrasound';
        else if (peakHz < 250) dominantBand = 'human-bass';
        else if (peakHz < 4000) dominantBand = 'human-mid';
        else if (peakHz < 20000) dominantBand = 'human-high';
        else dominantBand = 'ultrasound';
        setActiveBand(dominantBand);

        // Extract bands metrics
        const bandsAmps: Record<FrequencyBandType, number> = {
          'infrasound': 0, 'human-bass': 0, 'human-mid': 0, 'human-high': 0, 'ultrasound': 0
        };

        const binWidth = (sampleRate / 2) / binCount;
        for (let i = 0; i < binCount; i++) {
          const currentHz = i * binWidth;
          const amp = freqData[i] / 255.0;

          if (currentHz < 20) bandsAmps.infrasound += amp;
          else if (currentHz < 250) bandsAmps['human-bass'] += amp;
          else if (currentHz < 4000) bandsAmps['human-mid'] += amp;
          else if (currentHz < 20000) bandsAmps['human-high'] += amp;
          else bandsAmps.ultrasound += amp;
        }

        // Normalize band amplitudes
        setBandAmplitudes({
          infrasound: Math.min(1.0, bandsAmps.infrasound / 4 || 0),
          'human-bass': Math.min(1.0, bandsAmps['human-bass'] / 15 || 0),
          'human-mid': Math.min(1.0, bandsAmps['human-mid'] / 60 || 0),
          'human-high': Math.min(1.0, bandsAmps['human-high'] / 40 || 0),
          'ultrasound': Math.min(1.0, bandsAmps.ultrasound / 15 || 0)
        });
      }

      animId = requestAnimationFrame(updateLiveMetrics);
    };

    updateLiveMetrics();
    return () => cancelAnimationFrame(animId);
  }, [isLiveMode, micActive]);

  // SIMULATION GENERATOR ENGINE
  // Creates synthetic frequency values on simulatedBuffer corresponding with emitter coordinates and velocities
  useEffect(() => {
    if (isLiveMode) return; // ignore if microphone is taking priority

    let animId: number;
    const simulatedResolution = 256; // matches 3D Spectrograph waterfall cells count
    const mockBuffer = new Uint8Array(simulatedResolution);

    let phaseOffset = 0;

    const generateSimulationFrequencies = () => {
      phaseOffset += 0.08;

      // Reset base background noise
      for (let i = 0; i < simulatedResolution; i++) {
        mockBuffer[i] = 10 + Math.random() * 8; // flat quiet noise floor
      }

      const activeBandStrengths: Record<FrequencyBandType, number> = {
        'infrasound': 0.01,
        'human-bass': 0.01,
        'human-mid': 0.01,
        'human-high': 0.01,
        'ultrasound': 0.01
      };

      // Loop through all placed emitters and superpose their frequencies onto the spectrograph buffer
      emitters.forEach((emitter) => {
        const volumeScaling = emitter.volume / 100.0;
        
        // Dynamic distance of sound emitter relative to the listener (origin 0,0,0)
        const emitterDist = Math.sqrt(emitter.x * emitter.x + emitter.y * emitter.y + emitter.z * emitter.z);

        // 1. PHYSICAL DISPERSION ATTENUATION
        // Inverse square simulation
        const distancePower = 1.0 / (1.0 + emitterDist * 0.018);
        
        // 2. ATMOSPHERIC ABSORPTION COEFFICIENT (High frequencies attenuate faster!)
        // Low sounds pierce easily, high sounds degrade aggressively with distance
        const frequencyAbsorptionFactor = Math.exp(-0.00015 * emitter.frequency * (emitterDist / 100.0));

        const netAmplitude = volumeScaling * distancePower * frequencyAbsorptionFactor * 240;

        if (netAmplitude < 1.0) return; // skip dead emitters

        // Translate the HZ frequency into an index inside the simulatedBuffer cells (0Hz to 24000Hz range)
        const hzPerBin = 24000 / simulatedResolution;
        const targetBinIdx = Math.max(0, Math.min(simulatedResolution - 1, Math.floor(emitter.frequency / hzPerBin)));

        // Superpose wave crest around the center frequency with standard Gaussian dispersion width
        const gaussianWidth = Math.max(1.5, Math.min(8.0, (emitter.frequency / 5000) * 4.0)); // higher sounds spread slightly broader

        for (let bin = 0; bin < simulatedResolution; bin++) {
          const distFromPeak = Math.abs(bin - targetBinIdx);
          // Gaussian function
          const impulse = Math.exp(-0.5 * Math.pow(distFromPeak / gaussianWidth, 2));
          
          // Apply time oscillating wave crest representing dynamic oscillation phase
          const wavePhaseOscillation = 0.85 + Math.sin(phaseOffset + emitter.frequency * 0.005) * 0.15;

          const addedValue = netAmplitude * impulse * wavePhaseOscillation;
          mockBuffer[bin] = Math.min(255, mockBuffer[bin] + addedValue);
        }

        // Add to categorized live band strengths
        activeBandStrengths[emitter.type] = Math.max(
          activeBandStrengths[emitter.type], 
          Math.min(1.0, (netAmplitude / 240) * 1.5)
        );
      });

      // Update simulated state
      setSimulatedBuffer(new Uint8Array(mockBuffer));

      // Calculate active emitter values for panel outputs
      setBandAmplitudes(activeBandStrengths);

      // Solve dominant active emitter
      let primaryEmitter = emitters[0];
      let maxPower = -1;
      emitters.forEach(e => {
        const d = Math.sqrt(e.x*e.x + e.y*e.y + e.z*e.z);
        const power = e.volume * (1 / (1 + d * 0.01));
        if (power > maxPower) {
          maxPower = power;
          primaryEmitter = e;
        }
      });

      if (primaryEmitter) {
        setLivePeakFreq(primaryEmitter.frequency);
        setLiveAvgFreq(primaryEmitter.frequency * 0.95);
        setLiveVolume(maxPower / 100.0);
        setActiveBand(primaryEmitter.type);
      }

      animId = requestAnimationFrame(generateSimulationFrequencies);
    };

    generateSimulationFrequencies();

    return () => cancelAnimationFrame(animId);
  }, [emitters, isLiveMode]);

  const currentDominantBand = FREQUENCY_BANDS[activeBand];

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* Premium Header Navigation conforming to Sophisticated Dark */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0a0a] sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          </div>
          <div className="text-right md:text-left">
            <h1 className="text-sm md:text-base font-semibold tracking-tight uppercase text-white/95 flex items-center gap-2">
              <span>جهت‌یاب سه‌بعدی و آنالیزور آکوستیک</span>
              <span className="text-blue-500 font-mono tracking-widest text-xs">X-360</span>
            </h1>
            <p className="hidden md:block text-[10px] text-white/40 font-mono">Real-time 3D triangulation based on Lidar & Mic Array</p>
          </div>
        </div>

        {/* Toggle modes */}
        <div className="flex items-center gap-3 bg-black/60 px-2.5 py-1 rounded-full border border-white/10">
          <button
            onClick={() => setIsLiveMode(false)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${!isLiveMode ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400' : 'text-white/40 hover:text-white'}`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>شبیه‌ساز فضا</span>
          </button>
          <button
            onClick={() => {
              if (!micActive) {
                toggleMicrophone();
              } else {
                setIsLiveMode(true);
              }
            }}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${isLiveMode ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 glow-emerald' : 'text-white/40 hover:text-white'}`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>سنسور زنده میکروفون</span>
          </button>
        </div>

        {/* Status logs */}
        <div className="hidden lg:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${micActive ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`}></span>
            <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
              Mic: {micActive ? 'Active' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${!isLiveMode ? 'bg-blue-500' : 'bg-white/20'}`}></span>
            <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
              Simulator: {!isLiveMode ? 'Linked' : 'Inert'}
            </span>
          </div>
          <div className="h-4 w-px bg-white/20"></div>
          <div className="flex items-center gap-2.5 text-[11px] text-white/40 font-mono">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>{utcTime}</span>
          </div>
        </div>
      </header>

      {/* Primary Application Workspace */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex-1 w-full space-y-6">
        
        {/* Dynamic Mode Notification banner */}
        {!micActive && isLiveMode && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 rounded-xl font-sans flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-amber-400 shrink-0" />
              <span>سنسور میکروفون به علت عدم برقراری مجوز مرورگر غیرفعال است. لطفاً جهت استفاده، دکمه روبرو را کلیک کنید:</span>
            </div>
            <button
              onClick={toggleMicrophone}
              className="px-3.5 py-1.5 bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all rounded-lg shrink-0 cursor-pointer"
            >
              اجازه دسترسی صوتی
            </button>
          </div>
        )}

        {/* TOP LEVEL DUAL GRID: 3D Spectrograph & Stereo Dome Radar */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          
          {/* A: Left side: Dynamic 3D Waterfall Canvas spectrograph */}
          <div className="h-[480px]">
            <ThreeDWaterfall
              analyserNode={isLiveMode && micActive ? mainAnalyserRef.current : null}
              audioCtx={audioCtxRef.current}
              simulatedBuffer={!isLiveMode ? simulatedBuffer : null}
              themeColor={currentDominantBand.color}
            />
          </div>

          {/* B: Right side: Sound locator 3D Radar mapping & Sim tools */}
          <div className="h-[480px]">
            <SoundRadar3D
              emitters={emitters}
              onUpdateEmitter={handleUpdateEmitter}
              onAddEmitter={handleAddEmitter}
              onRemoveEmitter={handleRemoveEmitter}
              isLiveMode={isLiveMode}
              livePan={livePan}
              liveDistance={liveDistance}
              liveHeight={liveHeight}
              liveVolume={liveVolume}
              livePeakFreq={livePeakFreq}
            />
          </div>
        </div>

        {/* MID LEVEL DUAL GRID: Bands metrics classifier dashboard & AI diagnosis panel */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          
          {/* Multi-frequency bands category cards (Takes 2/3 space on desktop) */}
          <div className="xl:col-span-2">
            <BandClassifier
              bandAmplitudes={bandAmplitudes}
              activeBand={activeBand}
            />
          </div>

          {/* Acoustic Artificial intelligence helper (Takes 1/3 space on desktop) */}
          <div className="xl:col-span-1">
            <AiAcousticExpert
              currentPeakHz={livePeakFreq}
              currentAvgHz={liveAvgFreq}
              currentVolumeDb={liveVolume}
              currentBand={currentDominantBand.name}
              currentBandFa={currentDominantBand.nameFa}
              isLiveMode={isLiveMode}
            />
          </div>
        </div>

        {/* Extra informative Persian guidelines panel / user checklist */}
        <div className="p-5 bg-[#0a0a0a] border border-white/10 rounded-2xl flex flex-col md:flex-row gap-5 items-start font-sans">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20 shrink-0">
            <Mic className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1.5 flex-1 leading-relaxed text-right md:text-left">
            <h5 className="text-sm font-bold text-white/90">💡 راهنمای کاربری و آزمایش‌های جذاب آکوستیک</h5>
            <div className="text-xs text-white/60 space-y-1.5 my-2">
              <p>• <b>آزمایش اول (فروصوت):</b> حالت شبیه‌ساز را فعال کنید، چشمه صوتی زلزله را با فرکانس ۱۴ هرتز بردارید و فاصله آن را تغییر دهید. می‌بینید که به‌دلیل طول‌موج بلند، افت فرکانسی در جو صورت نمی‌گیرد و ارتفاع موج سه‌بعدی به نرمی کاهش می‌یابد.</p>
              <p>• <b>آزمایش دوم (فراصوت):</b> پشه را با فرکانس ۱۷ کیلوهرتز لود کنید و فاصله Z آن را عقب ببرید. شاهد افت بسیار تیز ارتفاع قله‌ها به دلیل جذب ممتد هوا (Atmospheric Dampening) خواهید بود.</p>
              <p>• <b>آزمایش سوم (میکروفون واقعی):</b> حالت میکروفون را فعال کرده و فوت خفیفی به کپسول سمت چپ یا راست لپ‌تاپ بکنید؛ سیستم بلافاصله توازن را آنالیز کرده و جهت صدا را بر روی مدار رادار ۳بعدی علامت‌گذاری خواهد کرد!</p>
            </div>
          </div>
        </div>

      </main>

      {/* Cozy humble footer conforming to Sophisticated Dark */}
      <footer className="h-14 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between px-6 bg-[#0a0a0a] text-[10px] font-sans text-white/40 mt-auto gap-4 py-3 sm:py-0 w-full max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-4 sm:gap-6 justify-center sm:justify-start font-mono text-[9px]">
          <span>SAMPLING: 192kHz / 32-BIT</span>
          <span>|</span>
          <span>BUFFER: 512 SAMPLES</span>
          <span>|</span>
          <span>LATENCY: 4.2ms</span>
          <span className="hidden md:inline">| © 2026 AuraAcoustic Engine</span>
        </div>
        <div className="flex gap-4 items-center justify-center sm:justify-end flex-wrap">
          <span className="text-white/60 text-[11px]">ایده‌پرداز و طراح: <strong className="text-white/80 font-bold">امیرسامان پیرایش فر</strong></span>
          <span className="text-white/20">|</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> SYSTEM READY</span>
          <span className="text-white/20">|</span>
          <span className="font-mono">V1.4.0-CORE</span>
        </div>
      </footer>
    </div>
  );
}
