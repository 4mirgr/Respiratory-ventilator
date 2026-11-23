const TRACE_DURATION = 14;
const SAMPLE_INTERVAL = 0.02;
const RESPIRATORY_QUOTIENT = 0.8;
const SEA_LEVEL_DRY_GAS_PRESSURE = 713;
const HEMOGLOBIN = 14;
const OXYGEN_CAPACITY = 1.34 * HEMOGLOBIN;
const OXYGEN_SOLUBILITY = 0.0031;

// Maximum added effective resistance in cmH₂O/(L/s) for a partial obstruction.
// The clot represents a mobile expiratory-valve example.
export const airwayStates = Object.freeze({
  clear: Object.freeze({ maxAddedInspiratoryResistance: 0, maxAddedExpiratoryResistance: 0 }),
  narrowing: Object.freeze({ maxAddedInspiratoryResistance: 36, maxAddedExpiratoryResistance: 36 }),
  clot: Object.freeze({ maxAddedInspiratoryResistance: 24, maxAddedExpiratoryResistance: 56 }),
  secretions: Object.freeze({ maxAddedInspiratoryResistance: 18, maxAddedExpiratoryResistance: 18 }),
  blocked: Object.freeze({ maxAddedInspiratoryResistance: null, maxAddedExpiratoryResistance: null }),
});

