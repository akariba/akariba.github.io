let bmPathsChart = null;
let bmDistributionChart = null;
let martingaleChart = null;

function randomNormal() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function computeMean(values) {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function computeStd(values, mean) {
  if (!values.length) return 0;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeQuantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(q, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function timeLabelsFromGrid(timeGrid) {
  return timeGrid.map((t) => formatNumber(t * 12, 1)); // months
}

function buildHistogram(values, suggestedBins = 15) {
  if (!values.length) {
    return { labels: [], frequencies: [] };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(1, min);
  const binCount = clamp(suggestedBins, 5, 30);
  const binWidth = range / binCount || 1;

  const bins = new Array(binCount).fill(0);
  const labels = new Array(binCount);

  for (let i = 0; i < binCount; i += 1) {
    const start = min + i * binWidth;
    const end = start + binWidth;
    labels[i] = `${formatNumber(start, 0)}–${formatNumber(end, 0)}`;
  }

  values.forEach((value) => {
    let index = Math.floor((value - min) / binWidth);
    if (index >= binCount) index = binCount - 1;
    if (index < 0) index = 0;
    bins[index] += 1;
  });

  const frequencies = bins.map((count) => count / values.length);
  return { labels, frequencies };
}

function simulateGbmPaths({ s0, drift, vol, years, paths }) {
  const pathCount = Math.max(1, Math.round(paths));
  // Use daily steps for realism
  const steps = Math.max(1, Math.round(years * 252));
  const dt = years / steps;
  const sqrtDt = Math.sqrt(dt);
  const driftTerm = (drift - 0.5 * vol * vol) * dt;
  const diffusion = vol * sqrtDt;

  const timeGrid = new Array(steps + 1);
  for (let i = 0; i <= steps; i += 1) {
    timeGrid[i] = i * dt;
  }

  const pathSeries = [];
  const finalValues = [];
  const averageAccumulator = new Array(steps + 1).fill(0);

  for (let p = 0; p < pathCount; p += 1) {
    const series = new Array(steps + 1);
    let price = s0;
    series[0] = price;

    for (let step = 1; step <= steps; step += 1) {
      price *= Math.exp(driftTerm + diffusion * randomNormal());
      series[step] = price;
    }

    for (let step = 0; step <= steps; step += 1) {
      averageAccumulator[step] += series[step];
    }

    pathSeries.push(series);
    finalValues.push(series[steps]);
  }

  const averageSeries = averageAccumulator.map((total) => total / pathCount);
  const expectedSeries = timeGrid.map((t) => s0 * Math.exp(drift * t));

  return { timeGrid, pathSeries, finalValues, averageSeries, expectedSeries, dt };
}

function updateGbmCharts(simResult, pathLimit = 20) {
  const { timeGrid, pathSeries, finalValues, averageSeries, expectedSeries } = simResult;
  const labels = timeLabelsFromGrid(timeGrid);
  const displayCount = Math.min(pathLimit, pathSeries.length);

  const ctxPaths = document.getElementById('bmPathsChart');
  if (ctxPaths) {
    if (bmPathsChart) bmPathsChart.destroy();

    const datasets = [];

    for (let i = 0; i < displayCount; i += 1) {
      datasets.push({
        label: `Path ${i + 1}`,
        data: pathSeries[i],
        borderColor: `hsla(${(i * 37) % 360}, 65%, 55%, 0.8)`,
        borderWidth: 1,
        tension: 0.25,
        pointRadius: 0,
        fill: false,
        skipLegend: true,
      });
    }

    datasets.push({
      label: 'Average of simulated paths',
      data: averageSeries,
      borderColor: 'rgba(37, 99, 235, 1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.2,
    });

    datasets.push({
      label: 'Analytical expectation',
      data: expectedSeries,
      borderColor: 'rgba(15, 23, 42, 0.9)',
      borderDash: [6, 4],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.2,
    });

    bmPathsChart = new Chart(ctxPaths, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: 'rgba(30, 41, 59, 0.8)',
              font: { family: 'Inter' },
              filter(item, chart) {
                const dataset = chart.data.datasets[item.datasetIndex];
                return !dataset?.skipLegend;
              },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            borderColor: 'rgba(148, 163, 184, 0.35)',
            borderWidth: 1,
            titleColor: '#111827',
            bodyColor: '#1f2937',
            callbacks: {
              title(context) {
                const months = Number(context[0].label);
                return `Time: ${months.toFixed(1)} months`;
              },
              label(context) {
                return `${context.dataset.label}: ${formatNumber(context.parsed.y, 2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time (months)',
              color: 'rgba(30, 41, 59, 0.75)',
              font: { family: 'Inter', weight: 500 },
            },
            ticks: { color: 'rgba(30, 41, 59, 0.65)' },
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
          },
          y: {
            title: {
              display: true,
              text: 'Price level',
              color: 'rgba(30, 41, 59, 0.75)',
              font: { family: 'Inter', weight: 500 },
            },
            ticks: { color: 'rgba(30, 41, 59, 0.65)' },
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
          },
        },
      },
    });
  }

  const ctxDistribution = document.getElementById('bmDistributionChart');
  if (ctxDistribution) {
    if (bmDistributionChart) bmDistributionChart.destroy();

    const histogram = buildHistogram(finalValues);

    bmDistributionChart = new Chart(ctxDistribution, {
      type: 'bar',
      data: {
        labels: histogram.labels,
        datasets: [
          {
            label: 'Relative frequency',
            data: histogram.frequencies,
            backgroundColor: 'rgba(99, 102, 241, 0.45)',
            borderColor: 'rgba(79, 70, 229, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            borderColor: 'rgba(148, 163, 184, 0.35)',
            borderWidth: 1,
            titleColor: '#111827',
            bodyColor: '#1f2937',
            callbacks: {
              label(context) {
                return `Probability: ${(context.parsed.y * 100).toFixed(1)}%`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Terminal price buckets',
              color: 'rgba(30, 41, 59, 0.75)',
              font: { family: 'Inter', weight: 500 },
            },
            ticks: { color: 'rgba(30, 41, 59, 0.65)', maxRotation: 0, minRotation: 0 },
            grid: { display: false },
          },
          y: {
            title: {
              display: true,
              text: 'Probability',
              color: 'rgba(30, 41, 59, 0.75)',
              font: { family: 'Inter', weight: 500 },
            },
            ticks: {
              color: 'rgba(30, 41, 59, 0.65)',
              callback(value) {
                return `${(value * 100).toFixed(0)}%`;
              },
            },
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
            beginAtZero: true,
          },
        },
      },
    });
  }

  const mean = computeMean(finalValues);
  const std = computeStd(finalValues, mean);
  const downside = computeQuantile(finalValues, 0.05);
  const analyticalExpectation = simResult.expectedSeries[simResult.expectedSeries.length - 1];

  const expectationNode = document.getElementById('bmExpectation');
  const meanNode = document.getElementById('bmSimMean');
  const stdNode = document.getElementById('bmStd');
  const downsideNode = document.getElementById('bmDownside');
  const pathsNode = document.getElementById('bmPathsShown');

  if (expectationNode) expectationNode.textContent = formatNumber(analyticalExpectation, 2);
  if (meanNode) meanNode.textContent = formatNumber(mean, 2);
  if (stdNode) stdNode.textContent = formatNumber(std, 2);
  if (downsideNode) downsideNode.textContent = formatNumber(downside, 2);
  if (pathsNode) pathsNode.textContent = `${displayCount} of ${pathSeries.length}`;
}

function runGbmSimulation() {
  const s0 = Number(document.getElementById('bmInitial')?.value ?? 100);
  const driftInput = document.getElementById('bmDrift');
  const rateInput = document.getElementById('bmRate');
  const tieCheckbox = document.getElementById('bmRiskNeutral');
  const drift = Number(driftInput?.value ?? 0.05);
  const riskFree = Number(rateInput?.value ?? drift);
  const useRiskNeutral = tieCheckbox?.checked ?? false;
  const vol = Number(document.getElementById('bmVol')?.value ?? 0.2);
  const years = Number(document.getElementById('bmYears')?.value ?? 1);
  const paths = Number(document.getElementById('bmPaths')?.value ?? 100);

  if (!Number.isFinite(s0) || !Number.isFinite(drift) || !Number.isFinite(vol) || !Number.isFinite(years) || !Number.isFinite(paths)) {
    return;
  }

  const safeYears = Math.max(0.1, years);
  // Clamp paths to a max of 10,000 for performance
  const safePaths = clamp(paths, 10, 10000);
  const safeVol = Math.max(0, vol);
  const chosenDrift = useRiskNeutral ? riskFree : drift;

  const bmButton = document.getElementById('bmSimulate');
  if (bmButton) {
    bmButton.disabled = true;
    bmButton.textContent = 'Simulating...';
  }

  setTimeout(() => {
    const simulation = simulateGbmPaths({
      s0: Math.max(1, s0),
      drift: chosenDrift,
      vol: safeVol,
      years: safeYears,
      paths: safePaths,
    });
    updateGbmCharts(simulation);
    if (bmButton) {
      bmButton.disabled = false;
      bmButton.textContent = 'Simulate GBM';
    }
  }, 10);
}

function simulateMartingale({ s0, rate, vol, years, paths }) {
  const pathCount = Math.max(1, Math.round(paths));
  const steps = clamp(Math.round(years * 80), 40, 240);
  const dt = years / steps;
  const sqrtDt = Math.sqrt(dt);
  const driftTerm = (rate - 0.5 * vol * vol) * dt;
  const diffusion = vol * sqrtDt;

  const timeGrid = new Array(steps + 1);
  for (let i = 0; i <= steps; i += 1) {
    timeGrid[i] = i * dt;
  }

  const discountedPaths = [];
  const discountedFinals = [];
  const averageAccumulator = new Array(steps + 1).fill(0);

  for (let p = 0; p < pathCount; p += 1) {
    const series = new Array(steps + 1);
    let price = s0;
    series[0] = s0;

    for (let step = 1; step <= steps; step += 1) {
      price *= Math.exp(driftTerm + diffusion * randomNormal());
      const t = step * dt;
      series[step] = price * Math.exp(-rate * t);
    }

    for (let step = 0; step <= steps; step += 1) {
      averageAccumulator[step] += series[step];
    }

    discountedPaths.push(series);
    discountedFinals.push(series[steps]);
  }

  const averageSeries = averageAccumulator.map((total) => total / pathCount);

  return { timeGrid, discountedPaths, averageSeries, discountedFinals };
}

function updateMartingaleChart(simResult, pathLimit = 12) {
  const { timeGrid, discountedPaths, averageSeries } = simResult;
  const labels = timeLabelsFromGrid(timeGrid);
  const displayCount = Math.min(pathLimit, discountedPaths.length);
  const ctx = document.getElementById('martingaleChart');

  if (!ctx) return;

  if (martingaleChart) martingaleChart.destroy();

  const datasets = [];

  for (let i = 0; i < displayCount; i += 1) {
    datasets.push({
      label: `Path ${i + 1}`,
      data: discountedPaths[i],
      borderColor: `hsla(${(i * 41) % 360}, 70%, 50%, 0.75)`,
      borderWidth: 1,
      tension: 0.25,
      pointRadius: 0,
      fill: false,
    });
  }

  datasets.push({
    label: 'Average discounted price',
    data: averageSeries,
    borderColor: 'rgba(34, 197, 94, 1)',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.2,
  });

  datasets.push({
    label: 'Starting level',
    data: new Array(timeGrid.length).fill(discountedPaths[0]?.[0] ?? 0),
    borderColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1.5,
    borderDash: [5, 4],
    pointRadius: 0,
    tension: 0,
  });

  martingaleChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: 'rgba(30, 41, 59, 0.8)', font: { family: 'Inter' } },
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#1f2937',
          callbacks: {
            title(context) {
              const months = Number(context[0].label);
              return `Time: ${months.toFixed(1)} months`;
            },
            label(context) {
              return `${context.dataset.label}: ${formatNumber(context.parsed.y, 2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time (months)',
            color: 'rgba(30, 41, 59, 0.75)',
            font: { family: 'Inter', weight: 500 },
          },
          ticks: { color: 'rgba(30, 41, 59, 0.65)' },
          grid: { color: 'rgba(148, 163, 184, 0.15)' },
        },
        y: {
          title: {
            display: true,
            text: 'Discounted price',
            color: 'rgba(30, 41, 59, 0.75)',
            font: { family: 'Inter', weight: 500 },
          },
          ticks: { color: 'rgba(30, 41, 59, 0.65)' },
          grid: { color: 'rgba(148, 163, 184, 0.15)' },
        },
      },
    },
  });

  const summaryNode = document.getElementById('martingaleSummary');
  if (summaryNode) {
    const mean = computeMean(simResult.discountedFinals);
    const std = computeStd(simResult.discountedFinals, mean);
    const bandwidth = computeQuantile(simResult.discountedFinals, 0.95) - computeQuantile(simResult.discountedFinals, 0.05);

    summaryNode.textContent = [
      `Discounted terminal mean: ${formatNumber(mean, 2)}`,
      `Std dev: ${formatNumber(std, 2)}`,
      `90% band width: ${formatNumber(bandwidth, 2)}`,
      `Paths displayed: ${displayCount} of ${simResult.discountedPaths.length}.`,
    ].join(' · ');
  }
}

function runMartingaleSimulation() {
  const s0 = Number(document.getElementById('martingaleInitial')?.value ?? 100);
  const rate = Number(document.getElementById('martingaleRate')?.value ?? 0.03);
  const vol = Number(document.getElementById('martingaleVol')?.value ?? 0.2);
  const years = Number(document.getElementById('martingaleYears')?.value ?? 1);
  const paths = Number(document.getElementById('martingalePaths')?.value ?? 100);

  if (!Number.isFinite(s0) || !Number.isFinite(rate) || !Number.isFinite(vol) || !Number.isFinite(years) || !Number.isFinite(paths)) {
    return;
  }

  const simulation = simulateMartingale({
    s0: Math.max(1, s0),
    rate,
    vol: Math.max(0, vol),
    years: Math.max(0.1, years),
    paths: clamp(paths, 10, 800),
  });

  updateMartingaleChart(simulation);
}

document.addEventListener('DOMContentLoaded', () => {
  const bmButton = document.getElementById('bmSimulate');
  const tieCheckbox = document.getElementById('bmRiskNeutral');
  const driftInput = document.getElementById('bmDrift');
  const rateInput = document.getElementById('bmRate');

  const syncRiskNeutralState = () => {
    if (!tieCheckbox || !driftInput || !rateInput) return;
    const checked = tieCheckbox.checked;
    driftInput.disabled = checked;
    if (checked) {
      driftInput.value = rateInput.value ?? driftInput.value;
    }
  };

  if (bmButton) {
    bmButton.addEventListener('click', (event) => {
      event.preventDefault();
      runGbmSimulation();
    });
  }

  if (tieCheckbox && driftInput && rateInput) {
    tieCheckbox.addEventListener('change', () => {
      syncRiskNeutralState();
      runGbmSimulation();
    });

    rateInput.addEventListener('input', () => {
      if (tieCheckbox.checked) {
        driftInput.value = rateInput.value;
        runGbmSimulation();
      }
    });
  }

  syncRiskNeutralState();
  runGbmSimulation();

  const martingaleButton = document.getElementById('martingaleSimulate');
  if (martingaleButton) {
    martingaleButton.addEventListener('click', (event) => {
      event.preventDefault();
      runMartingaleSimulation();
    });
    runMartingaleSimulation();
  }
});
