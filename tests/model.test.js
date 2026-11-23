import assert from "node:assert/strict";
import test from "node:test";
import { simulate } from "../model.js";

const scenario = {
  compliance: 50,
  resistance: 8,
  deadSpace: 0.3,
  shunt: 0.035,
  cardiacOutput: 5,
  hco3: 24,
  co2Production: 200,
};

const settings = {
  mode: "VC",
  rr: 14,
  vt: 450,
  peep: 5,
  fio2: 30,
  ie: 2,
  inspPressure: 14,
  pressureSupport: 8,
};

test("VC delivers the target volume and static pressure rises as compliance falls", () => {
  const baseline = simulate(scenario, settings).metrics;
  const stiff = simulate({ ...scenario, compliance: 25 }, settings).metrics;
  assert.ok(Math.abs(baseline.tidalVolume - 450) < 1);
  assert.ok(Math.abs(baseline.minuteVentilation - 6.3) < 0.02);
  assert.ok(Math.abs(baseline.plateau - 14) < 0.1);
  assert.ok(stiff.plateau - baseline.plateau > 8);
});

test("higher resistance increases the peak-to-plateau gradient in VC", () => {
  const baseline = simulate(scenario, settings).metrics;
  const obstructed = simulate({ ...scenario, resistance: 24 }, settings).metrics;
  assert.ok(obstructed.peak - obstructed.plateau > baseline.peak - baseline.plateau);
  assert.ok(Math.abs(obstructed.tidalVolume - baseline.tidalVolume) < 1);
});

test("a narrowed tube adds a flow-dependent peak-to-plateau gradient in VC", () => {
  const clear = simulate(scenario, settings);
  const narrowed = simulate(scenario, { ...settings, airway: "narrowing", airwaySeverity: 60 });
  const addedGradient = (narrowed.metrics.peak - narrowed.metrics.plateau)
    - (clear.metrics.peak - clear.metrics.plateau);
  const inspiratoryFlow = narrowed.samples[0].flow / 60;

  assert.equal(clear.airway.id, "clear");
  assert.equal(clear.airway.severity, 0);
  assert.ok(narrowed.airway.addedInspiratoryResistance > 0);
  assert.ok(Math.abs(addedGradient - narrowed.airway.addedInspiratoryResistance * inspiratoryFlow) < 1e-9);
  assert.ok(Math.abs(clear.metrics.tidalVolume - narrowed.metrics.tidalVolume) < 1e-9);
  assert.deepEqual(simulate(scenario, { ...settings, airway: "narrowing", airwaySeverity: 0 }).metrics, clear.metrics);
});

test("tube secretions reduce delivered volume in PC at the same pressure target", () => {
  const pc = { ...settings, mode: "PC" };
  const clear = simulate(scenario, pc);
  const secretions = simulate(scenario, { ...pc, airway: "secretions", airwaySeverity: 70 });
  assert.equal(secretions.metrics.peak, clear.metrics.peak);
  assert.ok(secretions.metrics.tidalVolume < clear.metrics.tidalVolume);
  assert.ok(secretions.airway.totalInspiratoryResistance > scenario.resistance);
  assert.equal(secretions.airway.totalExpiratoryResistance, secretions.airway.totalInspiratoryResistance);
});

test("a partial expiratory-valve clot impedes expiration and raises intrinsic PEEP", () => {
  const narrow = simulate(scenario, { ...settings, airway: "narrowing", airwaySeverity: 40 });
  const clot = simulate(scenario, { ...settings, airway: "clot", airwaySeverity: 60 });
  assert.ok(Math.abs(clot.airway.totalInspiratoryResistance - narrow.airway.totalInspiratoryResistance) < 1e-9);
  assert.ok(clot.airway.totalExpiratoryResistance > narrow.airway.totalExpiratoryResistance);
  assert.ok(clot.metrics.intrinsicPeep > narrow.metrics.intrinsicPeep);
  const cycle = 60 / settings.rr;
  const narrowEndFlow = narrow.samples.findLast(sample => sample.time < cycle).flow;
  const clotEndFlow = clot.samples.findLast(sample => sample.time < cycle).flow;
  assert.ok(clotEndFlow < narrowEndFlow);

  for (const sample of clot.samples) {
    const resistance = sample.flow < 0 ? clot.airway.totalExpiratoryResistance : clot.airway.totalInspiratoryResistance;
    assert.ok(Math.abs(sample.pressure - sample.alveolarPressure - resistance * sample.flow / 60) < 1e-9);
  }
});

