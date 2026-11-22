const TRACE_DURATION = 14;
const SAMPLE_INTERVAL = 0.02;
const RESPIRATORY_QUOTIENT = 0.8;
const SEA_LEVEL_DRY_GAS_PRESSURE = 713;
const HEMOGLOBIN = 14;
const OXYGEN_CAPACITY = 1.34 * HEMOGLOBIN;
const OXYGEN_SOLUBILITY = 0.0031;

function bounded(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
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
      return [{ ...spontaneous, spontaneous: true }];
    case "SIMV": {
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
  const { compliance, resistance, peep, tidalTarget } = mechanics;
  const duration = inspiring ? breath.inspiration : breath.cycle - breath.inspiration;
  const count = Math.ceil(duration / SAMPLE_INTERVAL);
  const step = duration / count;
  const decay = Math.exp(-step / (compliance * resistance));
  const constantFlow = inspiring && breath.volumeControlled
    ? tidalTarget / breath.inspiration
    : null;
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
      : alveolarPressure + resistance * constantFlow;
    const flow = constantFlow ?? (pressure - alveolarPressure) / resistance;
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
    const endVolume = constantFlow === null
      ? equilibrium + (volume - equilibrium) * decay
      : volume + constantFlow * step;
    inhaled += Math.max(0, endVolume - volume);
    volume = endVolume;
  }

  if (constantFlow !== null) {
    peak = Math.max(peak, peep + volume / compliance + resistance * constantFlow);
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
    time += breath.cycle;
    volume = expiration.volume;
    inhaled += inspiration.inhaled + expiration.inhaled;
    peak = Math.max(peak, inspiration.peak, expiration.peak);
    if (!breath.spontaneous) {
      // Estimated static pressure at end inspiration after flow falls to zero.
      const staticPressure = mechanics.peep + inspiration.volume / mechanics.compliance;
      plateau = Math.max(plateau ?? mechanics.peep, staticPressure);
    }
    intrinsicPeep = Math.max(intrinsicPeep, expiration.volume / mechanics.compliance);
    expiratoryTime += breath.cycle - breath.inspiration;
  }

  return { time, volume, inhaled, peak, plateau, intrinsicPeep, expiratoryTime };
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
  if (alveolarVentilation < 0.05) {
    return { ...gasExchange, ph: null, paco2: null, pao2: null, spo2: null, alveolarOxygen: null };
  }

  const co2Production = bounded(scenario.co2Production, 200, 50, 600);
  const cardiacOutput = bounded(scenario.cardiacOutput, 5, 0.5, 15);
  const paco2 = 0.863 * co2Production / alveolarVentilation;
  const ph = 6.1 + Math.log10(hco3 / (0.03 * paco2));
  const alveolarOxygen = Math.max(
    0,
    fio2 * SEA_LEVEL_DRY_GAS_PRESSURE - paco2 * (fio2 + (1 - fio2) / RESPIRATORY_QUOTIENT),
  );
  const oxygenExtraction = co2Production / (RESPIRATORY_QUOTIENT * 10 * cardiacOutput);
  const arterialContent = Math.max(
    0,
    oxygenContent(alveolarOxygen) - (effectiveShunt / (1 - effectiveShunt)) * oxygenExtraction,
  );
  const pao2 = pressureFromContent(arterialContent, alveolarOxygen);
  const spo2 = 100 * oxygenSaturation(pao2);
  return { ...gasExchange, ph, paco2, pao2, spo2, alveolarOxygen };
}

/**
 * Educational, steady-periodic, single-compartment respiratory mechanics.
 * Airway resistance and respiratory-system compliance are constant. Volume
 * is in mL above passive equilibrium at applied PEEP, so it includes trapped
 * volume. Flow is in L/min, pressure is in cmH2O, and time is in seconds.
 * The trace covers whole patterns for at least 14 seconds and closes at its
 * initial state for continuous playback.
 * A scheduled effort drives spontaneous breaths. Bilevel is pressure-assisted
 * breathing. SIMV alternates mandatory VC timing with one scheduled supported
 * spontaneous breath in every two mandatory cycles. Triggering, leaks, apnea
 * backup, variable patient effort, and feedback controllers are absent.
 *
 * Peak and intrinsic PEEP are cycle maxima. Plateau is a static estimate from
 * passive mandatory breaths, not a hold measurement. VT and expiratory time
 * are mean per-breath values across the pattern. Gas values approximate steady
 * state with fixed bicarbonate, fixed hemoglobin and oxygen affinity, sea-level
 * pressure, and steady-state oxygen content mixing. Alveolar oxygen is in mmHg,
 * alveolar ventilation is in L/min, and the effective shunt is a fraction.
 * With very low alveolar ventilation, pH and gas tensions/saturation are null
 * because a useful numeric steady state cannot be represented.
 * The results apply to fictional educational examples.
 */
export function simulate(scenario = {}, settings = {}) {
  const compliance = bounded(scenario.compliance, 50, 8, 180) / 1000;
  const resistance = bounded(scenario.resistance, 8, 1, 80);
  const effort = bounded(scenario.effort, 7, 0, 25);
  const peep = bounded(settings.peep, 5, 0, 30);
  const tidalTarget = bounded(settings.vt, 450, 50, 1200) / 1000;
  const cycle = 60 / bounded(settings.rr, 14, 4, 60);
  const inspiration = cycle / (1 + bounded(settings.ie, 2, 0.4, 8));
  const fio2 = bounded(settings.fio2, 30, 21, 100) / 100;
  const drivingPressure = bounded(settings.inspPressure, 14, 0, 45);
  const support = bounded(settings.pressureSupport, 8, 0, 30);
  const pattern = breathPattern(settings.mode ?? "VC", cycle, inspiration, drivingPressure, support, effort);
  const mechanics = { compliance, resistance, peep, tidalTarget };

  // Each cycle maps starting volume to final volume by a linear decay plus
  // the response to imposed flow, pressure and effort. Solve its fixed point
  // directly so the trace starts at periodic steady state, even in severe trapping.
  const passiveDecayTime = pattern.reduce(
    (total, breath) => total + breath.cycle - (breath.volumeControlled ? breath.inspiration : 0),
    0,
  );
  const settledStart = runPattern(pattern, mechanics, 0).volume
    / -Math.expm1(-passiveDecayTime / (compliance * resistance));
  const cycleSamples = [];
  const settled = runPattern(pattern, mechanics, settledStart, cycleSamples);
  const minuteVentilation = settled.inhaled * 60 / settled.time;
  const metrics = {
    peak: settled.peak,
    plateau: settled.plateau,
    intrinsicPeep: settled.intrinsicPeep,
    tidalVolume: settled.inhaled * 1000 / pattern.length,
    minuteVentilation,
    expiratoryTime: settled.expiratoryTime / pattern.length,
  };
  return {
    samples: traceSamples(cycleSamples, settled.time),
    metrics,
    gas: estimateGas(scenario, minuteVentilation, fio2, peep),
  };
}
