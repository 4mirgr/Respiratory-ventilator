import { airwayTraining as airwayTrainingFa, courseChapters as courseChaptersFa, lesson as lessonFa, scenarios as scenariosFa, conditions as conditionsFa, modes as modesFa, contentEn } from "./content.js?v=8-i18n";
import { simulate } from "./model.js?v=4-airway";
import { createWaveforms } from "./waveforms.js?v=4-airway";
import { createOrganMotion } from "./organ-motion.js?v=4-airway";

const find = selector => document.querySelector(selector);
const contentFa = { airwayTraining: airwayTrainingFa, courseChapters: courseChaptersFa, lesson: lessonFa, scenarios: scenariosFa, conditions: conditionsFa, modes: modesFa };
let language = (() => { try { return localStorage.getItem("ventilator-language") === "en" ? "en" : "fa"; } catch { return "fa"; } })();
let { airwayTraining, courseChapters, lesson, scenarios, conditions, modes } = language === "en" ? contentEn : contentFa;
const tx = (fa, en) => language === "en" ? en : fa;

const defaults = {
  mode: "VC", rr: 14, vt: 450, peep: 5, fio2: 21, ie: 2, inspPressure: 12, pressureSupport: 8,
  heartRate: null, airway: "clear", airwaySeverity: 50,
};
const settings = { ...defaults };
const controlDefinitions = [
  { key: "rr", label: "RR", name: "تعداد تنفس در دقیقه", nameEn: "Respiratory rate, breaths per minute", min: 6, max: 35, step: 1 },
  { key: "vt", label: "Vₜ", name: "حجم جاری هدف بر حسب میلی‌لیتر", nameEn: "Target tidal volume, millilitres", min: 200, max: 800, step: 5, modes: ["VC", "SIMV"] },
  { key: "peep", label: "PEEP", name: "فشار مثبت انتهای بازدم", nameEn: "Positive end-expiratory pressure", min: 0, max: 20, step: 1 },
  { key: "fio2", label: "FiO₂", name: "درصد اکسیژن دمی", nameEn: "Inspired oxygen percentage", min: 21, max: 100, step: 1, format: value => value + "%" },
  { key: "ie", label: "I:E", name: "نسبت زمان دم به بازدم", nameEn: "Inspiratory to expiratory time ratio", min: 0.5, max: 5, step: 0.5, format: value => "1:" + value },
  { key: "inspPressure", label: "ΔPinsp", name: "فشار دمی بالاتر از فشار بازدمی", nameEn: "Inspiratory pressure above expiratory pressure", min: 4, max: 28, step: 1, modes: ["PC", "BILEVEL"] },
  { key: "pressureSupport", label: "PS", name: "فشار حمایتی در تنفس خودبه‌خودی", nameEn: "Pressure support during spontaneous breaths", min: 0, max: 24, step: 1, modes: ["SIMV"] },
  { key: "heartRate", label: "HR", name: "ضربان قلب در نمای شماتیک، بر حسب ضربان در دقیقه", nameEn: "Heart rate in the schematic, beats per minute", min: 35, max: 190, step: 1 },
];
const mechanicsDefinitions = [
  { key: "compliance", label: "کامپلاینس", labelEn: "Compliance", name: "کامپلاینس دستگاه تنفسی بر حسب میلی‌لیتر بر سانتی‌متر آب", nameEn: "Respiratory system compliance, mL per cmH₂O", min: 15, max: 100 },
  { key: "resistance", label: "مقاومت", labelEn: "Resistance", name: "مقاومت راه هوایی بر حسب سانتی‌متر آب بر لیتر در ثانیه", nameEn: "Airway resistance, cmH₂O per L/s", min: 4, max: 40 },
];
const controlElements = new Map();
const mechanicsElements = new Map();
const airwayElements = new Map();
const mechanicsOverrides = {};
const caseSelect = find("#case-select");
const conditionSelect = find("#condition-select");
const modeSelect = find("#mode-select");
const airwaySelect = find("#airway-select");
const pauseButton = find("#pause-monitor");
const breathIndicators = [find("#breath-phase"), find("#monitor-breath-phase")];
const organMotion = createOrganMotion();
const deviceTabs = [...document.querySelectorAll(".device-navigation button")];
const pagers = new Map();
let bicarbonate = null;
let renderedScenario = null;

