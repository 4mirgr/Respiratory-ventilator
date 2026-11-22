const sources = {
  volumes: {
    label: "OpenStax · فرایند تنفس",
    url: "https://openstax.org/books/anatomy-and-physiology-2e/pages/22-3-the-process-of-breathing",
  },
  spirometry: {
    label: "ATS/ERS · استاندارد اسپیرومتری",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6794117/",
  },
  mechanics: {
    label: "Critical Care · مرور مکانیک تنفس",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1297597/",
  },
  niv: {
    label: "ERS/ATS · راهنمای تهویهٔ غیرتهاجمی",
    url: "https://www.thoracic.org/statements/resources/cc/niv-guidelines.pdf",
  },
  monitor: {
    label: "Dräger · تصاویر و راهنمای مانیتور Evita V800",
    url: "https://www.draeger.com/en-us_us/Products/Evita-V800",
  },
};

export const lesson = {
  title: "حجم‌ها و ظرفیت‌های ریه",
  intro: "یک دم آرام، عمیق‌ترین دم ممکن و هوایی که حتی پس از بازدم کامل در ریه می‌ماند، سه چیز متفاوت‌اند. عددهای زیر از یک مثال فرضی و سازگار با هم می‌آیند. حجم‌های واقعی به قد، سن، جنس و شرایط اندازه‌گیری وابسته‌اند.",
  volumes: [
    { abbr: "VT (TV)", name: "حجم جاری", value: "۵۰۰ میلی‌لیتر", definition: "حجم هوایی که در یک دم آرام وارد ریه می‌شود." },
    { abbr: "IRV", name: "حجم ذخیرهٔ دمی", value: "۳٬۰۰۰ میلی‌لیتر", definition: "حجم اضافی که بعد از یک دم آرام، با دم حداکثری وارد می‌شود." },
    { abbr: "ERV", name: "حجم ذخیرهٔ بازدمی", value: "۱٬۱۰۰ میلی‌لیتر", definition: "حجم اضافی که بعد از یک بازدم آرام، با بازدم حداکثری خارج می‌شود." },
    { abbr: "RV", name: "حجم باقیمانده", value: "۱٬۲۰۰ میلی‌لیتر", definition: "هوایی که بعد از بازدم حداکثری در ریه باقی می‌ماند." },
    { abbr: "IC", name: "ظرفیت دمی", value: "۳٬۵۰۰ میلی‌لیتر", definition: "حداکثر حجم دم از انتهای بازدم آرام. برابر با VT + IRV است." },
    { abbr: "FRC", name: "ظرفیت باقیماندهٔ عملکردی", value: "۲٬۳۰۰ میلی‌لیتر", definition: "حجم ریه در پایان بازدم آرام. برابر با ERV + RV است." },
    { abbr: "VC", name: "ظرفیت حیاتی", value: "۴٬۶۰۰ میلی‌لیتر", definition: "حداکثر حجم قابل بازدم پس از یک دم حداکثری. برابر با IRV + VT + ERV است." },
    { abbr: "TLC", name: "ظرفیت کل ریه", value: "۵٬۸۰۰ میلی‌لیتر", definition: "حجم ریه در انتهای دم حداکثری. برابر با VC + RV یا IC + FRC است." },
  ],
  concepts: [
    { title: "اسپیرومتری چه چیزی را می‌سنجد؟", body: "اسپیرومتر هوایی را اندازه می‌گیرد که از دهان حرکت می‌کند. برای سنجش RV و ظرفیت‌های شامل آن، یعنی FRC و TLC، از آزمون‌های حجم ریه مثل پلتیسموگرافی یا روش رقیق‌سازی گاز کمک می‌گیریم." },
    { title: "کامپلاینس و مقاومت", body: "کامپلاینس دستگاه تنفسی می‌گوید در برابر یک تغییر مشخص فشار، حجم چقدر تغییر می‌کند. مقاومت راه هوایی می‌گوید برای ایجاد جریان، چه افت فشاری لازم است. در تهویهٔ کنترل حجمیِ بیمار بدون تلاش تنفسی، مکث دمی جریان را به صفر می‌رساند و فشار پلاتو قابل اندازه‌گیری می‌شود." },
    { title: "اکسیژناسیون و تهویه", body: "اکسیژناسیون با شاخص‌هایی مثل PaO₂ و SpO₂ بررسی می‌شود. دفع CO₂ به تهویهٔ آلوئولی و تولید CO₂ وابسته است. بخشی از هر نفس در فضای مرده حرکت می‌کند و در تبادل گاز شرکت نمی‌کند." },
    { title: "ارتباط pH، PaCO₂ و بیکربنات", body: "اگر بیکربنات ثابت بماند، بالا رفتن PaCO₂ باعث افت pH می‌شود. اگر PaCO₂ ثابت بماند، بالا رفتن بیکربنات pH را بیشتر می‌کند. تفسیر ABG به هر سه عدد، جبران مورد انتظار و وضعیت بالینی نیاز دارد." },
  ],
  question: {
    prompt: "در مثال بالا بعد از یک بازدم آرام، چه حجمی از هوا هنوز در ریه است؟",
    options: ["۵۰۰ میلی‌لیتر (VT)", "۱٬۲۰۰ میلی‌لیتر (RV)", "۲٬۳۰۰ میلی‌لیتر (FRC)", "۵٬۸۰۰ میلی‌لیتر (TLC)"],
    correct: 2,
    explanation: "در پایان بازدم آرام، حجم ذخیرهٔ بازدمی هنوز قابل خروج است و حجم باقیمانده نیز در ریه حضور دارد. مجموع ERV و RV برابر با FRC، یعنی ۲٬۳۰۰ میلی‌لیتر، است.",
  },
  sources: [sources.volumes, sources.spirometry, sources.mechanics, sources.niv, sources.monitor],
};