function bounded(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function resolveAirway(settings, baselineResistance) {
  const id = Object.hasOwn(airwayStates, settings.airway) ? settings.airway : "clear";
  if (id === "blocked") {
    return {
      id,
      severity: 100,
      addedInspiratoryResistance: null,
      addedExpiratoryResistance: null,
      totalInspiratoryResistance: null,
      totalExpiratoryResistance: null,
    };
  }
  const severity = id === "clear" ? 0 : bounded(settings.airwaySeverity, 50, 0, 100);
  const { maxAddedInspiratoryResistance, maxAddedExpiratoryResistance } = airwayStates[id];
  const addedInspiratoryResistance = maxAddedInspiratoryResistance * (severity / 100);
  const addedExpiratoryResistance = maxAddedExpiratoryResistance * (severity / 100);
  return {
    id,
    severity,
    addedInspiratoryResistance,
    addedExpiratoryResistance,
    totalInspiratoryResistance: baselineResistance + addedInspiratoryResistance,
    totalExpiratoryResistance: baselineResistance + addedExpiratoryResistance,
  };
}

function breathPattern(mode, cycle, inspiration, drivingPressure, support, effort) {
  const volumeBreath = { cycle, inspiration, pressure: 0, effort: 0, volumeControlled: true };
  const pressureBreath = { cycle, inspiration, pressure: drivingPressure, effort: 0 };
  const spontaneous = { ...pressureBreath, effort };

  switch (mode) {
    case "VC":
      return [volumeBreath];
    case "PC":
      return [pressureBreath];
    case "CPAP":
      return [{ ...spontaneous, pressure: 0, spontaneous: true }];
    case "BILEVEL":
      return [{ ...spontaneous, pressure: effort > 0 ? drivingPressure : 0, spontaneous: true }];
    case "SIMV": {
      if (effort === 0) return [volumeBreath];
      // The deterministic patient takes one spontaneous breath between alternate mandatory breaths.
      const shortCycle = cycle / 2;
      const shortInspiration = Math.min(inspiration, shortCycle * 0.85);
      return [
        { ...volumeBreath, cycle: shortCycle, inspiration: shortInspiration },
        {
          ...spontaneous,
          cycle: shortCycle,
          inspiration: shortInspiration,
          pressure: support,
          spontaneous: true,
        },
        volumeBreath,
      ];
    }
    default:
      throw new RangeError("Unknown ventilation mode: " + mode);
  }
}

function muscularEffort(breath, phaseTime, inspiring) {
  if (inspiring) {
    return breath.effort * Math.sin(Math.PI * phaseTime / (2 * breath.inspiration));
  }
  const relaxationTime = Math.min(0.18, (breath.cycle - breath.inspiration) * 0.3);
  const progress = Math.min(1, phaseTime / relaxationTime);
  return breath.effort * (1 + Math.cos(Math.PI * progress)) / 2;
}

function runPhase(breath, mechanics, inspiring, startVolume, startTime, samples) {
  const { compliance, inspiratoryResistance, expiratoryResistance, peep, tidalTarget } = mechanics;
  const duration = inspiring ? breath.inspiration : breath.cycle - breath.inspiration;
  const count = Math.ceil(duration / SAMPLE_INTERVAL);
  const step = duration / count;
  const inspiratoryDecay = Math.exp(-step / (compliance * inspiratoryResistance));
  const expiratoryDecay = Math.exp(-step / (compliance * expiratoryResistance));
  const constantFlow = inspiring && breath.volumeControlled
    ? tidalTarget / breath.inspiration
    : null;
  const resistivePressure = (constantFlow ?? 0) * inspiratoryResistance;
  const deliveredPressure = inspiring ? peep + breath.pressure : peep;
  let volume = startVolume;
  let inhaled = 0;
  let peak = deliveredPressure;

  for (let i = 0; i < count; i++) {
    const phaseTime = i * step;
    const effort = muscularEffort(breath, phaseTime, inspiring);
    const alveolarPressure = peep + volume / compliance - effort;
    const pressure = constantFlow === null
      ? deliveredPressure
      : alveolarPressure + resistivePressure;
    const pressureGradient = pressure - alveolarPressure;
    const resistance = pressureGradient < 0 ? expiratoryResistance : inspiratoryResistance;
    const flow = constantFlow ?? pressureGradient / resistance;
    samples?.push({
      time: startTime + phaseTime,
      pressure,
      flow: flow * 60,
      volume: volume * 1000,
      alveolarPressure,
    });
    peak = Math.max(peak, pressure);

    const midpointEffort = muscularEffort(breath, phaseTime + step / 2, inspiring);
    const equilibrium = compliance * (deliveredPressure - peep + midpointEffort);
    const decay = volume > equilibrium ? expiratoryDecay : inspiratoryDecay;
    const endVolume = constantFlow === null
      ? equilibrium + (volume - equilibrium) * decay
      : volume + constantFlow * step;
    inhaled += Math.max(0, endVolume - volume);
    volume = endVolume;
  }

  if (constantFlow !== null) {
    peak = Math.max(peak, peep + volume / compliance + resistivePressure);
    if (samples) {
      // Preserve the peak on the waveform without duplicating the expiration timestamp.
      const switchOffset = 0.000001;
      const edgeVolume = volume - constantFlow * switchOffset;
      const alveolarPressure = peep + edgeVolume / compliance;
      samples.push({
        time: startTime + duration - switchOffset,
        pressure: alveolarPressure + resistivePressure,
        flow: constantFlow * 60,
        volume: edgeVolume * 1000,
        alveolarPressure,
      });
    }
  }
  return { volume, inhaled, peak };
}

function runPattern(pattern, mechanics, startVolume, samples) {
  let time = 0;
  let volume = startVolume;
  let inhaled = 0;
  let peak = mechanics.peep;
  let plateau = null;
  let intrinsicPeep = 0;
  let expiratoryTime = 0;
  let breaths = 0;

  for (const breath of pattern) {
    const inspiration = runPhase(breath, mechanics, true, volume, time, samples);
    const expiration = runPhase(
      breath,
      mechanics,
      false,
      inspiration.volume,
      time + breath.inspiration,
      samples,
    );
    const breathVolume = inspiration.inhaled + expiration.inhaled;
    inhaled += breathVolume;
    peak = Math.max(peak, inspiration.peak, expiration.peak);
    expiratoryTime += breath.cycle;
    if (breathVolume > 0) {
      breaths++;
      expiratoryTime -= breath.inspiration;
      intrinsicPeep = Math.max(intrinsicPeep, volume / mechanics.compliance);
      if (!breath.spontaneous) {
        // Estimated static pressure at end inspiration after flow falls to zero.
        const staticPressure = mechanics.peep + inspiration.volume / mechanics.compliance;
        plateau = Math.max(plateau ?? mechanics.peep, staticPressure);
      }
    }
    time += breath.cycle;
    volume = expiration.volume;
  }

  return { time, volume, inhaled, peak, plateau, intrinsicPeep, expiratoryTime, breaths };
}

function settledVolume(pattern, mechanics) {
  const { compliance, inspiratoryResistance, expiratoryResistance } = mechanics;
  const pressureDrivenTime = pattern.reduce(
    (total, breath) => total + breath.cycle - (breath.volumeControlled ? breath.inspiration : 0),
    0,
  );
  const slowestResistance = Math.max(inspiratoryResistance, expiratoryResistance);
  const retainedFractionComplement = -Math.expm1(-pressureDrivenTime / (compliance * slowestResistance));
  let high = runPattern(pattern, mechanics, 0).volume / retainedFractionComplement;

  // Equal resistance gives one linear fixed point. With direction-dependent
  // resistance, the slowest relaxation bounds the monotonic cycle map above.
  if (inspiratoryResistance === expiratoryResistance || high === 0) return high;
  let low = 0;
  for (let iteration = 0; iteration < 32; iteration++) {
    const midpoint = (low + high) / 2;
    if (runPattern(pattern, mechanics, midpoint).volume > midpoint) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }
  return (low + high) / 2;
}

function traceSamples(cycleSamples, cycleDuration) {
  const samples = [];
  const repeats = Math.ceil(TRACE_DURATION / cycleDuration);
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const sample of cycleSamples) {
      samples.push({ ...sample, time: repeat * cycleDuration + sample.time });
    }
  }
  samples.push({ ...cycleSamples[0], time: repeats * cycleDuration });
  return samples;
}

