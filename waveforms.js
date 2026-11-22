const traces = [
  { selector: "#pressure-chart", field: "pressure", color: "#57dcca", low: 0, high: 40, step: 10 },
  { selector: "#flow-chart", field: "flow", color: "#8cbbff", low: -80, high: 80, step: 40 },
  { selector: "#volume-chart", field: "volume", color: "#edbd76", low: 0, high: 800, step: 200, timeAxis: true },
];

export function createWaveforms(onFrame) {
  const charts = traces.map(trace => ({ ...trace, canvas: document.querySelector(trace.selector) }));
  const observer = new ResizeObserver(() => redraw());
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let samples = [];
  let duration = 1;
  let phaseTime = 0;
  let previousFrame = null;
  let frameRequest = null;
  let paused = reducedMotion;

  for (const chart of charts) observer.observe(chart.canvas);

  function redraw() {
    if (!samples.length) return;
    for (const chart of charts) {
      if (!chart.canvas.clientWidth) continue;
      drawTrace(chart, samples, duration, phaseTime);
    }
    const sampleIndex = Math.min(samples.length - 1, Math.floor(phaseTime / duration * (samples.length - 1)));
    onFrame(samples[sampleIndex]);
  }

  function tick(now) {
    if (previousFrame !== null) phaseTime = (phaseTime + (now - previousFrame) / 1000) % duration;
    previousFrame = now;
    redraw();
    frameRequest = requestAnimationFrame(tick);
  }

  return {
    replace(nextSamples) {
      samples = nextSamples;
      duration = samples.at(-1)?.time || 1;
      for (const chart of charts) updateScale(chart, samples);
      phaseTime %= duration;
      redraw();
    },
    setPaused(value) {
      paused = value;
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      frameRequest = null;
      previousFrame = null;
      if (!paused && samples.length) frameRequest = requestAnimationFrame(tick);
      redraw();
    },
    get paused() {
      return paused;
    },
  };
}

function updateScale(chart, samples) {
  let minimum = chart.low;
  let maximum = chart.high;
  for (const sample of samples) {
    minimum = Math.min(minimum, sample[chart.field]);
    maximum = Math.max(maximum, sample[chart.field]);
  }
  chart.minimum = Math.floor(minimum / chart.step) * chart.step;
  chart.maximum = Math.ceil(maximum / chart.step) * chart.step;
}

function drawTrace(chart, samples, duration, phaseTime) {
  const { canvas, field, color, minimum, maximum } = chart;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const plotLeft = 30;
  const plotRight = width - 6;
  const plotTop = 10;
  const plotBottom = height - (chart.timeAxis ? 24 : 9);
  const x = time => plotLeft + (plotRight - plotLeft) * time / duration;
  const y = value => plotBottom - (plotBottom - plotTop) * (value - minimum) / (maximum - minimum);
  ctx.lineWidth = 1;
  ctx.font = "10px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  ctx.direction = "ltr";
  ctx.textAlign = "left";

  for (let time = 0; time <= duration; time++) {
    ctx.strokeStyle = time % 4 === 0 ? "#293d4f" : "#192b3b";
    ctx.beginPath();
    ctx.moveTo(x(time), plotTop);
    ctx.lineTo(x(time), plotBottom);
    ctx.stroke();
  }
  if (chart.timeAxis) {
    ctx.fillStyle = "#a1b2c5";
    const lastTick = Math.floor(duration / 4) * 4;
    for (let time = 0; time <= lastTick; time += 4) {
      const label = time + " s";
      ctx.fillText(label, Math.min(x(time), plotRight - ctx.measureText(label).width), height - 9);
    }
  }
  for (let index = 0; index <= 4; index++) {
    const value = Math.round(minimum + (maximum - minimum) * index / 4);
    ctx.strokeStyle = value === 0 ? "#425a70" : "#26394b";
    ctx.beginPath();
    ctx.moveTo(plotLeft, y(value));
    ctx.lineTo(plotRight, y(value));
    ctx.stroke();
    if (index % 2 === 0) {
      ctx.fillStyle = "#a1b2c5";
      ctx.fillText(String(value), 2, y(value));
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const [index, sample] of samples.entries()) {
    const px = x(sample.time);
    const py = y(sample[field]);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  const sweep = x(phaseTime);
  ctx.strokeStyle = "#ddf2ff66";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sweep, plotTop);
  ctx.lineTo(sweep, plotBottom);
  ctx.stroke();
}