export const modes = [
  {
    id: "VC",
    title: "کنترل حجمی",
    short: "VC",
    description: "در نفس اجباری، حجم جاری هدف تنظیم می‌شود و فشار لازم با مکانیک تنفس تغییر می‌کند. این تمرین دم را با الگوی جریان ثابت مدل می‌کند.",
    uses: "برای دیدن اثر مقاومت یا کامپلاینس بر فشار راه هوایی در یک حجم هدف ثابت.",
    watch: "با جریان ثابت، افزایش مقاومت فاصلهٔ فشار پیک تا پلاتو را بیشتر می‌کند. برای تفسیر Pplat به مکث دمی و شرایط اندازه‌گیری توجه کن.",
  },
  {
    id: "PC",
    title: "کنترل فشاری",
    short: "PC",
    description: "در نفس اجباری، فشار هدف دمی بالاتر از PEEP و مدت دم تعیین می‌شوند. حجم جاری به اختلاف فشار، مکانیک بیمار و زمان دم وابسته است.",
    uses: "برای مقایسهٔ حجم جاری وقتی فشار دمی ثابت است و کامپلاینس یا مقاومت تغییر می‌کند.",
    watch: "فشار راه هوایی و شکل موج جریان را در کنار حجم جاری ببین. حجم می‌تواند با همان فشار هدف تغییر کند.",
  },
  {
    id: "CPAP",
    title: "فشار مثبت مداوم راه هوایی",
    short: "CPAP",
    description: "یک سطح فشار مثبت در طول دم و بازدم حفظ می‌شود و بیمار خودبه‌خود نفس می‌کشد.",
    uses: "برای فهم حمایت از راه هوایی و اکسیژناسیون در دم خودبه‌خودی. مثال‌های بالینی شامل آپنهٔ انسدادی خواب و برخی بیماران با ادم ریوی کاردیوژنیک‌اند.",
    watch: "یک سطح فشار برای کل چرخه وجود دارد. در پنل، RR و I:E زمان‌بندی فرضی نفس‌های خودبه‌خودی بیمار را تغییر می‌دهند.",
  },
  {
    id: "BILEVEL",
    title: "فشار مثبت دو سطحی",
    short: "BPAP",
    description: "در این تمرین، تهویهٔ غیرتهاجمی دو سطحی (BiPAP) با یک فشار دمی (IPAP) و یک فشار بازدمی (EPAP) نشان داده می‌شود. اختلاف این دو سطح، حمایت فشاری است.",
    uses: "برای مقایسهٔ اثر حمایت فشاری و فشار بازدمی. تشدید COPD همراه با نارسایی تنفسی هیپرکاپنیک، نمونه‌ای از کاربرد بالینی با ارزیابی شرایط بیمار است.",
    watch: "در پنل، IPAP حاصل جمع EPAP و ΔPinsp است. RR و I:E زمان‌بندی فرضی نفس‌های خودبه‌خودی بیمارند.",
  },
  {
    id: "SIMV",
    title: "تهویهٔ اجباری متناوب همزمان‌شده",
    short: "SIMV",
    description: "دستگاه تعداد مشخصی نفس اجباری می‌دهد و برای همزمانی از تلاش بیمار استفاده می‌کند. بیمار می‌تواند بین نفس‌های اجباری، نفس خودبه‌خودی داشته باشد که بسته به تنظیمات می‌تواند حمایت فشاری بگیرد.",
    uses: "برای دیدن تفاوت موج‌های نفس اجباری و نفس خودبه‌خودی در یک مانیتور.",
    watch: "RR و حجم هدف برای نفس اجباری‌اند. Vₜ روی مانیتور میانگین نفس‌های اجباری و خودبه‌خودی است.",
  },
];