function oxygenSaturation(pressure) {
  const pressureTerm = pressure ** 2.7;
  return pressureTerm / (pressureTerm + 26.8 ** 2.7);
}

function oxygenContent(pressure) {
  return OXYGEN_CAPACITY * oxygenSaturation(pressure) + OXYGEN_SOLUBILITY * pressure;
}

function pressureFromContent(content, alveolarPressure) {
  let low = 0;
  let high = alveolarPressure;
  for (let i = 0; i < 30; i++) {
    const midpoint = (low + high) / 2;
    if (oxygenContent(midpoint) < content) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }
  return (low + high) / 2;
}

function estimateGas(scenario, minuteVentilation, fio2, peep) {
  const hco3 = bounded(scenario.hco3, 24, 4, 60);
  const deadSpace = bounded(scenario.deadSpace, 0.3, 0, 1);
  const alveolarVentilation = minuteVentilation * (1 - deadSpace);
  const shuntAtZeroPeep = bounded(scenario.shunt, 0.04, 0, 0.8);
  const recruitability = bounded(scenario.recruitability, 0, 0, 1);
  // An illustrative pressure–recruitment relation reduces only the recruitable shunt.
  const effectiveShunt = shuntAtZeroPeep * (1 - recruitability * (1 - Math.exp(-peep / 10)));
  const gasExchange = { hco3, alveolarVentilation, effectiveShunt };
  const co2Production = bounded(scenario.co2Production, 200, 50, 600);
  const paco2 = alveolarVentilation >= 0.05 ? 0.863 * co2Production / alveolarVentilation : null;
  const alveolarOxygen = paco2 === null
    ? null
    : fio2 * SEA_LEVEL_DRY_GAS_PRESSURE - paco2 * (fio2 + (1 - fio2) / RESPIRATORY_QUOTIENT);
  if (alveolarOxygen === null || alveolarOxygen <= 0) {
    return {
      ...gasExchange, status: "insufficient-ventilation",
      ph: null, paco2: null, pao2: null, spo2: null, alveolarOxygen: null,
    };
  }

  const ph = 6.1 + Math.log10(hco3 / (0.03 * paco2));
  const bloodGas = { ...gasExchange, ph, paco2, alveolarOxygen };
  const cardiacOutput = bounded(scenario.cardiacOutput, 5, 0.5, 15);
  const oxygenExtraction = co2Production / (RESPIRATORY_QUOTIENT * 10 * cardiacOutput);
  const capillaryContent = oxygenContent(alveolarOxygen);
  // Fick's principle and shunt mixing jointly imply this mixed-venous content.
  const venousContent = capillaryContent - oxygenExtraction / (1 - effectiveShunt);
  if (venousContent <= 0) {
    return { ...bloodGas, status: "oxygen-extraction-limit", pao2: null, spo2: null };
  }
  const arterialContent = (1 - effectiveShunt) * capillaryContent + effectiveShunt * venousContent;
  const pao2 = pressureFromContent(arterialContent, alveolarOxygen);
  const spo2 = 100 * oxygenSaturation(pao2);
  return { ...bloodGas, status: "ok", pao2, spo2 };
}