test("a fully blocked tube delivers no breaths and leaves pressures undefined", () => {
  for (const mode of ["VC", "PC", "CPAP", "BILEVEL", "SIMV"]) {
    const blocked = simulate(scenario, { ...settings, mode, airway: "blocked", airwaySeverity: 0 });
    assert.deepEqual(blocked.airway, {
      id: "blocked",
      severity: 100,
      addedInspiratoryResistance: null,
      addedExpiratoryResistance: null,
      totalInspiratoryResistance: null,
      totalExpiratoryResistance: null,
    });
    assert.deepEqual(blocked.metrics, {
      peak: null,
      plateau: null,
      intrinsicPeep: null,
      tidalVolume: 0,
      minuteVentilation: 0,
      breathsPerMinute: 0,
      expiratoryTime: null,
    });
    assert.equal(blocked.gas.status, "insufficient-ventilation");
    assert.equal(blocked.gas.alveolarVentilation, 0);
    assert.equal(blocked.gas.paco2, null);
    assert.equal(blocked.samples.at(0).time, 0);
    assert.equal(blocked.samples.at(-1).time, 14);
    assert.ok(blocked.samples.every(({ time, pressure, alveolarPressure, flow, volume }, i, samples) =>
      (i === 0 || time > samples[i - 1].time)
      && pressure === null && alveolarPressure === null && flow === 0 && volume === 0,
    ));
  }
});

test("short VC inspirations show the final pressure before the expiration switch", () => {
  const stiff = { ...scenario, compliance: 15, resistance: 10 };
  const { samples, metrics } = simulate(stiff, { ...settings, rr: 35, vt: 800, ie: 5 });
  const plottedPeak = Math.max(...samples.map(sample => sample.pressure));

  assert.ok(Math.abs(metrics.peak - plottedPeak) < 0.001);
  assert.ok(samples.every((sample, index) => index === 0 || sample.time > samples[index - 1].time));
});

test("shorter expiration increases intrinsic PEEP and leaves flow at the end of expiration", () => {
  const obstructed = { ...scenario, compliance: 80, resistance: 25 };
  const longer = simulate(obstructed, { ...settings, rr: 12, ie: 4 });
  const shorter = simulate(obstructed, { ...settings, rr: 24, ie: 2 });
  assert.ok(shorter.metrics.intrinsicPeep > longer.metrics.intrinsicPeep);
  const newBreathIndex = shorter.samples.findIndex(
    (sample, i, samples) => i > 0 && samples[i - 1].flow < 0 && sample.flow > 0,
  );
  assert.ok(newBreathIndex > 0);
  assert.ok(shorter.samples[newBreathIndex - 1].flow < -1);
  assert.ok(shorter.samples[newBreathIndex].volume > 0);
});

test("gas estimates react to ventilation, dead space, inspired oxygen, and bicarbonate", () => {
  const baseline = simulate(scenario, settings).gas;
  const moreVentilation = simulate(scenario, { ...settings, rr: 18 }).gas;
  const higherOxygen = simulate(scenario, { ...settings, fio2: 45 }).gas;
  const highDeadSpace = simulate({ ...scenario, deadSpace: 0.5 }, settings).gas;
  const lowBicarbonate = simulate({ ...scenario, hco3: 14 }, settings).gas;
  assert.ok(baseline.ph > 7.33 && baseline.ph < 7.46);
  assert.ok(moreVentilation.paco2 < baseline.paco2);
  assert.ok(moreVentilation.ph > baseline.ph);
  assert.ok(higherOxygen.pao2 > baseline.pao2);
  assert.ok(highDeadSpace.paco2 > baseline.paco2);
  assert.ok(lowBicarbonate.ph < baseline.ph);
  assert.equal(lowBicarbonate.paco2, baseline.paco2);
});