export const conditions = [
  {
    id: "baseline",
    title: "وضعیت پایه",
    description: "پارامترهای کیس بدون بیماری همراه اضافه نمایش داده می‌شوند.",
  },
  {
    id: "low-output",
    title: "برون‌ده قلبی پایین",
    description: "در این تمرین، مقدار خونی که در هر دقیقه به گردش می‌رسد کمتر است. شدت تغییر از وضعیت پایهٔ همان کیس محاسبه می‌شود.",
  },
  {
    id: "rapid-rhythm",
    title: "آریتمی سریع با افت برون‌ده",
    description: "این حالت یک آریتمی سریعِ همراه با کاهش پرشدن قلب و افت برون‌ده را نمایش می‌دهد. اثر مدل‌شده برای همین سناریو تعریف شده است.",
  },
  {
    id: "pulmonary-edema",
    title: "ادم ریوی همراه",
    description: "در این سناریو ورود مایع به ریه، کامپلاینس را کاهش و سهم شانت را افزایش می‌دهد. در نمای ریه و ABG می‌توانی پیامد این دو تغییر را دنبال کنی.",
  },
];

// Each modifier depicts one example physiology. Values are illustrative parameters,
// independent of clinical ranges or recommendations for ventilator setup.
function withEffects(scenario) {
  return {
    ...scenario,
    effects: {
      baseline: {},
      "low-output": { cardiacOutput: Number((scenario.cardiacOutput * 0.68).toFixed(1)) },
      "rapid-rhythm": { cardiacOutput: Number((scenario.cardiacOutput * 0.8).toFixed(1)) },
      "pulmonary-edema": {
        compliance: Math.round(scenario.compliance * 0.74),
        shunt: Math.min(0.62, Number((scenario.shunt + 0.13).toFixed(2))),
      },
    },
  };
}