function simulateBlockedAirway(scenario, airway, fio2, peep) {
  const intervals = Math.ceil(TRACE_DURATION / SAMPLE_INTERVAL);
  return {
    airway,
    samples: Array.from({ length: intervals + 1 }, (_, index) => ({
      time: TRACE_DURATION * index / intervals,
      pressure: null,
      flow: 0,
      volume: 0,
      alveolarPressure: null,
    })),
    metrics: {
      peak: null,
      plateau: null,
      intrinsicPeep: null,
      tidalVolume: 0,
      minuteVentilation: 0,
      breathsPerMinute: 0,
      expiratoryTime: null,
    },
    gas: estimateGas(scenario, 0, fio2, peep),
  };
}

/**
 * Educational, steady-periodic, single-compartment respiratory mechanics.
 * Respiratory-system compliance and effective resistance in each direction
 * are constant. An artificial airway obstruction adds a series resistance
 * from a 0–100 exercise severity scale without defining a lumen percentage.
 * Volume control imposes the target flow without a pressure limit for partial
 * obstruction. A sealed airway delivers no flow or change in volume and does
 * not model proximal circuit or distal alveolar pressure. Volume
 * is in mL above passive equilibrium at applied PEEP, so it includes trapped
 * volume. Flow is in L/min, pressure is in cmH2O, and time is in seconds.
 * The trace covers whole patterns for at least 14 seconds and closes at its
 * initial state for continuous playback.
 * A scheduled effort drives spontaneous breaths. Bilevel provides spontaneous
 * pressure assistance. With effort, SIMV adds one scheduled supported spontaneous
 * breath in every two mandatory cycles. Trigger dynamics, leaks, apnea backup,
 * variable patient effort, and feedback controllers are absent.
 *
 * Peak and intrinsic PEEP are cycle maxima. Plateau is a static estimate from
 * passive mandatory breaths, not a hold measurement. Rate, VT and average
 * expiratory time reflect breaths with inspired flow. Gas values approximate steady
 * state with fixed bicarbonate, fixed hemoglobin and oxygen affinity, sea-level
 * pressure, and steady-state oxygen content mixing. Alveolar oxygen is in mmHg,
 * alveolar ventilation is in L/min, and the effective shunt is a fraction.
 * Insufficient ventilation for positive alveolar oxygen returns no steady-state
 * estimates. Oxygen extraction beyond the model's available delivery disables
 * the arterial oxygen estimates.
 * The results apply to fictional educational examples.
 */
export function simulate(scenario = {}, settings = {}) {
  const resistance = bounded(scenario.resistance, 8, 1, 80);
  const airway = resolveAirway(settings, resistance);
  const peep = bounded(settings.peep, 5, 0, 30);
  const fio2 = bounded(settings.fio2, 30, 21, 100) / 100;
  if (airway.id === "blocked") return simulateBlockedAirway(scenario, airway, fio2, peep);

  const compliance = bounded(scenario.compliance, 50, 8, 180) / 1000;
  const effort = bounded(scenario.effort, 7, 0, 25);
  const tidalTarget = bounded(settings.vt, 450, 50, 1200) / 1000;
  const cycle = 60 / bounded(settings.rr, 14, 4, 60);
  const inspiration = cycle / (1 + bounded(settings.ie, 2, 0.4, 8));
  const drivingPressure = bounded(settings.inspPressure, 14, 0, 45);
  const support = bounded(settings.pressureSupport, 8, 0, 30);
  const pattern = breathPattern(settings.mode ?? "VC", cycle, inspiration, drivingPressure, support, effort);
  const mechanics = {
    compliance,
    inspiratoryResistance: airway.totalInspiratoryResistance,
    expiratoryResistance: airway.totalExpiratoryResistance,
    peep,
    tidalTarget,
  };
  const settledStart = settledVolume(pattern, mechanics);
  const cycleSamples = [];
  const settled = runPattern(pattern, mechanics, settledStart, cycleSamples);
  const minuteVentilation = settled.inhaled * 60 / settled.time;
  const metrics = {
    peak: settled.peak,
    plateau: settled.plateau,
    intrinsicPeep: settled.intrinsicPeep,
    tidalVolume: settled.breaths === 0 ? 0 : settled.inhaled * 1000 / settled.breaths,
    minuteVentilation,
    breathsPerMinute: settled.breaths * 60 / settled.time,
    expiratoryTime: settled.breaths === 0 ? null : settled.expiratoryTime / settled.breaths,
  };
  return {
    airway,
    samples: traceSamples(cycleSamples, settled.time),
    metrics,
    gas: estimateGas(scenario, minuteVentilation, fio2, peep),
  };
}
