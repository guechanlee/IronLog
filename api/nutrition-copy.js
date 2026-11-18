// The nutrient reminder's words (nutrition.js), one entry per language the app speaks: the three nutrient names
// and how one short nutrient reads, {n} the name and {0} the percent of the goal still to go. A language not
// listed gets English; the slot greetings (morning, lunch, dinner) come from protein-copy.js.
export const NUTRIENT_COPY = {
  en: { names: { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' }, short: '{n} {0}% short' },
  ko: { names: { protein: '단백질', carbs: '탄수화물', fat: '지방' }, short: '{n} {0}% 부족' },
  de: { names: { protein: 'Protein', carbs: 'Kohlenhydrate', fat: 'Fett' }, short: '{n}: {0}% fehlen' },
  es: { names: { protein: 'Proteína', carbs: 'Carbohidratos', fat: 'Grasa' }, short: '{n}: faltan {0}%' },
  fr: { names: { protein: 'Protéines', carbs: 'Glucides', fat: 'Lipides' }, short: '{n} : il manque {0} %' },
  it: { names: { protein: 'Proteine', carbs: 'Carboidrati', fat: 'Grassi' }, short: '{n}: mancano {0}%' },
  pt: { names: { protein: 'Proteína', carbs: 'Carboidratos', fat: 'Gordura' }, short: '{n}: faltam {0}%' },
  'pt-BR': { names: { protein: 'Proteína', carbs: 'Carboidratos', fat: 'Gordura' }, short: '{n}: faltam {0}%' },
  pl: { names: { protein: 'Białko', carbs: 'Węglowodany', fat: 'Tłuszcz' }, short: '{n}: brakuje {0}%' },
  ru: { names: { protein: 'Белок', carbs: 'Углеводы', fat: 'Жиры' }, short: '{n}: не хватает {0}%' },
  uk: { names: { protein: 'Білок', carbs: 'Вуглеводи', fat: 'Жири' }, short: '{n}: не вистачає {0}%' },
  tr: { names: { protein: 'Protein', carbs: 'Karbonhidrat', fat: 'Yağ' }, short: '{n}: %{0} eksik' },
  sv: { names: { protein: 'Protein', carbs: 'Kolhydrater', fat: 'Fett' }, short: '{n}: {0}% kvar' },
  hu: { names: { protein: 'Fehérje', carbs: 'Szénhidrát', fat: 'Zsír' }, short: '{n}: {0}% hiányzik' },
  zh: { names: { protein: '蛋白质', carbs: '碳水化合物', fat: '脂肪' }, short: '{n}还差 {0}%' },
  'zh-TW': { names: { protein: '蛋白質', carbs: '碳水化合物', fat: '脂肪' }, short: '{n}還差 {0}%' },
  ar: { names: { protein: 'البروتين', carbs: 'الكربوهيدرات', fat: 'الدهون' }, short: '{n}: ينقص {0}%' },
  hi: { names: { protein: 'प्रोटीन', carbs: 'कार्ब्स', fat: 'वसा' }, short: '{n}: {0}% कम' },
  bn: { names: { protein: 'প্রোটিন', carbs: 'কার্বোহাইড্রেট', fat: 'চর্বি' }, short: '{n}: {0}% কম' },
  th: { names: { protein: 'โปรตีน', carbs: 'คาร์โบไฮเดรต', fat: 'ไขมัน' }, short: '{n} ขาด {0}%' },
};
