export interface SoundEmitter {
  id: string;
  name: string;
  nameFa: string;
  type: 'infrasound' | 'human-bass' | 'human-mid' | 'human-high' | 'ultrasound';
  frequency: number; // in Hz
  volume: number; // 0 to 100
  x: number; // -100 to 100
  y: number; // -100 to 100 (height relative to surface)
  z: number; // -100 to 100 (distance / depth)
  icon: string;
  description: string;
  descriptionFa: string;
}

export type FrequencyBandType = 'infrasound' | 'human-bass' | 'human-mid' | 'human-high' | 'ultrasound';

export interface FrequencyBandInfo {
  type: FrequencyBandType;
  name: string;
  nameFa: string;
  range: string;
  color: string;
  description: string;
  descriptionFa: string;
  examples: string[];
  examplesFa: string[];
}

export interface AcousticSnapshot {
  peakHz: number;
  avgHz: number;
  volumeDb: number;
  band: string;
  bandFa: string;
  profile: string;
  profileFa: string;
  timestamp: string;
}

export const FREQUENCY_BANDS: Record<FrequencyBandType, FrequencyBandInfo> = {
  'infrasound': {
    type: 'infrasound',
    name: 'Infrasound',
    nameFa: 'فروصوت',
    range: '0 Hz - 20 Hz',
    color: '#8b5cf6', // Indigo / Purple
    description: 'Extremely low frequency vibrations. Standard humans cannot hear them, but they can feel them as air pressure oscillations. Traversed easily through thick barriers.',
    descriptionFa: 'ارتعاشات با فرکانس بسیار پایین. گوش انسان قادر به شنیدن این صداها نیست، اما ممکن است آنها را به صورت نوسان فشار هوا حس کند. این صداها راحت از موانع عبور می‌کنند.',
    examples: ['Seismic activity', 'Volcanic hum', 'Elephant calls', 'Wind turbines', 'Heavy diesel engines'],
    examplesFa: ['فعالیت‌های زمین‌لرزه', 'زمزمه‌های آتشفشانی', 'ارتباط فیل‌ها', 'توربین‌های بادی', 'موتورهای دیزلی سنگین']
  },
  'human-bass': {
    type: 'human-bass',
    name: 'Sub-bass & Bass (Human)',
    nameFa: 'باس و ساب‌باس (محدوده انسان)',
    range: '20 Hz - 250 Hz',
    color: '#3b82f6', // Blue
    description: 'The foundation of beat and rhythm. Gives depth, weight, and warmth to human voice, thunder, musical instruments, and machinery.',
    descriptionFa: 'پایه و اساس ریتم و ضربان. به صدای انسان، رعد و برق، آلات موسیقی و ماشین‌آلات عمق و سنگینی می‌بخشد.',
    examples: ['Thunder', 'Bass guitar/Kick drum', 'Aviation hum', 'Subwoofer sweeps', 'Transformers'],
    examplesFa: ['رعد و برق', 'گیتار باس / طبل بزرگ', 'صدای موتور هواپیما', 'موج‌های ساب‌ووفر', 'ترانسفورماتورها']
  },
  'human-mid': {
    type: 'human-mid',
    name: 'Midrange frequencies (Human)',
    nameFa: 'فرکانس‌های میانی (محدوده انسان)',
    range: '250 Hz - 4,000 Hz',
    color: '#10b981', // Emerald
    description: 'The most sensitive region of human hearing. Contains almost all speech formants, telephone bands, birdsongs, and crucial environmental alerts.',
    descriptionFa: 'حساسترین محدوده شنوایی انسان. شامل بیشتر بخش‌های مکالمه صوتی انسان، بوق تلفن، صدای پرندگان و هشدارهای محیطی مهم.',
    examples: ['Human speech & vocals', 'Telephone rings', 'Crying baby', 'Violin / Piano keys', 'Car horn'],
    examplesFa: ['گفتار و صدای انسان', 'زنگ تلفن', 'گریه نوزاد', 'ویولن و کلیدهای پیانو', 'بوق خودرو']
  },
  'human-high': {
    type: 'human-high',
    name: 'High Range & Presence',
    nameFa: 'محدوده فرکانس بالا (زیر)',
    range: '4,000 Hz - 20,000 Hz',
    color: '#f59e0b', // Amber
    description: 'Crispness, sibilance, and brilliance of sound. Adds sparkle and airiness to acoustical spaces, though it attenuates rapidly over distances.',
    descriptionFa: 'ترد بودن، شفافیت و تیزی صدا. درخشش و وضوح را به فضا اضافه می‌کند، هرچند با افزایش فاصله به سرعت ضعیف می‌شود.',
    examples: ['Cymbals clashing', 'Sibilant speech (S, Sh, F)', 'Keys jingling', 'Whistling', 'Mosquito buzz'],
    examplesFa: ['برخورد سنج‌ها', 'حروف صفیری (س، ش، ف)', 'جیرجیر کلیدها', 'سوت زدن', 'صدای وزوز پشه']
  },
  'ultrasound': {
    type: 'ultrasound',
    name: 'Ultrasound',
    nameFa: 'فراصوت',
    range: '20,000 Hz+',
    color: '#ef4444', // Red
    description: 'Frequencies above human capacity. Many animals (like bats & mice) navigate or communicate here. Used in ultrasonic radars and cleaning.',
    descriptionFa: 'فرکانس‌های فراتر از توانایی شنوایی انسان. بسیاری از حیوانات مانند خفاش‌ها و دلفین‌ها از این فرکانس برای جهت‌یابی و ارتباط استفاده می‌کنند.',
    examples: ['Bat echolocation', 'Dog whistle', 'Ultrasonic distance sensors', 'Dolphin clicks', 'Medical sonography'],
    examplesFa: ['جهت‌یابی صوتی خفاش', 'سوت مخصوص سگ', 'حسگرهای فاصله‌یاب فراصوت', 'تیک‌تیک‌های دلفین', 'سونوگرافی پزشکی']
  }
};
