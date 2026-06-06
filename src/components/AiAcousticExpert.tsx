import React, { useState } from 'react';
import { Sparkles, Brain, Cpu, Send, RefreshCw, AlertTriangle, MessageSquare, Headphones } from 'lucide-react';
import { AcousticSnapshot } from '../types';

interface AiAcousticExpertProps {
  currentPeakHz: number;
  currentAvgHz: number;
  currentVolumeDb: number;
  currentBand: string;
  currentBandFa: string;
  isLiveMode: boolean;
}

export default function AiAcousticExpert({
  currentPeakHz,
  currentAvgHz,
  currentVolumeDb,
  currentBand,
  currentBandFa,
  isLiveMode,
}: AiAcousticExpertProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chatPrompt, setChatPrompt] = useState('');
  const [capturedSnapshot, setCapturedSnapshot] = useState<AcousticSnapshot | null>(null);

  const captureAcoustics = () => {
    // Determine profile text based on frequency
    let profile = 'ممتد، یکنواخت';
    let profileEn = 'flat, continuous';
    if (currentPeakHz < 200 && currentVolumeDb > 0.1) {
      profile = 'پالس بم، زمزمه فرکانس پایین';
      profileEn = 'low-frequency hum, deep rumble';
    } else if (currentPeakHz > 12000) {
      profile = 'تیز، سوزنی با نوسان شدید بالارده';
      profileEn = 'sharp peak, extreme high presence';
    } else if (currentAvgHz > 300 && currentAvgHz < 3400) {
      profile = 'منطبق بر ساختار گفتاری انسان';
      profileEn = 'speech-like, mid-range complex profile';
    }

    const snap: AcousticSnapshot = {
      peakHz: Math.round(currentPeakHz),
      avgHz: Math.round(currentAvgHz),
      volumeDb: Math.round(currentVolumeDb * 100), // scale to relative % units
      band: currentBand,
      bandFa: currentBandFa,
      profile: profileEn,
      profileFa: profile,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
    };
    setCapturedSnapshot(snap);
    setAnalysisResult(null);
    setErrorMsg(null);
  };

  const handleAiAnalyze = async () => {
    const snap = capturedSnapshot || {
      peakHz: Math.round(currentPeakHz),
      avgHz: Math.round(currentAvgHz),
      volumeDb: Math.round(currentVolumeDb * 100),
      band: currentBand,
      bandFa: currentBandFa,
      profile: 'flat ambient noise',
      profileFa: 'نویز پراکنده محیطی',
      timestamp: new Date().toLocaleTimeString('fa-IR'),
    };

    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/analyze-acoustics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peakHz: snap.peakHz,
          avgHz: snap.avgHz,
          volumeDb: snap.volumeDb,
          band: snap.band,
          profile: snap.profile,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAnalysisResult(data.text);
      } else {
        setErrorMsg(data.error || 'ارتباط با سرور امکان‌پذیر نبود.');
      }
    } catch (err: any) {
      console.error('API Error:', err);
      setErrorMsg('کارت اتصال شبکه قطع شد یا خطایی در سرور رخ داد. لطفا دوباره تلاش کنید.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Safe manual markdown parser to convert standard bullets, headers and bold formatting to styled JSX blocks
  const renderParsedAiResponse = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Is clean heading
      if (line.startsWith('### ')) {
        return (
          <h5 key={idx} className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-4 mb-2 font-sans text-right border-r-2 border-indigo-500 pr-2 pb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{line.replace('### ', '').trim()}</span>
          </h5>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h4 key={idx} className="text-base font-bold text-slate-100 mt-5 mb-2.5 font-sans text-right border-r-4 border-indigo-500 pr-2.5 pb-1 bg-slate-950/40 py-1 rounded-l-md">
            <span>{line.replace('## ', '').trim()}</span>
          </h4>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h3 key={idx} className="text-lg font-bold text-[#fafafa] mt-6 mb-3 font-sans text-right">
            {line.replace('# ', '').trim()}
          </h3>
        );
      }
      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const cleanContent = line.replace(/^[\s*-]+/, '').trim();
        return (
          <li key={idx} className="text-xs text-slate-300 leading-relaxed font-sans mr-4 mb-1.5 list-disc text-right">
            {parseInlineStyling(cleanContent)}
          </li>
        );
      }
      
      // Standard line
      if (line.trim() === '') return <div key={idx} className="h-2" />;

      return (
        <p key={idx} className="text-xs text-slate-300 leading-relaxed font-sans mb-3 text-right">
          {parseInlineStyling(line)}
        </p>
      );
    });
  };

  // Support inline bold **text** parsing
  const parseInlineStyling = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-indigo-300">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 backdrop-blur-md flex flex-col h-full">
      {/* Header Info */}
      <div className="flex items-center gap-3 mb-4.5">
        <span className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
          <Brain className="w-5 h-5 animate-pulse" />
        </span>
        <div>
          <h4 className="font-sans font-bold text-slate-100 flex items-center gap-2">
            <span>تحلیلگر آکوستیک هوشمند (جمینی AI)</span>
            <span className="text-xs text-indigo-400 font-mono">Gemini Acoustic Intelligence</span>
          </h4>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            استفاده از مدل زبانه هوشمند برای تشخیص چشمه‌های صوتی، بررسی فرکانس‌های مخفی و علم فیزیک صوتی
          </p>
        </div>
      </div>

      {/* Snapshot panel capturing */}
      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-850/80 mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] text-slate-400 font-mono uppercase tracking-wider mb-2 font-bold">ارقام طیفی لحظه‌ای</p>
          <div className="space-y-1.5 text-xs text-slate-300 font-sans">
            <div className="flex justify-between border-b border-slate-900 pb-1">
              <span>نقطه اوج فرکانسی (Peak)</span>
              <span className="font-mono text-cyan-400">{Math.round(currentPeakHz)} Hz</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-1">
              <span>میانگین فرکانسی (Avg)</span>
              <span className="font-mono text-cyan-400">{Math.round(currentAvgHz)} Hz</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-1">
              <span>رده‌بندی فیزیکی</span>
              <span className="text-indigo-400 font-bold">{currentBandFa}</span>
            </div>
          </div>

          <button
            onClick={captureAcoustics}
            className="w-full mt-3 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[11px] text-indigo-300 font-medium rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>ثبت و ذخیره این اثر آکوستیک</span>
          </button>
        </div>

        {/* Display captured snapshot metadata */}
        <div className="border hover:border-indigo-500/35 border-slate-850 bg-slate-950 p-3 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-slate-400 font-sans">اثر صوتی ذخیره شده برای ارسال:</span>
              <span className="text-[9px] text-[#fafafa] font-mono bg-slate-900 px-1 py-0.5 rounded">
                {capturedSnapshot ? 'موجود' : 'خالی'}
              </span>
            </div>
            {capturedSnapshot ? (
              <div className="space-y-1 text-xs">
                <p className="text-slate-100 font-bold text-right font-sans">
                  فرکانس: <span className="font-mono text-indigo-400">{capturedSnapshot.peakHz}Hz</span> ({capturedSnapshot.bandFa})
                </p>
                <p className="text-slate-400 text-right text-[11px] leading-relaxed font-sans">
                  مشخصه موج: <span className="text-indigo-300">{capturedSnapshot.profileFa}</span>
                </p>
                <p className="text-[10px] text-slate-500 text-right mt-1 font-mono">ساعت نمونه: {capturedSnapshot.timestamp}</p>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center py-4 text-center">
                <span className="text-[10px] text-slate-500 font-sans">برای آغاز فرآیند، دکمه چپ را بزنید</span>
              </div>
            )}
          </div>

          {capturedSnapshot && (
            <button
              onClick={handleAiAnalyze}
              disabled={isAnalyzing}
              className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-xs text-white font-bold rounded-lg shadow-lg shadow-indigo-600/15 transition-all flex items-center justify-center gap-2"
            >
              <Cpu className="w-3.5 h-3.5 animate-spin-slow" />
              <span>ارسال ارقام طیف به جمینی AI</span>
            </button>
          )}
        </div>
      </div>

      {/* Results viewport Container */}
      <div className="flex-1 min-h-[220px] bg-slate-950/80 rounded-xl border border-slate-850 p-4.5 overflow-y-auto max-h-[380px]">
        {isAnalyzing ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="relative">
              <span className="absolute animate-ping inline-flex h-10 w-10 rounded-full bg-indigo-400 opacity-20" />
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                <Brain className="w-5 h-5 animate-spin-slow" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-slate-200 font-bold font-sans">در حال بررسی اثر صوتی توسط جمینی...</p>
              <p className="text-[10px] text-slate-400 font-sans">
                سیگنال فرکانس {capturedSnapshot?.peakHz}Hz در حال تطبیق با مراجع فیزیکی و رفتارهای زیستی حیوانات است.
              </p>
            </div>
          </div>
        ) : errorMsg ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
            <p className="text-xs text-slate-300 font-medium font-sans mb-1">{errorMsg}</p>
            <p className="text-[10px] text-slate-500 font-sans">
              اطمینان حاصل کنید که اینترنت متصل است و توکن `GEMINI_API_KEY` در زبانه Secrets به درستی تنظیم شده است.
            </p>
          </div>
        ) : analysisResult ? (
          <div className="space-y-3">
            {/* Success indicator banner */}
            <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
              <span className="text-[10px] text-slate-400 font-mono">پاسخ دریافتی از جمینی ۳.۵</span>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>تحلیل آکوستیک تکمیل شد</span>
              </div>
            </div>
            <div className="space-y-2">
              {renderParsedAiResponse(analysisResult)}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Cpu className="w-10 h-10 text-slate-800 mb-2" />
            <span className="text-xs font-sans">سیگنال صوتی را ثبت کرده و بر روی ارزیابی توسط هوش مصنوعی کلیک کنید</span>
            <span className="text-[10px] text-slate-600 mt-1 font-sans">یافت کاتالوگی خفاش‌ها، موتورها، وسایل، همهمه بادی و التراسونیک به کار می‌رود</span>
          </div>
        )}
      </div>
    </div>
  );
}
