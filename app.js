import { lesson, scenarios, conditions, modes } from "./content.js";
import { simulate } from "./model.js";
import { createWaveforms } from "./waveforms.js";

const find = selector => document.querySelector(selector);
const defaults = { mode: "VC", rr: 14, vt: 450, peep: 5, fio2: 21, ie: 2, inspPressure: 12, pressureSupport: 8 };
const settings = { ...defaults };
const controlDefinitions = [
  { key: "rr", label: "RR", name: "تعداد تنفس در دقیقه", min: 6, max: 35, step: 1 },
  { key: "vt", label: "Vₜ", name: "حجم جاری هدف بر حسب میلی‌لیتر", min: 200, max: 800, step: 5, modes: ["VC", "SIMV"] },
  { key: "peep", label: "PEEP", name: "فشار مثبت انتهای بازدم", min: 0, max: 20, step: 1 },
  { key: "fio2", label: "FiO₂", name: "درصد اکسیژن دمی", min: 21, max: 100, step: 1, format: value => value + "%" },
  { key: "ie", label: "I:E", name: "نسبت زمان دم به بازدم", min: 0.5, max: 5, step: 0.5, format: value => "1:" + value },
  { key: "inspPressure", label: "ΔPinsp", name: "فشار دمی بالاتر از فشار بازدمی", min: 4, max: 28, step: 1, modes: ["PC", "BILEVEL"] },
  { key: "pressureSupport", label: "PS", name: "فشار حمایتی در تنفس خودبه‌خودی", min: 0, max: 24, step: 1, modes: ["SIMV"] },
];
const mechanicsDefinitions = [
  { key: "compliance", label: "کامپلاینس", name: "کامپلاینس دستگاه تنفسی بر حسب میلی‌لیتر بر سانتی‌متر آب", min: 15, max: 100 },
  { key: "resistance", label: "مقاومت", name: "مقاومت راه هوایی بر حسب سانتی‌متر آب بر لیتر در ثانیه", min: 4, max: 40 },
];
const controlElements = new Map();
const mechanicsElements = new Map();
const mechanicsOverrides = {};
const caseSelect = find("#case-select");
const conditionSelect = find("#condition-select");
const modeSelect = find("#mode-select");
const pauseButton = find("#pause-monitor");
const breathPhase = find("#breath-phase");
const organImage = find("#organ-image");
let bicarbonate = null;

