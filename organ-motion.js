const layers = [
  "organ-airway",
  "organ-root",
  "organ-vein",
  "organ-lung organ-left-lung",
  "organ-lung organ-right-lung",
  "organ-heart",
];

export function createOrganMotion() {
  const displays = [...document.querySelectorAll(".organ-display")];
  for (const display of displays) {
    const parts = layers.map(className => {
      const part = document.createElement("span");
      part.className = "organ-layer " + className;
      part.setAttribute("aria-hidden", "true");
      return part;
    });
    display.replaceChildren(...parts);
    display.setAttribute("role", "img");
    if (!display.hasAttribute("aria-label")) {
      display.setAttribute("aria-label", "نمای متحرک آموزشی ریه‌ها، نای و قلب");
    }
  }

  let paused = false;
  let lastDirection = 0;
  let endExpiratoryVolume = null;
  let previousVolume = null;
  let previousScale = null;
  let previousHeartRate = null;

  return {
    updateBreath(sample) {
      if (!Number.isFinite(sample?.volume) || (paused && previousScale !== null)) return;
      const volume = Math.max(0, sample.volume);
      const direction = Math.abs(sample.flow) > 0.75 ? Math.sign(sample.flow) : 0;
      // Measure excursion from the latest trough so an obstructed lung with
      // trapped air still shows its tidal movement superimposed on distention.
      if (endExpiratoryVolume === null || (direction > 0 && lastDirection < 0)) {
        endExpiratoryVolume = Math.min(volume, previousVolume ?? volume);
      }
      endExpiratoryVolume = Math.min(volume, endExpiratoryVolume);
      if (direction !== 0) lastDirection = direction;
      previousVolume = volume;

      const tidalVolume = volume - endExpiratoryVolume;
      const distention = 0.09 * endExpiratoryVolume / (endExpiratoryVolume + 420);
      const excursion = 0.31 * (1 - Math.exp(-tidalVolume / 500));
      const scale = (1 + distention + excursion).toFixed(4);
      if (scale === previousScale) return;
      previousScale = scale;
      const blockScale = (1 + 0.57 * (distention + excursion)).toFixed(4);
      for (const display of displays) {
        display.style.setProperty("--lung-scale", scale);
        display.style.setProperty("--lung-scale-block", blockScale);
      }
    },

    setHeartRate(rate) {
      if (!Number.isFinite(rate) || rate <= 0 || rate === previousHeartRate) return;
      previousHeartRate = rate;
      const period = (60 / rate).toFixed(5) + "s";
      for (const display of displays) display.style.setProperty("--beat-period", period);
    },

    setPaused(value) {
      paused = Boolean(value);
      for (const display of displays) display.dataset.paused = String(paused);
    },

    setCondition(conditionId) {
      for (const display of displays) display.dataset.condition = conditionId;
    },
  };
}
