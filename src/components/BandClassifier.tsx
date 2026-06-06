import React from 'react';
import { FrequencyBandType, FREQUENCY_BANDS } from '../types';
import { Sparkles, Check, HelpCircle, Activity, Info } from 'lucide-react';

interface BandClassifierProps {
  // Live values from the audio analyser for each of the bands (0 to 1 scale)
  bandAmplitudes: Record<FrequencyBandType, number>;
  activeBand: FrequencyBandType;
}

export default function BandClassifier({ bandAmplitudes, activeBand }: BandClassifierProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Dynamic Classification Header banner */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-xl text-white">
            <Activity className="w-5 h-5 animate-pulse" />
          </span>
          <div>
            <h3 className="font-sans font-medium text-slate-100 flex items-center gap-2">
              <span>دسته‌بندی طیف‌های فرکانسی صوتی</span>
              <span className="text-xs text-slate-400 font-mono">Acoustic Spectrometer Classification</span>
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              تفکیک فرکانس‌های زیر، میانه و بم صوتی به همراه تشریح فیزیک موج و رفتارهای زیستی
            </p>
          </div>
        </div>

        {/* Current Active Band indicator */}
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl">
          <span className="text-xs text-slate-400 font-sans">باند صوتی غالب محیط:</span>
          <span 
            className="text-xs font-bold font-sans px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1"
            style={{ 
              backgroundColor: `${FREQUENCY_BANDS[activeBand].color}20`,
              color: FREQUENCY_BANDS[activeBand].color,
              border: `1px solid ${FREQUENCY_BANDS[activeBand].color}40`
            }}
          >
            <Sparkles className="w-3 h-3 animate-spin-slow" />
            <span>{FREQUENCY_BANDS[activeBand].nameFa}</span>
          </span>
        </div>
      </div>

      {/* Grid of the 5 Bands cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {(Object.keys(FREQUENCY_BANDS) as FrequencyBandType[]).map((key) => {
          const band = FREQUENCY_BANDS[key];
          const ampVal = bandAmplitudes[key] || 0;
          const isActive = key === activeBand;

          return (
            <div
              key={key}
              className={`relative flex flex-col rounded-2xl border bg-slate-900/40 p-4 transition-all duration-300 backdrop-blur-md overflow-hidden ${isActive ? 'border-indigo-500/80 shadow-lg shadow-indigo-500/5 bg-slate-900/80 scale-[1.02]' : 'border-slate-800/80 hover:border-slate-700'}`}
            >
              {/* Top Accent line */}
              <div 
                className="absolute top-0 left-0 w-full h-[3px] transition-opacity"
                style={{ backgroundColor: band.color }}
              />

              {/* Band name header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-slate-400">{band.range}</span>
                {isActive && (
                  <span 
                    className="p-1 rounded-md text-[9px] font-bold font-sans tracking-wide shrink-0 animate-pulse"
                    style={{ backgroundColor: `${band.color}30`, color: band.color }}
                  >
                    فعال (Active)
                  </span>
                )}
              </div>

              <div className="mb-3">
                <h4 className="font-sans font-bold text-slate-100 text-sm flex justify-between items-center">
                  <span>{band.nameFa}</span>
                </h4>
                <p className="text-[10px] font-serif tracking-tight text-slate-400 font-mono mt-0.5">
                  {band.name}
                </p>
              </div>

              {/* Live amplitude meter */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-850/80 mb-4 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400">شدت سیگنال زنده</span>
                  <span className="font-mono text-right" style={{ color: band.color }}>
                    {(ampVal * 100).toFixed(0)}%
                  </span>
                </div>
                {/* Horizontal Level Bar */}
                <div className="w-full h-1.5 bg-slate-850 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full rounded-full transition-all duration-75"
                    style={{ 
                      width: `${ampVal * 100}%`,
                      backgroundColor: band.color
                    }}
                  />
                </div>
              </div>

              {/* Farsi description */}
              <div className="text-[11px] text-slate-300 leading-relaxed font-sans mb-3 flex-1 min-h-[70px]">
                {band.descriptionFa}
              </div>

              {/* Divider */}
              <div className="h-[1px] bg-slate-800/60 my-2.5" />

              {/* Examples listing */}
              <div className="space-y-1.5 mt-1">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-mono font-bold flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  <span>نمونه‌های طبیعی و مصنوعی</span>
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {band.examplesFa.map((ex, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[9px] bg-slate-950/80 border border-slate-850 text-slate-300 hover:text-white transition-colors font-sans"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              </div>

              {/* English secondary desc for completeness */}
              <div className="mt-4 pt-3 border-t border-slate-850 text-[9px] text-slate-400 leading-normal line-clamp-2">
                {band.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Physics Comparison Table / Footnotes bottom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="space-y-2">
          <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <span>🧬 فیزیک طول موج و رفتار صوتی</span>
            <span className="text-slate-400">• Acoustic Wave Dynamics</span>
          </h5>
          <div className="text-xs text-slate-400 leading-relaxed font-sans space-y-2">
            <p>
              صدا ارتعاش مکانیکی ذرات هوا است. هرچه فرکانس صدا <span className="text-violet-400 font-bold">بم‌تر</span> (مثل فروصوت) باشد، طول موج بلندتر است (در ۲0 هرتز طول موج حدود هفده متر است!) و این امواج بسیار راحت از دیوار، خاک، آب‌وهوا عبور کرده و توان پیمودن مسافت‌های فراملی را دارند.
            </p>
            <p>
              در طرف مقابل، فرکانس‌های <span className="text-red-400 font-bold">فراصوت</span> طول‌موج‌هایی در حد چند میلی‌متر دارند. این امواج به سادگی به موانع برخورد می‌کنند، موانع برای آن‌ها سایه‌ای عمیق ایجاد می‌کنند و همین ویژگی است که به خفاش‌ها اجازه می‌دهد با رفلکس سیگنال خود تصاویری دقیق از پشه‌های ریز ترسیم کنند.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <span>⚠️ محدودیت‌های حسگر متداول میکروفون</span>
            <span className="text-slate-405">• Microphones Hardware Boundaries</span>
          </h5>
          <div className="text-xs text-slate-400 leading-relaxed font-sans space-y-2">
            <p>
              میکروفون‌های استاندارد گوشی یا لپ‌تاپ معمولاً برای مکالمات انسانی کالیبره شده‌اند و فرکانس‌های زیر ۱۰۰ هرتز و بالای ۱۶ هزار هرتز را فیلتر یا ضعیف می‌کنند.
            </p>
            <p>
              با این حال، کارت صدا ارتعاشات الکترونیکی ورودی را بین <span className="text-emerald-400 font-bold font-mono">20Hz</span> تا <span className="text-emerald-400 font-bold font-mono">24,000Hz</span> دریافت می‌کند. برای تجربه مطلوب فرکانس‌های خارج از شنوایی انسان، استفاده از میکروفون‌های مجهز به کپسول خازنی عریض (برای فروصوت) یا مبدل‌های آلتراسونیک پیزو (برای فراصوت) پیشنهاد می‌شود.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