const chart = createWaveforms(sample => {
  const phase = sample.flow > 0.75 ? "inspiration" : sample.flow < -0.75 ? "expiration" : "low";
  for (const indicator of breathIndicators) {
    if (indicator.textContent !== phase) {
      indicator.textContent = phase === "inspiration" ? tx("دم", "Inspiration") : phase === "expiration" ? tx("بازدم", "Expiration") : tx("جریان کم", "Low flow");
      indicator.dataset.phase = phase;
    }
  }
  organMotion.updateBreath(sample);
});

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function setText(selector, value) {
  find(selector).textContent = value;
}

function makeSourceLink(source) {
  const link = node("a", source.label);
  link.href = source.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function fillSelect(select, items, label) {
  select.replaceChildren();
  for (const item of items) select.add(new Option(label(item), item.id));
}

function createPager(view) {
  let pages = [...view.querySelectorAll("[data-panel-page]")];
  const nav = node("nav", undefined, "page-navigation");
  nav.setAttribute("aria-label", tx("صفحه‌های این بخش", "Pages in this section"));
  const previous = node("button", tx("قبلی", "Previous"), "text-button");
  const next = node("button", tx("بعدی", "Next"), "text-button");
  previous.type = next.type = "button";
  const select = node("select", undefined, "page-select");
  select.setAttribute("aria-label", tx("انتخاب صفحه", "Select page"));
  nav.append(previous, select, next);
  view.append(nav);
  let available = [];

  function show(key) {
    const index = Math.max(0, available.findIndex(page => page.dataset.panelPage === key));
    const active = available[index];
    for (const page of pages) page.hidden = page !== active;
    select.value = active.dataset.panelPage;
    previous.disabled = index === 0;
    next.disabled = index === available.length - 1;
  }

  function refresh() {
    pages = [...view.querySelectorAll("[data-panel-page]")];
    nav.setAttribute("aria-label", tx("صفحه‌های این بخش", "Pages in this section"));
    previous.textContent = tx("قبلی", "Previous");
    next.textContent = tx("بعدی", "Next");
    select.setAttribute("aria-label", tx("انتخاب صفحه", "Select page"));
    const prior = select.value;
    available = pages.filter(page => !page.closest("[data-optional-pages][hidden]"));
    select.replaceChildren(...available.map(page => new Option(page.dataset.pageTitle, page.dataset.panelPage)));
    show(prior);
  }

  function move(offset, button) {
    show(available[select.selectedIndex + offset].dataset.panelPage);
    if (button.disabled) select.focus();
  }

  previous.addEventListener("click", () => move(-1, previous));
  next.addEventListener("click", () => move(1, next));
  select.addEventListener("change", () => show(select.value));
  refresh();
  return { refresh };
}

function selectedScenario() {
  return scenarios.find(item => item.id === caseSelect.value) ?? scenarios[0];
}

function selectedCondition() {
  return conditions.find(item => item.id === conditionSelect.value) ?? conditions[0];
}

function format(value, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function buildControls(definitions, selector, elements, values) {
  for (const config of definitions) {
    const wrapper = node("div", undefined, "setting");
    const input = node("input");
    input.type = "range";
    input.id = "control-" + config.key;
    input.min = config.min;
    input.max = config.max;
    input.step = config.step ?? 1;
    input.setAttribute("aria-label", tx(config.name, config.nameEn ?? config.name));
    const label = node("label");
    label.htmlFor = input.id;
    const abbreviation = node("abbr", tx(config.label, config.labelEn ?? config.label));
    abbreviation.title = tx(config.name, config.nameEn ?? config.name);
    const output = node("output");
    output.htmlFor = input.id;
    label.append(abbreviation, output);
    wrapper.append(label, input);
    find(selector).append(wrapper);
    elements.set(config.key, { input, output, wrapper, abbreviation });

    input.addEventListener("input", () => {
      values[config.key] = Number(input.value);
      render();
    });
  }
}

function updateControls(heartRate) {
  const spontaneous = ["CPAP", "BILEVEL"].includes(settings.mode);
  const intermittent = settings.mode === "SIMV";
  for (const config of controlDefinitions) {
    const { input, output, wrapper, abbreviation } = controlElements.get(config.key);
    abbreviation.title = tx(config.name, config.nameEn ?? config.name);
    input.setAttribute("aria-label", abbreviation.title);
    const value = config.key === "heartRate" ? heartRate : settings[config.key];
    input.value = value;
    const display = config.format?.(value) ?? value;
    output.value = display;
    input.setAttribute("aria-valuetext", String(display));
    wrapper.hidden = Boolean(config.modes && !config.modes.includes(settings.mode));
    if (config.key === "rr") {
      const label = spontaneous ? tx("تعداد تنفس خودبه‌خودی مدل", "Modelled spontaneous respiratory rate") : intermittent ? tx("تعداد نفس اجباری تنظیم‌شده", "Set mandatory respiratory rate") : tx(config.name, config.nameEn ?? config.name);
      abbreviation.textContent = intermittent ? "RR set" : config.label;
      abbreviation.title = label;
      input.setAttribute("aria-label", label);
    }
    if (config.key === "peep") abbreviation.textContent = settings.mode === "BILEVEL" ? "EPAP" : settings.mode === "CPAP" ? "CPAP" : config.label;
  }
}

function updateMonitor(metrics, scenario, mode) {
  setText("#monitor-mode", mode.short);
  setText("#monitor-case", scenario.title);
  find("#monitor-case").title = scenario.title;
  setText("#metric-peak", format(metrics.peak, 1));
  setText("#metric-plateau", format(metrics.plateau, 1));
  setText("#metric-vt", format(metrics.tidalVolume));
  setText("#metric-ve", format(metrics.minuteVentilation, 1));
  setText("#metric-auto-peep", format(metrics.intrinsicPeep, 1));
  setText("#monitor-rr", format(metrics.breathsPerMinute, 1).replace(/\.0$/, ""));
  const seconds = Number.isFinite(metrics.expiratoryTime) ? format(metrics.expiratoryTime, 2) : "—";
  setText("#monitor-note", tx("زمان بازدم ", "Expiratory time ") + seconds + tx(" ثانیه · ", " s · ") + mode.watch);
}

function updateLab(gas, scenario, condition, heartRate) {
  setText("#gas-ph", format(gas.ph, 2));
  setText("#gas-paco2", format(gas.paco2, 1));
  setText("#gas-pao2", format(gas.pao2));
  setText("#gas-hco3", format(gas.hco3, 1));
  setText("#gas-spo2", format(gas.spo2));
  setText("#monitor-spo2", format(gas.spo2));
  const gasNote = find("#gas-note");
  const gasMessage = {
    "insufficient-ventilation": tx("در این وضعیت، تهویهٔ مؤثر برای برآورد گازهای خون در حالت پایدار کافی نیست.", "Effective ventilation is insufficient for a steady-state blood gas estimate in this model."),
    "oxygen-extraction-limit": tx("در این وضعیت مدل نمی‌تواند اکسیژن شریانی را برآورد کند.", "The model cannot estimate arterial oxygen under these conditions."),
  }[gas.status] ?? "";
  if (gasMessage !== gasNote.textContent) gasNote.textContent = gasMessage;
  gasNote.hidden = !gasMessage;
  let phState = "—";
  if (Number.isFinite(gas.ph)) {
    phState = gas.ph < 7.35 ? tx("اسیدمی", "Acidemia") : gas.ph > 7.45 ? tx("آلکالمی", "Alkalemia") : tx("محدودهٔ معمول", "Typical range");
  }
  setText("#ph-state", phState);
  setText("#cardiac-output", format(scenario.cardiacOutput, 1) + " L/min");
  setText("#heart-rate", heartRate + " bpm");
  setText("#monitor-heart-rate", heartRate);
  organMotion.setHeartRate(heartRate);
  organMotion.setCondition(condition.id);
  setText("#shunt-value", Number.isFinite(gas.effectiveShunt) ? format(gas.effectiveShunt * 100) + "%" : "—");
  setText("#alveolar-ventilation", Number.isFinite(gas.alveolarVentilation) ? format(gas.alveolarVentilation, 1) + " L/min" : "—");
  setText("#alveolar-oxygen", Number.isFinite(gas.alveolarOxygen) ? format(gas.alveolarOxygen) + " mmHg" : "—");
  setText("#condition-description", condition.description);
  find("#control-hco3").value = scenario.hco3;
  find("#value-hco3").value = format(scenario.hco3);
}

function renderScenario(scenario) {
  if (renderedScenario === scenario.id) return;
  renderedScenario = scenario.id;
  setText("#case-title", scenario.title);
  setText("#case-summary", scenario.summary);
  setText("#case-clinic", scenario.clinic);

  const { training } = scenario;
  const source = find("#case-source");
  source.href = scenario.source.url;
  source.textContent = scenario.source.label + " ↗";
  source.hidden = Boolean(training);
  find("#case-training").hidden = !training;
  pagers.get("#device-settings-view").refresh();
  if (!training) return;

  setText("#case-presentation", training.presentation);
  setText("#case-challenge", training.challenge);
  setText("#case-answer", training.answer);
  setText("#case-limitations", training.limitations);
  const references = training.references.map(reference => {
    const item = node("li");
    item.append(makeSourceLink(reference), node("p", reference.note));
    return item;
  });
  find("#case-training-references").replaceChildren(...references);
}

function renderAirway(airway) {
  const state = airwayTraining.states.find(state => state.id === airway.id);
  const active = airway.id !== "clear";
  const blocked = airway.id === "blocked";
  airwaySelect.value = airway.id;
  const { input, output } = airwayElements.get("airwaySeverity");
  input.disabled = !active || blocked;
  input.value = airway.severity;
  output.value = format(airway.severity);
  input.setAttribute("aria-valuetext", output.value + tx(" از ۱۰۰ در مقیاس تمرین", " of 100 on an educational scale"));
  setText("#airway-description", state.description);
  const resistance = value => Number.isFinite(value) ? format(value, 1) + " cmH₂O/(L/s)" : "—";
  setText("#airway-resistance-in", resistance(airway.addedInspiratoryResistance));
  setText("#airway-resistance-out", resistance(airway.addedExpiratoryResistance));
  const tube = find("#airway-tube");
  tube.dataset.airway = airway.severity > 0 ? state.id : "clear";
  tube.style.setProperty("--airway-opening", (blocked ? 0 : 100 - airway.severity * 0.72) + "%");
  const status = find("#airway-status");
  status.hidden = !active || airway.severity === 0;
  status.textContent = state.badge ?? state.title;
  status.setAttribute("aria-label", state.title);
  find("#pressure-unit").hidden = blocked;
  find("#pressure-unavailable").hidden = !blocked;
}

function render() {
  const base = selectedScenario();
  const condition = selectedCondition();
  const scenario = { ...base, ...base.effects?.[condition.id], ...mechanicsOverrides };
  if (bicarbonate !== null) scenario.hco3 = bicarbonate;
  const mode = modes.find(item => item.id === settings.mode) ?? modes[0];
  const { samples, metrics, gas, airway } = simulate(scenario, settings);
  const heartRate = settings.heartRate ?? (condition.id === "rapid-rhythm" ? 145 : 78);

  updateControls(heartRate);
  for (const [key, { input, output }] of mechanicsElements) {
    input.value = scenario[key];
    output.value = format(scenario[key]);
  }
  find("#mechanics-override-note").hidden = !Object.keys(mechanicsOverrides).length;
  setText("#mode-code", mode.short);
  setText("#mode-description", mode.description);
  renderScenario(base);
  organMotion.setBreathingPattern(samples[0]);
  chart.replace(samples);
  updateMonitor(metrics, base, mode);
  updateLab(gas, scenario, condition, heartRate);
  renderAirway(airway);
}

function resetSettings() {
  conditionSelect.value = conditions[0].id;
  bicarbonate = null;
  resetMechanics();
  Object.assign(settings, defaults, selectedScenario().defaults);
  modeSelect.value = settings.mode;
  render();
}

function resetMechanics() {
  for (const { key } of mechanicsDefinitions) delete mechanicsOverrides[key];
}

function showView(lessonVisible) {
  find("#simulator-view").hidden = lessonVisible;
  find("#lesson-view").hidden = !lessonVisible;
  find("#tab-simulator").classList.toggle("selected", !lessonVisible);
  find("#tab-lesson").classList.toggle("selected", lessonVisible);
  find("#tab-simulator").setAttribute("aria-pressed", String(!lessonVisible));
  find("#tab-lesson").setAttribute("aria-pressed", String(lessonVisible));
  (lessonVisible ? find("#lesson-title") : find("#simulator-title")).focus({ preventScroll: true });
}

function showDeviceTab(active) {
  for (const button of deviceTabs) {
    const selected = button === active;
    button.setAttribute("aria-pressed", String(selected));
    document.getElementById(button.getAttribute("aria-controls")).hidden = !selected;
  }
  find("#controls").hidden = active.id !== "device-monitor-tab";
}

function setPaused(paused) {
  chart.setPaused(paused);
  organMotion.setPaused(paused);
  const name = paused ? tx("اجرای نمایش موج‌ها و اندام‌ها", "Resume waveforms and organ animation") : tx("توقف نمایش موج‌ها و اندام‌ها", "Pause waveforms and organ animation");
  pauseButton.title = name;
  pauseButton.setAttribute("aria-label", name);
  pauseButton.setAttribute("aria-pressed", String(paused));
  const status = find("#monitor-status");
  status.classList.toggle("paused", paused);
  status.lastElementChild.textContent = paused ? tx("متوقف", "Paused") : tx("در حال اجرا", "Running");
}

function appendSources(list, sources) {
  for (const source of sources) {
    const item = node("li");
    item.append(makeSourceLink(source));
    list.append(item);
  }
}

const coursePages = [];

function courseTable(headers, rows) {
  const table = node("table", undefined, "course-table");
  const head = node("thead");
  const headings = node("tr");
  for (const heading of headers) headings.append(node("th", heading));
  head.append(headings);
  const body = node("tbody");
  for (const row of rows) {
    const tr = node("tr");
    for (const value of row) tr.append(node("td", value));
    body.append(tr);
  }
  table.append(head, body);
  return table;
}

function courseList(items, className) {
  const list = node("ul", undefined, className);
  for (const item of items) list.append(node("li", item));
  return list;
}

function appendCoursePages(addPage) {
  for (const chapter of courseChapters) {
    coursePages.push(addPage(chapter.id + "-opening", chapter.title, node("p", chapter.lead)));
    for (const [index, section] of chapter.sections.entries()) {
      if (section.table) {
        for (let start = 0; start < section.table.rows.length; start += 2) {
          coursePages.push(addPage(
            chapter.id + "-table-" + index + "-" + start,
            section.heading,
            courseTable(section.table.headers, section.table.rows.slice(start, start + 2)),
          ));
        }
      }
      for (const [offset, paragraph] of (section.paragraphs || []).entries()) {
        coursePages.push(addPage(chapter.id + "-text-" + index + "-" + offset, section.heading, node("p", paragraph)));
      }
      if (section.bullets) {
        for (let start = 0; start < section.bullets.length; start += 2) {
          coursePages.push(addPage(chapter.id + "-bullets-" + index + "-" + start, section.heading, courseList(section.bullets.slice(start, start + 2), "course-points")));
        }
      }
    }
    coursePages.push(addPage(chapter.id + "-example", tx("مثال حل شده · ", "Worked example · ") + chapter.title,
      node("p", chapter.workedExample.prompt), courseList(chapter.workedExample.steps, "course-points")));
    coursePages.push(addPage(chapter.id + "-summary", tx("خلاصه · ", "Summary · ") + chapter.title,
      courseList(chapter.summary, "course-points")));
    const checkpoint = node("div", undefined, "course-checkpoint");
    const reveal = node("button", tx("نمایش پاسخ", "Show answer"), "secondary-button");
    reveal.type = "button";
    const answer = node("p", chapter.checkpoint.answer);
    answer.hidden = true;
    reveal.addEventListener("click", () => { answer.hidden = false; reveal.hidden = true; });
    checkpoint.append(node("p", chapter.checkpoint.prompt), reveal, answer);
    coursePages.push(addPage(chapter.id + "-checkpoint", tx("خودآزمایی · ", "Self-check · ") + chapter.title, checkpoint));
    for (let start = 0; start < chapter.glossary.length; start += 3) {
      const entries = chapter.glossary.slice(start, start + 3).map(item => {
        const entry = node("div", undefined, "course-term");
        entry.append(node("strong", item.term), node("p", item.definition));
        return entry;
      });
      coursePages.push(addPage(chapter.id + "-glossary-" + start, tx("واژه نامه · ", "Glossary · ") + chapter.title, ...entries));
    }
    const references = node("ul", undefined, "reader-references");
    appendSources(references, chapter.sources);
    coursePages.push(addPage(chapter.id + "-sources", tx("منابع · ", "References · ") + chapter.title, references));
  }
}

function downloadHandbook() {
  const chapters = coursePages.map(page => {
    const copy = page.cloneNode(true);
    copy.hidden = false;
    for (const element of copy.querySelectorAll("[hidden]")) element.hidden = false;
    for (const button of copy.querySelectorAll("button")) button.remove();
    return copy.outerHTML;
  }).join("\n");
  const style = `@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;direction:${language === "en" ? "ltr" : "rtl"};color:#102533;background:#e9f4f5;line-height:1.8;margin:0;padding:24px}main{max-width:850px;margin:auto}header{background:#0b2534;color:white;padding:24px;border-radius:14px;margin-bottom:20px}h1{font-size:1.8rem;margin:0}h2{color:#086a75;font-size:1.22rem;margin:0 0 12px}section{background:white;padding:20px;margin:12px 0;border-radius:12px;break-inside:avoid}p{margin:8px 0}table{border-collapse:collapse;width:100%;font-size:.89rem}td,th{border:1px solid #bfd4da;padding:9px;vertical-align:top}th{background:#d9eef0}li{margin:5px 0}a{color:#086a75}.course-term{padding:8px;border-bottom:1px solid #d9eef0}@media print{body{background:white;padding:0}header,section{border-radius:0;box-shadow:none}}`;
  const html = `<!doctype html><html lang="${language}" dir="${language === "en" ? "ltr" : "rtl"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${tx("جزوه آموزشی ونتیلاتور", "Ventilator learning handbook")}</title><style>${style}</style><main><header><h1>${tx("جزوه آموزشی ونتیلاتور", "Ventilator learning handbook")}</h1><p>${tx("حجم ها، تهویه آلوئولی و مکانیک تنفس", "Lung volumes, alveolar ventilation and respiratory mechanics")}</p></header>${chapters}</main></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = node("a");
  link.href = url;
  link.download = "ventilator-course-" + language + ".html";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function buildLesson() {
  setText("#lesson-title", lesson.title);
  setText("#lesson-intro", lesson.intro);
  const pages = find("#lesson-view .paged-pages");
  const quiz = find("#quiz-prompt").closest("section");
  for (const page of pages.querySelectorAll("[data-panel-page]")) if (page !== quiz && page.dataset.panelPage !== "intro") page.remove();
  coursePages.length = 0;

  function addPage(key, title, ...content) {
    const page = node("section", undefined, "lesson-panel");
    page.dataset.panelPage = key;
    page.dataset.pageTitle = title;
    page.hidden = true;
    page.append(node("h2", title), ...content);
    pages.append(page);
    return page;
  }

  for (const [index, volume] of lesson.volumes.entries()) {
    if (index % 2 !== 0) continue;
    const key = index < 4 ? "volumes" : "capacities";
    const number = (index % 4) / 2 + 1;
    const entries = lesson.volumes.slice(index, index + 2).map(item => {
      const entry = node("article", undefined, "volume-entry");
      const abbreviation = node("span", item.abbr, "mono");
      abbreviation.dir = "ltr";
      entry.append(abbreviation, node("h3", item.name), node("strong", item.value), node("p", item.definition));
      return entry;
    });
    addPage(key + "-" + number, volume.abbr + tx(" و ", " and ") + lesson.volumes[index + 1].abbr, ...entries);
  }
  pages.append(quiz);
  appendCoursePages(addPage);
  for (const [index, concept] of lesson.concepts.entries()) {
    addPage("concept-" + (index + 1), concept.title, node("p", concept.body));
  }
  for (const mode of modes) {
    addPage("mode-" + mode.id, mode.short + " · " + mode.title, node("p", mode.description), node("p", mode.uses), node("p", mode.watch));
  }
  for (let start = 0; start < lesson.sources.length; start += 4) {
    const number = start / 4 + 1;
    const list = node("ul", undefined, "reader-references");
    appendSources(list, lesson.sources.slice(start, start + 4));
    addPage("sources-" + number, tx("منابع درس ", "Lesson references ") + number, list);
  }
  buildQuiz();
}

function buildQuiz() {
  const { prompt, options, correct, explanation } = lesson.question;
  const container = find("#quiz-options");
  const feedback = find("#quiz-feedback");
  setText("#quiz-prompt", prompt);

  container.replaceChildren();
  feedback.hidden = true;
  options.forEach((option, index) => {
    const answer = node("button", option, "quiz-option");
    answer.type = "button";
    answer.setAttribute("aria-pressed", "false");
    answer.addEventListener("click", () => {
      for (const button of container.children) {
        button.classList.remove("correct", "incorrect");
        button.setAttribute("aria-pressed", "false");
      }
      const isCorrect = index === correct;
      answer.classList.add(isCorrect ? "correct" : "incorrect");
      answer.setAttribute("aria-pressed", "true");
      feedback.hidden = false;
      feedback.textContent = isCorrect ? tx("درست است. ", "Correct. ") + explanation : tx("دوباره تلاش کن. به حجم باقی‌مانده پس از یک بازدم معمولی فکر کن.", "Try again. Think about the air left after a normal exhalation.");
    });
    container.append(answer);
  });
}

const staticValues = new WeakMap();
function applyStaticLanguage() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "en" ? "ltr" : "rtl";
  const attributes = ["aria-label", "title", "alt", "content", "href", "page-title"];
  const elements = document.querySelectorAll("[data-en], [data-en-aria-label], [data-en-title], [data-en-alt], [data-en-content], [data-en-href], [data-en-page-title]");
  for (const element of elements) {
    let originals = staticValues.get(element);
    if (!originals) {
      originals = { text: element.textContent };
      for (const attribute of attributes) originals[attribute] = attribute === "page-title" ? element.dataset.pageTitle : element.getAttribute(attribute);
      staticValues.set(element, originals);
    }
    if (element.hasAttribute("data-en")) element.textContent = language === "en" ? element.dataset.en : originals.text;
    for (const attribute of attributes) {
      const english = element.getAttribute("data-en-" + attribute);
      if (english === null) continue;
      const value = language === "en" ? english : originals[attribute];
      if (attribute === "page-title") element.dataset.pageTitle = value;
      else if (value === null) element.removeAttribute(attribute);
      else element.setAttribute(attribute, value);
    }
  }
  const button = find("#language-toggle");
  if (button) {
    button.textContent = language === "en" ? "فارسی" : "EN";
    button.setAttribute("aria-label", tx("تغییر زبان به انگلیسی", "Switch language to Persian"));
    button.title = button.getAttribute("aria-label");
  }
}

function switchLanguage(next) {
  if (next === language) return;
  language = next;
  try { localStorage.setItem("ventilator-language", language); } catch {}
  ({ airwayTraining, courseChapters, lesson, scenarios, conditions, modes } = language === "en" ? contentEn : contentFa);
  applyStaticLanguage();
  for (const [select, items, label] of [
    [caseSelect, scenarios, item => item.title],
    [conditionSelect, conditions, item => item.title],
    [modeSelect, modes, item => item.short + " — " + item.title],
    [airwaySelect, airwayTraining.states, item => item.title],
  ]) {
    const selected = select.value;
    fillSelect(select, items, label);
    select.value = selected;
  }
  for (const config of [...mechanicsDefinitions, ...controlDefinitions]) {
    const control = (mechanicsElements.get(config.key) ?? controlElements.get(config.key));
    control.abbreviation.textContent = tx(config.label, config.labelEn ?? config.label);
    control.abbreviation.title = tx(config.name, config.nameEn ?? config.name);
    control.input.setAttribute("aria-label", control.abbreviation.title);
  }
  const severity = airwayElements.get("airwaySeverity");
  severity.abbreviation.textContent = tx("شدت فرضی تنگی", "Narrowing severity");
  severity.abbreviation.title = tx("شدت تنگی در مقیاس آموزشی", "Illustrative airway narrowing severity");
  severity.input.setAttribute("aria-label", severity.abbreviation.title);
  const airwaySources = find("#airway-sources");
  airwaySources.replaceChildren();
  appendSources(airwaySources, airwayTraining.sources);
  buildLesson();
  for (const pager of pagers.values()) pager.refresh();
  renderedScenario = null;
  setPaused(chart.paused);
  render();
  updateFullscreenLabel();
}

function updateFullscreenLabel() {
  const button = find("#fullscreen-toggle");
  const fullscreen = Boolean(document.fullscreenElement);
  button.setAttribute("aria-pressed", String(fullscreen));
  button.lastElementChild.textContent = fullscreen ? tx("خروج از تمام‌صفحه", "Exit fullscreen") : tx("تمام‌صفحه", "Fullscreen");
}

applyStaticLanguage();
find("#language-toggle")?.addEventListener("click", () => switchLanguage(language === "en" ? "fa" : "en"));
fillSelect(caseSelect, scenarios, scenario => scenario.title);
fillSelect(conditionSelect, conditions, condition => condition.title);
fillSelect(modeSelect, modes, mode => mode.short + " — " + mode.title);
fillSelect(airwaySelect, airwayTraining.states, state => state.title);
caseSelect.value = "normal";
buildControls(controlDefinitions, "#controls", controlElements, settings);
buildControls(mechanicsDefinitions, "#mechanic-controls", mechanicsElements, mechanicsOverrides);
buildControls(
  [{ key: "airwaySeverity", label: "شدت فرضی تنگی", labelEn: "Narrowing severity", name: "شدت تنگی در مقیاس آموزشی", nameEn: "Illustrative airway narrowing severity", min: 0, max: 100 }],
  "#airway-control-group", airwayElements, settings,
);
appendSources(find("#airway-sources"), airwayTraining.sources);
buildLesson();
find("#download-handbook").addEventListener("click", downloadHandbook);
for (const selector of ["#device-settings-view", "#device-airway-view", "#device-physiology-view", "#lesson-view"]) {
  pagers.set(selector, createPager(find(selector)));
}
resetSettings();
setPaused(chart.paused);

caseSelect.addEventListener("change", () => resetSettings());
conditionSelect.addEventListener("change", () => {
  settings.heartRate = null;
  render();
});
modeSelect.addEventListener("change", () => {
  settings.mode = modeSelect.value;
  render();
});
airwaySelect.addEventListener("change", () => {
  settings.airway = airwaySelect.value;
  render();
});
find("#control-hco3").addEventListener("input", event => {
  bicarbonate = Number(event.target.value);
  render();
});
find("#reset-monitor").addEventListener("click", () => resetSettings());
pauseButton.addEventListener("click", () => setPaused(!chart.paused));
find("#tab-simulator").addEventListener("click", () => showView(false));
find("#tab-lesson").addEventListener("click", () => showView(true));
find("#open-simulator").addEventListener("click", () => showView(false));
for (const [button, tab] of [
  ["#case-open-monitor", "#device-monitor-tab"],
  ["#airway-open-monitor", "#device-monitor-tab"],
  ["#airway-status", "#device-airway-tab"],
]) {
  find(button).addEventListener("click", () => {
    const target = find(tab);
    showDeviceTab(target);
    target.focus();
  });
}
for (const button of deviceTabs) button.addEventListener("click", () => showDeviceTab(button));

const fullscreenButton = find("#fullscreen-toggle");
if (document.fullscreenEnabled) {
  fullscreenButton.hidden = false;
  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      fullscreenButton.hidden = true;
    }
  });
  document.addEventListener("fullscreenchange", updateFullscreenLabel);
}