test("a lower cardiac output worsens oxygenation when a shunt is present", () => {
  const shunt = { ...scenario, shunt: 0.2 };
  const baseline = simulate(shunt, settings).gas;
  const lowerOutput = simulate({ ...shunt, cardiacOutput: 2.5 }, settings).gas;
  assert.ok(lowerOutput.pao2 < baseline.pao2);
  assert.ok(lowerOutput.spo2 < baseline.spo2);
});

test("PEEP only improves oxygenation through the modeled recruitable shunt", () => {
  const highPeep = { ...settings, peep: 14 };
  const fixedShunt = { ...scenario, shunt: 0.26 };
  const recruitableShunt = { ...fixedShunt, recruitability: 0.65 };

  const fixed = simulate(fixedShunt, settings).gas;
  const fixedAtHighPeep = simulate(fixedShunt, highPeep).gas;
  const recruitable = simulate(recruitableShunt, settings).gas;
  const recruitableAtHighPeep = simulate(recruitableShunt, highPeep).gas;
  assert.equal(fixedAtHighPeep.pao2, fixed.pao2);
  assert.ok(recruitableAtHighPeep.pao2 > recruitable.pao2);
});

test("alveolar gas outputs reflect breathing, recruitment, and apnea", () => {
  const recruitableShunt = { ...scenario, shunt: 0.26, recruitability: 0.65 };
  const baseline = simulate(recruitableShunt, settings);
  const highPeep = simulate(recruitableShunt, { ...settings, peep: 14 });
  const apnea = simulate({ ...recruitableShunt, effort: 0 }, { ...settings, mode: "CPAP" });

  assert.equal(
    baseline.gas.alveolarVentilation,
    baseline.metrics.minuteVentilation * (1 - scenario.deadSpace),
  );
  assert.ok(baseline.gas.alveolarOxygen > baseline.gas.pao2);
  assert.ok(baseline.gas.effectiveShunt > 0);
  assert.ok(highPeep.gas.effectiveShunt < baseline.gas.effectiveShunt);
  assert.equal(apnea.gas.alveolarVentilation, 0);
  assert.equal(apnea.gas.alveolarOxygen, null);
  assert.equal(apnea.gas.effectiveShunt, baseline.gas.effectiveShunt);
});

test("pressure control and spontaneous modes respond to pressure and patient effort", () => {
  const pc = simulate(scenario, { ...settings, mode: "PC" });
  const stifferPc = simulate({ ...scenario, compliance: 25 }, { ...settings, mode: "PC" });
  const cpap = simulate(scenario, { ...settings, mode: "CPAP" });
  const noEffort = simulate({ ...scenario, effort: 0 }, { ...settings, mode: "CPAP" });
  const bilevel = simulate(scenario, { ...settings, mode: "BILEVEL" });

  assert.equal(pc.metrics.peak, settings.peep + settings.inspPressure);
  assert.ok(stifferPc.metrics.tidalVolume < pc.metrics.tidalVolume);
  assert.equal(cpap.metrics.peak, settings.peep);
  assert.equal(cpap.metrics.plateau, null);
  assert.equal(bilevel.metrics.plateau, null);
  assert.equal(noEffort.metrics.tidalVolume, 0);
  assert.equal(noEffort.gas.paco2, null);
  assert.ok(bilevel.metrics.tidalVolume > cpap.metrics.tidalVolume);
});

