import assert from "node:assert/strict";
import test from "node:test";
import { modes, scenarios } from "../content.js";
import { simulate } from "../model.js";

const guidedCases = [
  "asthma",
  "post-op-atelectasis",
  "aspiration",
  "obesity-hypoventilation",
  "neuromuscular-weakness",
  "sepsis-acidosis",
];

test("guided scenarios open in a supported mode and include a sourced exercise", () => {
  assert.equal(new Set(scenarios.map(scenario => scenario.id)).size, scenarios.length);
  for (const id of guidedCases) {
    const scenario = scenarios.find(scenario => scenario.id === id);
    assert.ok(scenario, `Missing guided scenario ${id}`);
    assert.ok(modes.some(mode => mode.id === scenario.defaults.mode), id);

    const { presentation, challenge, answer, limitations, references } = scenario.training;
    for (const text of [presentation, challenge, answer, limitations]) {
      assert.ok(typeof text === "string" && text.trim().length > 0, id);
    }
    assert.ok(references.length >= 2, id);
    assert.equal(new Set(references.map(reference => reference.url)).size, references.length, id);
    for (const reference of references) {
      assert.equal(new URL(reference.url).protocol, "https:", id);
      assert.ok(reference.label && reference.note, id);
    }
  }
});

test("the guided exercises reproduce their stated effects with one control change", () => {
  const compare = (id, changes) => {
    const scenario = scenarios.find(scenario => scenario.id === id);
    return [simulate(scenario, scenario.defaults), simulate(scenario, { ...scenario.defaults, ...changes })];
  };

  const [asthma, longerExhale] = compare("asthma", { ie: 4 });
  assert.ok(longerExhale.metrics.intrinsicPeep < asthma.metrics.intrinsicPeep);
  assert.ok(longerExhale.metrics.peak > asthma.metrics.peak);

  const [postOp, higherPeep] = compare("post-op-atelectasis", { peep: 9 });
  assert.ok(higherPeep.gas.effectiveShunt < postOp.gas.effectiveShunt);
  assert.ok(higherPeep.gas.pao2 > postOp.gas.pao2);
  assert.equal(higherPeep.metrics.tidalVolume, postOp.metrics.tidalVolume);

  const [aspiration, higherOxygen] = compare("aspiration", { fio2: 60 });
  assert.ok(higherOxygen.gas.pao2 > aspiration.gas.pao2);
  assert.equal(higherOxygen.gas.paco2, aspiration.gas.paco2);
  assert.equal(higherOxygen.gas.effectiveShunt, aspiration.gas.effectiveShunt);

  const [ohs, moreSupport] = compare("obesity-hypoventilation", { inspPressure: 8 });
  assert.ok(moreSupport.metrics.tidalVolume > ohs.metrics.tidalVolume);
  assert.ok(moreSupport.gas.paco2 < ohs.gas.paco2 && moreSupport.gas.ph > ohs.gas.ph);

  const [myasthenia, longerInhale] = compare("neuromuscular-weakness", { ie: 2 });
  assert.ok(longerInhale.metrics.tidalVolume > myasthenia.metrics.tidalVolume);
  assert.equal(longerInhale.metrics.peak, myasthenia.metrics.peak);

  const [sepsis, higherRate] = compare("sepsis-acidosis", { rr: 25 });
  assert.ok(sepsis.gas.paco2 > 31);
  assert.ok(higherRate.gas.paco2 >= 27 && higherRate.gas.paco2 <= 31);
  assert.equal(higherRate.gas.hco3, sepsis.gas.hco3);
});