const chart = createWaveforms(sample => {
  const phase = sample.flow > 0.75 ? "دم" : sample.flow < -0.75 ? "بازدم" : "جریان نزدیک صفر";
  if (breathPhase.textContent !== phase) breathPhase.textContent = phase;
  organImage.style.transform = "scale(" + (1 + Math.max(0, Math.min(1400, sample.volume)) / 13500) + ")";
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

function fillSelect(select, items, label) {
  for (const item of items) select.add(new Option(label(item), item.id));
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

function updateControls() {
  const spontaneous = ["CPAP", "BILEVEL"].includes(settings.mode);
  for (const config of controlDefinitions) {
    const { input, output, wrapper, abbreviation } = controlElements.get(config.key);
    input.value = settings[config.key];
    const display = config.format?.(settings[config.key]) ?? settings[config.key];
    output.value = display;
    input.setAttribute("aria-valuetext", String(display));
    wrapper.hidden = Boolean(config.modes && !config.modes.includes(settings.mode));
    if (config.key === "rr") input.setAttribute("aria-label", spontaneous ? "تعداد تنفس خودبه‌خودی مدل" : config.name);
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
  const seconds = Number.isFinite(metrics.expiratoryTime) ? format(metrics.expiratoryTime, 2) : "—";
  setText("#monitor-note", "زمان بازدم " + seconds + " ثانیه · " + mode.watch);
}

function updateLab(gas, scenario, condition) {
  setText("#gas-ph", format(gas.ph, 2));
  setText("#gas-paco2", format(gas.paco2, 1));
  const oxygenInRange = Number.isFinite(gas.pao2) && gas.pao2 > 0.5;
  setText("#gas-pao2", oxygenInRange ? format(gas.pao2) : "—");
  setText("#gas-hco3", format(gas.hco3, 1));
  setText("#gas-spo2", oxygenInRange ? format(gas.spo2) : "—");
  find("#gas-note").hidden = oxygenInRange;
  let phState = "—";
  if (Number.isFinite(gas.ph)) {
    phState = gas.ph < 7.35 ? "اسیدمی" : gas.ph > 7.45 ? "آلکالمی" : "محدودهٔ معمول";
  }
  setText("#ph-state", phState);
  setText("#cardiac-output", format(scenario.cardiacOutput, 1) + " L/min");
  const heartRate = condition.id === "rapid-rhythm" ? 145 : 78;
  setText("#heart-rate", heartRate + " bpm");
  find("#heart-pulse").style.setProperty("--beat-period", 60 / heartRate + "s");
  setText("#shunt-value", Number.isFinite(gas.effectiveShunt) ? format(gas.effectiveShunt * 100) + "%" : "—");
  setText("#alveolar-ventilation", Number.isFinite(gas.alveolarVentilation) ? format(gas.alveolarVentilation, 1) + " L/min" : "—");
  setText("#alveolar-oxygen", gas.alveolarOxygen > 0.5 ? format(gas.alveolarOxygen) + " mmHg" : "—");
  setText("#condition-description", condition.description);
  find("#organ-image").dataset.condition = condition.id;
  find("#control-hco3").value = scenario.hco3;
  find("#value-hco3").value = format(scenario.hco3);
}

function render() {
  const base = selectedScenario();
  const condition = selectedCondition();
  const scenario = { ...base, ...base.effects?.[condition.id], ...mechanicsOverrides };
  if (bicarbonate !== null) scenario.hco3 = bicarbonate;
  const mode = modes.find(item => item.id === settings.mode) ?? modes[0];
  const { samples, metrics, gas } = simulate(scenario, settings);

  updateControls();
  for (const [key, { input, output }] of mechanicsElements) {
    input.value = scenario[key];
    output.value = format(scenario[key]);
  }
  setText("#mode-code", mode.short);
  setText("#mode-description", mode.description);
  setText("#case-title", base.title);
  setText("#case-summary", base.summary);
  setText("#case-clinic", base.clinic);
  const source = find("#case-source");
  source.href = base.source.url;
  source.textContent = base.source.label + " ↗";
  chart.replace(samples);
  updateMonitor(metrics, base, mode);
  updateLab(gas, scenario, condition);
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
  window.scrollTo(0, 0);
}

function setPaused(paused) {
  chart.setPaused(paused);
  const name = paused ? "اجرای نمایش موج‌ها" : "توقف نمایش موج‌ها";
  pauseButton.title = name;
  pauseButton.setAttribute("aria-label", name);
  pauseButton.setAttribute("aria-pressed", String(paused));
  find("#heart-pulse").style.animationPlayState = paused ? "paused" : "running";
  const status = find("#monitor-status");
  status.classList.toggle("paused", paused);
  status.lastElementChild.textContent = paused ? "متوقف" : "در حال اجرا";
}

function buildLesson() {
  setText("#lesson-title", lesson.title);
  setText("#lesson-intro", lesson.intro);
  const volumeList = find("#lesson-volumes");
  for (const volume of lesson.volumes) {
    const entry = node("article", undefined, "volume-entry");
    const abbreviation = node("span", volume.abbr, "mono");
    abbreviation.dir = "ltr";
    entry.append(abbreviation, node("h3", volume.name), node("strong", volume.value), node("p", volume.definition));
    volumeList.append(entry);
  }
  const concepts = find("#lesson-concepts");
  for (const concept of lesson.concepts) {
    const entry = node("article");
    entry.append(node("h3", concept.title), node("p", concept.body));
    concepts.append(entry);
  }
  const modeList = find("#lesson-modes");
  for (const mode of modes) {
    const entry = node("article");
    const heading = node("h3", mode.short + " · " + mode.title);
    entry.append(heading, node("p", mode.description), node("p", mode.uses), node("p", mode.watch));
    modeList.append(entry);
  }
  const sources = find("#lesson-sources");
  for (const source of lesson.sources) {
    const item = node("li");
    const link = node("a", source.label);
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    item.append(link);
    sources.append(item);
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
caseSelect.value = "normal";
buildControls(controlDefinitions, "#controls", controlElements, settings);
buildControls(mechanicsDefinitions, "#mechanic-controls", mechanicsElements, mechanicsOverrides);
buildLesson();
resetSettings();
setPaused(chart.paused);

caseSelect.addEventListener("change", () => resetSettings());
conditionSelect.addEventListener("change", () => {
  bicarbonate = null;
  resetMechanics();
  render();
});
modeSelect.addEventListener("change", () => {
  settings.mode = modeSelect.value;
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
find("#open-lesson").addEventListener("click", () => showView(true));
find("#open-simulator").addEventListener("click", () => showView(false));