test("SIMV includes mandatory and pressure-supported spontaneous breaths", () => {
  const simv = simulate(scenario, { ...settings, mode: "SIMV" });
  const moreSupport = simulate(scenario, { ...settings, mode: "SIMV", pressureSupport: 12 });
  assert.ok(simv.samples.some(({ pressure }) => pressure === settings.peep + settings.pressureSupport));
  assert.ok(simv.metrics.plateau > settings.peep);
  assert.equal(simv.metrics.breathsPerMinute, settings.rr * 1.5);
  assert.ok(moreSupport.metrics.minuteVentilation > simv.metrics.minuteVentilation);
  assert.ok(simv.samples.at(-1).time >= 14);
  assert.ok(simv.samples.every((point, index) => index === 0 || point.time > simv.samples[index - 1].time));
});

test("spontaneous bilevel does not deliver timed backup breaths during apnea", () => {
  const apnea = simulate({ ...scenario, effort: 0 }, { ...settings, mode: "BILEVEL" });

  assert.equal(apnea.metrics.tidalVolume, 0);
  assert.equal(apnea.metrics.breathsPerMinute, 0);
  assert.equal(apnea.metrics.expiratoryTime, null);
  assert.equal(apnea.gas.status, "insufficient-ventilation");
  assert.ok(apnea.samples.every(sample => sample.pressure === settings.peep && sample.flow === 0));
});

test("SIMV preserves the mandatory pattern when there is no spontaneous effort", () => {
  const passive = { ...scenario, effort: 0 };
  const vc = simulate(passive, settings);

  for (const pressureSupport of [0, 8]) {
    const simv = simulate(passive, { ...settings, mode: "SIMV", pressureSupport });
    assert.deepEqual(simv.samples, vc.samples);
    assert.deepEqual(simv.metrics, vc.metrics);
    assert.equal(simv.metrics.breathsPerMinute, settings.rr);
  }
});

test("weak spontaneous effort preserves measured mechanics when gas exchange has no steady estimate", () => {
  const weakEffort = { ...scenario, effort: 1, compliance: 25 };
  const { metrics, gas } = simulate(weakEffort, { ...settings, mode: "CPAP", fio2: 21 });

  assert.equal(metrics.breathsPerMinute, settings.rr);
  assert.ok(metrics.tidalVolume > 0);
  assert.ok(gas.alveolarVentilation > 0.05);
  assert.equal(gas.status, "insufficient-ventilation");
  for (const key of ["ph", "paco2", "pao2", "spo2", "alveolarOxygen"]) assert.equal(gas[key], null);
});

test("oxygen estimates flag an oxygen demand exceeding modeled circulatory delivery", () => {
  const lowOutput = { ...scenario, shunt: 0.5, cardiacOutput: 2, co2Production: 250 };
  const highOxygen = { ...settings, fio2: 60 };
  const limitedGas = simulate(lowOutput, highOxygen).gas;
  const restoredGas = simulate({ ...lowOutput, cardiacOutput: 6 }, highOxygen).gas;

  assert.equal(limitedGas.status, "oxygen-extraction-limit");
  assert.equal(limitedGas.pao2, null);
  assert.equal(limitedGas.spo2, null);
  assert.ok(limitedGas.alveolarOxygen > 0);
  assert.equal(limitedGas.paco2, restoredGas.paco2);
  assert.equal(restoredGas.status, "ok");
  assert.ok(restoredGas.pao2 > 0);
});

test("traces cover whole ventilation patterns and meet their starting state at the wrap", () => {
  for (const [mode, rr, cyclesPerPattern] of [["VC", 14, 1], ["VC", 24, 1], ["SIMV", 14, 2]]) {
    const { samples } = simulate(scenario, { ...settings, mode, rr });
    const period = (60 / rr) * cyclesPerPattern;
    const endpoint = samples.at(-1);

    assert.equal(endpoint.time, Math.ceil(14 / period) * period);
    assert.deepEqual({ ...endpoint, time: 0 }, samples[0]);
    assert.ok(samples.every((sample, index) => index === 0 || sample.time > samples[index - 1].time));
  }
});
