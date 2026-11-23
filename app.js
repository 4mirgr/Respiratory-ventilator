import { airwayTraining, lesson, scenarios, conditions, modes } from "./content.js?v=4-airway";
import { simulate } from "./model.js?v=4-airway";
import { createWaveforms } from "./waveforms.js?v=4-airway";
import { createOrganMotion } from "./organ-motion.js?v=4-airway";

const find = selector => document.querySelector(selector);
const defaults = {
  mode: "VC", rr: 14, vt: 450, peep: 5, fio2: 21, ie: 2, inspPressure: 12, pressureSupport: 8,
  heartRate: null, airway: "clear", airwaySeverity: 50,
};
const settings = { ...defaults };
const controlDefinitions = [
  { key: "rr", label: "RR", name: "تعداد تنفس در دقیقه", min: 6, max: 35, step: 1 },
  { key: "vt", label: "Vₜ", name: "حجم جاری هدف بر حسب میلی‌لیتر", min: 200, max: 800, step: 5, modes: ["VC", "SIMV"] },
  { key: "peep", label: "PEEP", name: "فشار مثبت انتهای بازدم", min: 0, max: 20, step: 1 },
  { key: "fio2", label: "FiO₂", name: "درصد اکسیژن دمی", min: 21, max: 100, step: 1, format: value => value + "%" },
  { key: "ie", label: "I:E", name: "نسبت زمان دم به بازدم", min: 0.5, max: 5, step: 0.5, format: value => "1:" + value },
  { key: "inspPressure", label: "ΔPinsp", name: "فشار دمی بالاتر از فشار بازدمی", min: 4, max: 28, step: 1, modes: ["PC", "BILEVEL"] },
  { key: "pressureSupport", label: "PS", name: "فشار حمایتی در تنفس خودبه‌خودی", min: 0, max: 24, step: 1, modes: ["SIMV"] },
  { key: "heartRate", label: "HR", name: "ضربان قلب در نمای شماتیک، بر حسب ضربان در دقیقه", min: 35, max: 190, step: 1 },
];
const mechanicsDefinitions = [
  { key: "compliance", label: "کامپلاینس", name: "کامپلاینس دستگاه تنفسی بر حسب میلی‌لیتر بر سانتی‌متر آب", min: 15, max: 100 },
  { key: "resistance", label: "مقاومت", name: "مقاومت راه هوایی بر حسب سانتی‌متر آب بر لیتر در ثانیه", min: 4, max: 40 },
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
  const phase = sample.flow > 0.75 ? "دم" : sample.flow < -0.75 ? "بازدم" : "جریان کم";
  for (const indicator of breathIndicators) {
    if (indicator.textContent !== phase) {
      indicator.textContent = phase;
      indicator.dataset.phase = phase === "دم" ? "inspiration" : phase === "بازدم" ? "expiration" : "low";
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
  for (const item of items) select.add(new Option(label(item), item.id));
}

function createPager(view) {
  const pages = [...view.querySelectorAll("[data-panel-page]")];
  const nav = node("nav", undefined, "page-navigation");
  nav.setAttribute("aria-label", "صفحه‌های این بخش");
  const previous = node("button", "قبلی", "text-button");
  const next = node("button", "بعدی", "text-button");
  previous.type = next.type = "button";
  const select = node("select", undefined, "page-select");
  select.setAttribute("aria-label", "انتخاب صفحه");
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
    input.setAttribute("aria-label", config.name);
    const label = node("label");
    label.htmlFor = input.id;
    const abbreviation = node("abbr", config.label);
    abbreviation.title = config.name;
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
    const value = config.key === "heartRate" ? heartRate : settings[config.key];
    input.value = value;
    const display = config.format?.(value) ?? value;
    output.value = display;
    input.setAttribute("aria-valuetext", String(display));
    wrapper.hidden = Boolean(config.modes && !config.modes.includes(settings.mode));
    if (config.key === "rr") {
      const label = spontaneous ? "تعداد تنفس خودبه‌خودی مدل" : intermittent ? "تعداد نفس اجباری تنظیم‌شده" : config.name;
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
  setText("#metric-peak", format(metrics.peak, 1));
  setText("#metric-plateau", format(metrics.plateau, 1));
  setText("#metric-vt", format(metrics.tidalVolume));
  setText("#metric-ve", format(metrics.minuteVentilation, 1));
  setText("#metric-auto-peep", format(metrics.intrinsicPeep, 1));
  setText("#monitor-rr", format(metrics.breathsPerMinute, 1).replace(/\.0$/, ""));
  const seconds = Number.isFinite(metrics.expiratoryTime) ? format(metrics.expiratoryTime, 2) : "—";
  setText("#monitor-note", "زمان بازدم " + seconds + " ثانیه · " + mode.watch);
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
    "insufficient-ventilation": "در این وضعیت، تهویهٔ مؤثر برای برآورد گازهای خون در حالت پایدار کافی نیست.",
    "oxygen-extraction-limit": "در این وضعیت مدل نمی‌تواند اکسیژن شریانی را برآورد کند.",
  }[gas.status] ?? "";
  if (gasMessage !== gasNote.textContent) gasNote.textContent = gasMessage;
  gasNote.hidden = !gasMessage;
  let phState = "—";
  if (Number.isFinite(gas.ph)) {
    phState = gas.ph < 7.35 ? "اسیدمی" : gas.ph > 7.45 ? "آلکالمی" : "محدودهٔ معمول";
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
  input.setAttribute("aria-valuetext", output.value + " از ۱۰۰ در مقیاس تمرین");
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
  const name = paused ? "اجرای نمایش موج‌ها و اندام‌ها" : "توقف نمایش موج‌ها و اندام‌ها";
  pauseButton.title = name;
  pauseButton.setAttribute("aria-label", name);
  pauseButton.setAttribute("aria-pressed", String(paused));
  const status = find("#monitor-status");
  status.classList.toggle("paused", paused);
  status.lastElementChild.textContent = paused ? "متوقف" : "در حال اجرا";
}

function appendSources(list, sources) {
  for (const source of sources) {
    const item = node("li");
    item.append(makeSourceLink(source));
    list.append(item);
  }
}

function buildLesson() {
  setText("#lesson-title", lesson.title);
  setText("#lesson-intro", lesson.intro);
  const pages = find("#lesson-view .paged-pages");
  const quiz = find("#quiz-prompt").closest("section");

  function addPage(key, title, ...content) {
    const page = node("section", undefined, "lesson-panel");
    page.dataset.panelPage = key;
    page.dataset.pageTitle = title;
    page.hidden = true;
    page.append(node("h2", title), ...content);
    pages.append(page);
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
    addPage(key + "-" + number, volume.abbr + " و " + lesson.volumes[index + 1].abbr, ...entries);
  }
  pages.append(quiz);
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
    addPage("sources-" + number, "منابع درس " + number, list);
  }
  buildQuiz();
}

function buildQuiz() {
  const { prompt, options, correct, explanation } = lesson.question;
  const container = find("#quiz-options");
  const feedback = find("#quiz-feedback");
  setText("#quiz-prompt", prompt);

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
      feedback.textContent = isCorrect ? "درست است. " + explanation : "دوباره تلاش کن. به حجم باقی‌مانده پس از یک بازدم معمولی فکر کن.";
    });
    container.append(answer);
  });
}

fillSelect(caseSelect, scenarios, scenario => scenario.title);
fillSelect(conditionSelect, conditions, condition => condition.title);
fillSelect(modeSelect, modes, mode => mode.short + " — " + mode.title);
fillSelect(airwaySelect, airwayTraining.states, state => state.title);
caseSelect.value = "normal";
buildControls(controlDefinitions, "#controls", controlElements, settings);
buildControls(mechanicsDefinitions, "#mechanic-controls", mechanicsElements, mechanicsOverrides);
buildControls(
  [{ key: "airwaySeverity", label: "شدت فرضی تنگی", name: "شدت تنگی در مقیاس آموزشی", min: 0, max: 100 }],
  "#airway-control-group", airwayElements, settings,
);
appendSources(find("#airway-sources"), airwayTraining.sources);
buildLesson();
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
  document.addEventListener("fullscreenchange", () => {
    const fullscreen = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute("aria-pressed", String(fullscreen));
    fullscreenButton.lastElementChild.textContent = fullscreen ? "خروج از تمام‌صفحه" : "تمام‌صفحه";
  });
}