export const scenarios = [
  {
    id: "normal",
    title: "مکانیک پایهٔ تنفس",
    subtitle: "بیمار فرضی بدون بیماری ریوی",
    summary: "این کیس نقطهٔ مقایسه است. در جریان دم ثابت، ابتدا فشار پیک را با فشار پلاتو مقایسه کن و سپس به شکل جریان بازدم نگاه کن.",
    clinic: "با تغییر مقاومت و کامپلاینس، سهم فشار ناشی از جریان و سهم فشار ناشی از اتساع دستگاه تنفسی را روی موج‌ها دنبال کن.",
    compliance: 58, resistance: 10, deadSpace: 0.28, shunt: 0.04,
    cardiacOutput: 5.2, hco3: 24, co2Production: 195,
    defaults: { mode: "VC", rr: 14, vt: 450, peep: 5, fio2: 30, ie: 2 },
    source: sources.mechanics,
  },
  {
    id: "copd",
    title: "تشدید COPD",
    subtitle: "انسداد بازدمی و خطر حبس هوا",
    summary: "در این کیس آمفیزم‌غالب، مقاومت راه هوایی بالاست و خروج هوا طول می‌کشد. بیکربنات پایه بالاتر انتخاب شده تا سابقهٔ احتباس مزمن CO₂ در بیمار فرضی را بازتاب دهد.",
    clinic: "بررسی کن آیا جریان بازدم قبل از دم بعدی به خط صفر می‌رسد. تداوم جریان در پایان بازدم می‌تواند سرنخی برای حبس هوا و PEEP ذاتی باشد.",
    compliance: 72, resistance: 23, deadSpace: 0.43, shunt: 0.08,
    cardiacOutput: 4.8, hco3: 30, co2Production: 205,
    defaults: { mode: "VC", rr: 16, vt: 435, peep: 5, fio2: 35, ie: 3 },
    source: {
      label: "GOLD · خلاصهٔ گزارش ۲۰۲۳",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10111975/",
    },
  },
  {
    id: "ards",
    title: "سندرم دیسترس حاد تنفسی",
    subtitle: "ARDS · کامپلاینس پایین و شانت بالا",
    summary: "در این کیس فرضی، پرشدگی و روی‌هم‌خوابیدن بخش‌هایی از ریه، سطح قابل تهویه را کاهش می‌دهد. بخشی از خون از نواحی با تهویهٔ بسیار کم عبور می‌کند.",
    clinic: "به افزایش فشار پلاتو در یک حجم ثابت توجه کن. سپس مقایسه کن افزایش FiO₂ با وجود شانت چقدر اکسیژناسیون مدل را تغییر می‌دهد.",
    compliance: 27, resistance: 11, deadSpace: 0.42, shunt: 0.34, recruitability: 0.45,
    cardiacOutput: 5.6, hco3: 22, co2Production: 220,
    defaults: { mode: "VC", rr: 20, vt: 360, peep: 10, fio2: 55, ie: 2 },
    source: {
      label: "ATS · راهنمای رسمی ARDS",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10870893/",
    },
  },
  {
    id: "tb",
    title: "سل ریوی با درگیری پارانشیم",
    subtitle: "TB · یک الگوی فرضی از درگیری موضعی",
    summary: "این سناریو بیماری فرضی با سل ریوی و درگیری قابل توجه پارانشیم را نشان می‌دهد. الگوی آسیب و اثر آن بر مقاومت یا کامپلاینس در بیماران متفاوت است.",
    clinic: "در این نمونه به رابطهٔ نواحی کم‌تهویه با اکسیژناسیون نگاه کن. سرفه، علائم عمومی و هموپتیزی می‌توانند در ارزیابی بالینی مطرح باشند.",
    compliance: 44, resistance: 13, deadSpace: 0.34, shunt: 0.17,
    cardiacOutput: 5.1, hco3: 24, co2Production: 210,
    defaults: { mode: "VC", rr: 16, vt: 420, peep: 6, fio2: 40 },
    source: {
      label: "CDC · مرور بالینی سل",
      url: "https://www.cdc.gov/tb/hcp/clinical-overview/index.html",
    },
  },
  {
    id: "dah",
    title: "خونریزی منتشر آلوئولی",
    subtitle: "DAH · کاهش تهویهٔ آلوئول‌های خون‌گرفته",
    summary: "در این نمونه، خون وارد آلوئول‌ها شده و تهویهٔ نواحی درگیر را کم کرده است. مدل اثر این درگیری را از راه کاهش کامپلاینس و افزایش شانت نشان می‌دهد.",
    clinic: "افت اکسیژناسیون و تغییر مکانیک را با هم ببین. در بالین، هموپتیزی می‌تواند غایب باشد و افت هموگلوبین نیز بخشی از ارزیابی است.",
    compliance: 32, resistance: 13, deadSpace: 0.37, shunt: 0.30,
    cardiacOutput: 4.8, hco3: 23, co2Production: 205,
    defaults: { mode: "VC", rr: 18, vt: 385, peep: 8, fio2: 50 },
    source: {
      label: "Tuberculosis and Respiratory Diseases · مرور DAH",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3651925/",
    },
  },
  {
    id: "dhf",
    title: "ادم ریوی کاردیوژنیک",
    subtitle: "DHF · نارسایی قلبی دکمپنسیه",
    summary: "بالا رفتن فشار پرشدگی سمت چپ قلب در این کیس باعث تجمع مایع در فضای بینابینی و آلوئول‌ها شده است. ریه سفت‌تر است و اکسیژناسیون مختل می‌شود.",
    clinic: "اثر کامپلاینس کمتر و شانت بیشتر را جداگانه دنبال کن. این مسیر پیوند فشارهای سمت چپ قلب و تبادل گاز ریه را نشان می‌دهد.",
    compliance: 34, resistance: 12, deadSpace: 0.34, shunt: 0.25, recruitability: 0.5,
    cardiacOutput: 3.9, hco3: 23, co2Production: 200,
    defaults: { mode: "BILEVEL", rr: 18, peep: 8, fio2: 45, inspPressure: 8 },
    source: {
      label: "Merck Manual · ادم ریوی",
      url: "https://www.merckmanuals.com/professional/cardiovascular-disorders/heart-failure/pulmonary-edema",
    },
  },
  {
    id: "cor-pulmonale",
    title: "کور پولموناله",
    subtitle: "بار بالای بطن راست در بیماری ریه",
    summary: "در این کیس، بیماری مزمن ریه و پرفشاری گردش ریوی بار بطن راست را بالا برده‌اند. اختلال مکانیک راه هوایی و برون‌ده پایین در بیمار فرضی همزمان‌اند.",
    clinic: "رابطهٔ عبور خون از ریه و کار بطن راست را با کیس COPD مقایسه کن. برون‌ده قلبی حجم خونی است که قلب در هر دقیقه پمپ می‌کند.",
    compliance: 63, resistance: 19, deadSpace: 0.43, shunt: 0.10,
    cardiacOutput: 3.5, hco3: 27, co2Production: 195,
    defaults: { mode: "VC", rr: 14, vt: 430, peep: 5, fio2: 40, ie: 3 },
    source: {
      label: "Merck Manual · نارسایی قلب راست و کور پولموناله",
      url: "https://www.merckmanuals.com/professional/cardiovascular-disorders/heart-failure/right-heart-failure-and-cor-pulmonale",
    },
  },
  {
    id: "pe",
    title: "آمبولی حاد ریه",
    subtitle: "PE · افزایش فضای مردهٔ آلوئولی",
    summary: "انسداد عروق ریوی باعث می‌شود بخشی از آلوئول‌های تهویه‌شونده خون کمتری دریافت کنند. این کیس افزایش فضای مرده و افت برون‌ده در یک نمونهٔ همراه با بار بطن راست را مدل می‌کند.",
    clinic: "با حجم دقیقه‌ای مشابه، بررسی کن چه مقدار از تهویه به آلوئول‌های دارای خون‌رسانی مؤثر می‌رسد. PaCO₂ در بیمار واقعی با تغییر الگوی تنفس هم تغییر می‌کند.",
    compliance: 54, resistance: 10, deadSpace: 0.54, shunt: 0.12,
    cardiacOutput: 3.7, hco3: 23, co2Production: 205,
    defaults: { mode: "VC", rr: 19, vt: 445, peep: 5, fio2: 40 },
    source: {
      label: "ESC · راهنمای آمبولی ریوی حاد",
      url: "https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/acute-pulmonary-embolism/",
    },
  },
  {
    id: "hemoptysis",
    title: "هموپتیزی با اختلال راه هوایی",
    subtitle: "خون یا لخته در راه‌های هوایی",
    summary: "هموپتیزی یک علامت است. این سناریو یک نمونهٔ فرضی را نشان می‌دهد که در آن خون یا لخته بخشی از راه هوایی را مسدود کرده است.",
    clinic: "انسداد ناشی از خون می‌تواند جریان را محدود کند و اکسیژناسیون را مختل کند. این کیس را با DAH مقایسه کن که در آن درگیری اصلیِ نمونه داخل آلوئول‌هاست.",
    compliance: 43, resistance: 21, deadSpace: 0.35, shunt: 0.22,
    cardiacOutput: 4.7, hco3: 24, co2Production: 210,
    defaults: { mode: "VC", rr: 16, vt: 410, peep: 6, fio2: 45, ie: 2.5 },
    source: {
      label: "American Family Physician · ارزیابی هموپتیزی",
      url: "https://www.aafp.org/afp/2022/0200/p144",
    },
  },
  {
    id: "fibrosis",
    title: "فیبروز ریه",
    subtitle: "الگوی محدودکننده و اتساع دشوار",
    summary: "بافت بینابینی اسکار دارد و ریه سخت‌تر باز می‌شود. کامپلاینس پایین و اختلال تبادل گاز دو اثر مهمی هستند که در این نمونه دنبال می‌کنیم.",
    clinic: "در کنترل فشاری، حجم جاری این کیس را با حالت پایه، زیر همان فشار و زمان دمی، مقایسه کن. در آزمون عملکرد ریه، TLC پایین‌تر از حد پایین طبیعی نشان‌دهندهٔ محدودیت است.",
    compliance: 30, resistance: 10, deadSpace: 0.38, shunt: 0.14,
    cardiacOutput: 4.6, hco3: 24, co2Production: 200,
    defaults: { mode: "PC", rr: 19, peep: 5, fio2: 40, ie: 2, inspPressure: 12 },
    source: {
      label: "NHLBI · فیبروز ریوی ایدیوپاتیک",
      url: "https://www.nhlbi.nih.gov/health/idiopathic-pulmonary-fibrosis",
    },
  },
].map(withEffects);
