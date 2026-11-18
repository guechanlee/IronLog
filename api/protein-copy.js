// The protein reminder's words (protein.js), one entry per language the app speaks. {0} is the grams
// still to go, {1} the day's goal. A language not listed here gets English; de-CH is de with the
// sharp s written ss, as in nudge-copy.js.
export const PROTEIN_COPY = {
  en: { titles: { morning: 'Good morning 🍳', lunch: 'Lunch time 🍗', evening: 'Dinner time 🥩' }, body: '{0} g of protein to go today (goal {1} g).' },
  ko: { titles: { morning: '좋은 아침이에요 🍳', lunch: '점심 시간이에요 🍗', evening: '저녁 시간이에요 🥩' }, body: '오늘 단백질 {0} g 남았어요 (목표 {1} g).' },
  de: { titles: { morning: 'Guten Morgen 🍳', lunch: 'Mittagszeit 🍗', evening: 'Abendessen 🥩' }, body: 'Noch {0} g Protein bis zum Tagesziel ({1} g).' },
  es: { titles: { morning: 'Buenos días 🍳', lunch: 'Hora de comer 🍗', evening: 'Hora de cenar 🥩' }, body: 'Te faltan {0} g de proteína hoy (meta {1} g).' },
  fr: { titles: { morning: 'Bonjour 🍳', lunch: 'C’est l’heure du déjeuner 🍗', evening: 'C’est l’heure du dîner 🥩' }, body: 'Encore {0} g de protéines aujourd’hui (objectif {1} g).' },
  it: { titles: { morning: 'Buongiorno 🍳', lunch: 'È ora di pranzo 🍗', evening: 'È ora di cena 🥩' }, body: 'Mancano {0} g di proteine oggi (obiettivo {1} g).' },
  pt: { titles: { morning: 'Bom dia 🍳', lunch: 'Hora do almoço 🍗', evening: 'Hora do jantar 🥩' }, body: 'Faltam {0} g de proteína hoje (meta {1} g).' },
  'pt-BR': { titles: { morning: 'Bom dia 🍳', lunch: 'Hora do almoço 🍗', evening: 'Hora do jantar 🥩' }, body: 'Faltam {0} g de proteína hoje (meta {1} g).' },
  pl: { titles: { morning: 'Dzień dobry 🍳', lunch: 'Pora na obiad 🍗', evening: 'Pora na kolację 🥩' }, body: 'Zostało {0} g białka na dziś (cel {1} g).' },
  ru: { titles: { morning: 'Доброе утро 🍳', lunch: 'Время обеда 🍗', evening: 'Время ужина 🥩' }, body: 'Сегодня осталось {0} г белка (цель {1} г).' },
  uk: { titles: { morning: 'Доброго ранку 🍳', lunch: 'Час обіду 🍗', evening: 'Час вечері 🥩' }, body: 'Сьогодні залишилось {0} г білка (ціль {1} г).' },
  tr: { titles: { morning: 'Günaydın 🍳', lunch: 'Öğle yemeği vakti 🍗', evening: 'Akşam yemeği vakti 🥩' }, body: 'Bugün {0} g protein kaldı (hedef {1} g).' },
  sv: { titles: { morning: 'God morgon 🍳', lunch: 'Dags för lunch 🍗', evening: 'Dags för middag 🥩' }, body: '{0} g protein kvar idag (mål {1} g).' },
  hu: { titles: { morning: 'Jó reggelt 🍳', lunch: 'Ebédidő 🍗', evening: 'Vacsoraidő 🥩' }, body: 'Ma még {0} g fehérje hiányzik (cél: {1} g).' },
  zh: { titles: { morning: '早上好 🍳', lunch: '午餐时间 🍗', evening: '晚餐时间 🥩' }, body: '今天还差 {0} 克蛋白质（目标 {1} 克）。' },
  'zh-TW': { titles: { morning: '早安 🍳', lunch: '午餐時間 🍗', evening: '晚餐時間 🥩' }, body: '今天還差 {0} 公克蛋白質（目標 {1} 公克）。' },
  ar: { titles: { morning: 'صباح الخير 🍳', lunch: 'وقت الغداء 🍗', evening: 'وقت العشاء 🥩' }, body: 'تبقّى {0} غ من البروتين اليوم (الهدف {1} غ).' },
  hi: { titles: { morning: 'सुप्रभात 🍳', lunch: 'दोपहर के खाने का समय 🍗', evening: 'रात के खाने का समय 🥩' }, body: 'आज {0} ग्राम प्रोटीन बाकी है (लक्ष्य {1} ग्राम)।' },
  bn: { titles: { morning: 'সুপ্রভাত 🍳', lunch: 'দুপুরের খাবারের সময় 🍗', evening: 'রাতের খাবারের সময় 🥩' }, body: 'আজ আর {0} গ্রাম প্রোটিন বাকি (লক্ষ্য {1} গ্রাম)।' },
  th: { titles: { morning: 'อรุณสวัสดิ์ 🍳', lunch: 'ได้เวลาอาหารกลางวัน 🍗', evening: 'ได้เวลาอาหารเย็น 🥩' }, body: 'วันนี้เหลืออีก {0} กรัม (เป้าหมาย {1} กรัม)' },
};
