let exposureChartInstance = null;
let markovChartInstance = null;

const exposureTimeline = [
  { label: 'Today', ee: -0.4, sigma: 0.25 },
  { label: '3M', ee: -0.2, sigma: 0.25 },
  { label: '6M', ee: 0.4, sigma: 0.28 },
  { label: '1Y', ee: 0.9, sigma: 0.32 },
  { label: '18M', ee: 1.4, sigma: 0.36 },
  { label: '2Y', ee: 1.8, sigma: 0.4 },
  { label: '3Y', ee: 1.5, sigma: 0.38 },
  { label: '4Y', ee: 1.1, sigma: 0.34 },
  { label: '5Y', ee: 0.6, sigma: 0.3 },
  { label: '6Y', ee: 0.3, sigma: 0.28 },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value, digits = 2) {
  return `${value.toFixed(digits)}%`;
}

function formatNumber(value, digits = 2) {
  return value.toFixed(digits);
}

function inverseNormalCDF(p) {
  if (p <= 0 || p >= 1) {
    throw new Error('Probability must lie in (0,1).');
  }
  const a = [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00,
  ];
  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00,
  ];

  const plow = 0.02425;
  const phigh = 1 - plow;

  let q;

  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (phigh < p) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  q = p - 0.5;
  const r = q * q;
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

function computeExposureMetrics() {
  const slider = document.getElementById('pfeConfidenceInput');
  if (!slider) return;
  const confidence = Number(slider.value) / 100;
  document.getElementById('pfeConfidenceDisplay').textContent = `${Number(slider.value).toFixed(1)}%`;

  const z = inverseNormalCDF(confidence);
  const labels = exposureTimeline.map((point) => point.label);
  const expected = exposureTimeline.map((point) => point.ee);
  const positive = exposureTimeline.map((point) => Math.max(point.ee, 0));
  const negative = exposureTimeline.map((point) => Math.min(point.ee, 0));
  const pfe = exposureTimeline.map((point) => Math.max(point.ee + z * point.sigma, 0));

  const positiveSum = positive.reduce((acc, value) => acc + value, 0);
  const positiveCount = positive.filter((value) => value > 0).length || 1;
  const epe = positiveSum / positiveCount;
  const loanEquivalent = positiveSum / exposureTimeline.length;
  const negativeValues = negative.filter((value) => value < 0);
  const ene = negativeValues.length ? negativeValues.reduce((acc, value) => acc + value, 0) / negativeValues.length : 0;

  let cumulative = 0;
  let runningCount = 0;
  let effectiveEepe = 0;
  exposureTimeline.forEach((point) => {
    const pos = Math.max(point.ee, 0);
    runningCount += 1;
    cumulative += pos;
    const runningAverage = cumulative / runningCount;
    effectiveEepe = Math.max(effectiveEepe, runningAverage);
  });

  const peakPfe = Math.max(...pfe);

  const scale = 1_000_000;
  document.getElementById('metricEpe').textContent = formatCurrency(epe * scale);
  document.getElementById('metricLeq').textContent = formatCurrency(effectiveEepe * scale);
  document.getElementById('metricEne').textContent = formatCurrency(Math.abs(ene * scale));
  document.getElementById('metricPfe').textContent = formatCurrency(peakPfe * scale);

  updateExposureChart(labels, expected, positive, pfe);
}

function updateExposureChart(labels, expected, positive, pfe) {
  const ctx = document.getElementById('exposureChart');
  if (!ctx) return;
  if (exposureChartInstance) exposureChartInstance.destroy();

  exposureChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Expected exposure (EE)',
          data: expected,
          borderColor: 'rgba(37, 99, 235, 1)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          tension: 0.2,
          fill: false,
        },
        {
          label: 'Positive exposure',
          data: positive,
          borderColor: 'rgba(129, 140, 248, 0.9)',
          backgroundColor: 'rgba(129, 140, 248, 0.2)',
          borderWidth: 1,
          tension: 0.2,
          fill: true,
        },
        {
          label: 'PFE (selected confidence)',
          data: pfe,
          borderColor: 'rgba(239, 68, 68, 0.9)',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderWidth: 2,
          tension: 0.25,
          borderDash: [6, 4],
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: 'rgba(30, 41, 59, 0.75)', font: { family: 'Inter' } } },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#1f2937',
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatNumber(context.parsed.y, 2)}M`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
        },
        y: {
          ticks: {
            color: 'rgba(30, 41, 59, 0.7)',
            callback: (value) => `${value}M`,
          },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          title: { display: true, text: 'Exposure (USD millions)', color: 'rgba(30, 41, 59, 0.75)' },
        },
      },
    },
  });
}

function updateLoss() {
  const exposure = Number(document.getElementById('lossExposureInput').value) || 0;
  const pd = (Number(document.getElementById('lossPdInput').value) || 0) / 100;
  const lgd = (Number(document.getElementById('lossLgdInput').value) || 0) / 100;

  const expectedLoss = exposure * pd * lgd;
  document.getElementById('lossAbsolute').textContent = formatCurrency(expectedLoss);
  document.getElementById('lossPercent').textContent = formatPercent(pd * lgd * 100, 2);
}

function computeCva() {
  const recovery = (Number(document.getElementById('cvaRecovery').value) || 0) / 100;
  let total = 0;

  for (let i = 0; i < 5; i += 1) {
    const df = Number(document.getElementById(`cvaDf${i}`).value) || 0;
    const eeMillion = Number(document.getElementById(`cvaEe${i}`).value) || 0;
    const deltaPdPercent = Number(document.getElementById(`cvaDeltaPd${i}`).value) || 0;
    const deltaPd = Math.max(deltaPdPercent, 0) / 100;

    const contribution = (1 - recovery) * df * eeMillion * 1_000_000 * deltaPd;
    total += contribution;
    const output = document.getElementById(`cvaContribution${i}`);
    if (output) {
      output.textContent = formatCurrency(contribution);
    }
  }

  document.getElementById('cvaResult').textContent = formatCurrency(total);
}

function normaliseRow(row) {
  const sum = row.reduce((acc, value) => acc + Math.max(value, 0), 0);
  if (sum === 0) {
    return row.map(() => 1 / row.length);
  }
  return row.map((value) => Math.max(value, 0) / sum);
}

function getTransitionMatrix() {
  const inputs = [
    ['p00', 'p01', 'p02'],
    ['p10', 'p11', 'p12'],
    ['p20', 'p21', 'p22'],
  ];
  return inputs.map((ids) => normaliseRow(ids.map((id) => Number(document.getElementById(id).value) || 0)));
}

function multiplyVectorMatrix(vector, matrix) {
  const result = new Array(matrix[0].length).fill(0);
  for (let j = 0; j < matrix[0].length; j += 1) {
    for (let i = 0; i < vector.length; i += 1) {
      result[j] += vector[i] * matrix[i][j];
    }
  }
  return result;
}

function updateMarkovMatrixDisplay(matrix) {
  const container = document.getElementById('markovMatrix');
  if (!container) return;
  const states = ['AAA', 'BBB', 'Default'];
  const rows = matrix
    .map((row, i) => `<tr><th>${states[i]}</th>${row.map((value) => `<td>${(value * 100).toFixed(1)}%</td>`).join('')}</tr>`)
    .join('');
  container.innerHTML = `
    <table>
      <thead>
        <tr><th>From / To</th>${states.map((state) => `<th>${state}</th>`).join('')}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function updateMarkovChart(event) {
  if (event) event.preventDefault();
  const periods = Math.max(1, Number(document.getElementById('markovPeriods').value) || 6);
  const matrix = getTransitionMatrix();
  updateMarkovMatrixDisplay(matrix);

  const states = ['AAA', 'BBB', 'Default'];
  const history = [];
  let distribution = [1, 0, 0];
  history.push({ time: 0, distribution: [...distribution] });

  for (let t = 1; t <= periods; t += 1) {
    distribution = multiplyVectorMatrix(distribution, matrix);
    history.push({ time: t, distribution: [...distribution] });
  }

  const labels = history.map((item) => `t=${item.time}`);
  const datasets = states.map((state, idx) => ({
    label: state,
    data: history.map((item) => item.distribution[idx] * 100),
    borderWidth: 2,
    tension: 0.25,
  }));

  const colours = [
    'rgba(37, 99, 235, 1)',
    'rgba(129, 140, 248, 1)',
    'rgba(239, 68, 68, 1)',
  ];
  datasets.forEach((dataset, idx) => {
    dataset.borderColor = colours[idx];
    dataset.backgroundColor = `${colours[idx].replace('1)', '0.15)')}`;
  });

  const ctx = document.getElementById('markovChart');
  if (!ctx) return;
  if (markovChartInstance) markovChartInstance.destroy();

  markovChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: 'rgba(30, 41, 59, 0.75)', font: { family: 'Inter' } } },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#1f2937',
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
        },
        y: {
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          title: { display: true, text: 'Probability (%)', color: 'rgba(30, 41, 59, 0.75)' },
          suggestedMin: 0,
          suggestedMax: 100,
        },
      },
    },
  });
}

function updateStressTesting() {
  const epe = Number(document.getElementById('stressEpe').value) || 0;
  const pfe = Number(document.getElementById('stressPfe').value) || 0;
  const pd = (Number(document.getElementById('stressPd').value) || 0) / 100;
  const lgd = (Number(document.getElementById('stressLgd').value) || 0) / 100;
  const interestShock = Number(document.getElementById('stressInterest').value) || 0;
  const equityShock = Number(document.getElementById('stressEquity').value) || 0;
  const creditShock = Number(document.getElementById('stressCredit').value) || 0;
  const correlation = Number(document.getElementById('stressCorrelation').value) || 0;
  document.getElementById('stressCorrelationDisplay').textContent = correlation.toFixed(2);

  const totalShock = interestShock + equityShock + creditShock;
  const exposureFactor = 1 + totalShock + correlation * creditShock;
  const stressedEpe = epe * exposureFactor;
  const stressedPfe = pfe * exposureFactor;

  const baseEl = epe * pd * lgd;
  const stressedPd = pd * (1 + Math.max(correlation, 0) * creditShock * 5);
  const stressedEl = stressedEpe * stressedPd * lgd;
  const stressedCva = (stressedPfe - pfe) * lgd;

  document.getElementById('stressElBase').textContent = formatCurrency(baseEl);
  document.getElementById('stressEpeResult').textContent = formatCurrency(stressedEpe);
  document.getElementById('stressPfeResult').textContent = formatCurrency(stressedPfe);
  document.getElementById('stressElResult').textContent = formatCurrency(stressedEl);
  document.getElementById('stressCvaResult').textContent = formatCurrency(stressedCva);
}

function attachExposureListeners() {
  const slider = document.getElementById('pfeConfidenceInput');
  if (slider) {
    slider.addEventListener('input', computeExposureMetrics);
    computeExposureMetrics();
  }
}

function attachLossListeners() {
  ['lossExposureInput', 'lossPdInput', 'lossLgdInput'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateLoss);
      input.addEventListener('change', updateLoss);
    }
  });
  updateLoss();
}

function attachCvaListeners() {
  const recoveryInput = document.getElementById('cvaRecovery');
  if (recoveryInput) {
    recoveryInput.addEventListener('input', computeCva);
    recoveryInput.addEventListener('change', computeCva);
  }
  for (let i = 0; i < 5; i += 1) {
    ['cvaDf', 'cvaEe', 'cvaDeltaPd'].forEach((prefix) => {
      const input = document.getElementById(`${prefix}${i}`);
      if (input) {
        input.addEventListener('input', computeCva);
        input.addEventListener('change', computeCva);
      }
    });
  }
  computeCva();
}

function attachStressListeners() {
  [
    'stressEpe',
    'stressPfe',
    'stressPd',
    'stressLgd',
    'stressInterest',
    'stressEquity',
    'stressCredit',
    'stressCorrelation',
  ].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateStressTesting);
      input.addEventListener('change', updateStressTesting);
    }
  });
  updateStressTesting();
}

window.addEventListener('DOMContentLoaded', () => {
  attachExposureListeners();
  attachLossListeners();
  attachCvaListeners();
  attachStressListeners();
  const markovButton = document.getElementById('updateMarkov');
  if (markovButton) {
    markovButton.addEventListener('click', updateMarkovChart);
    updateMarkovChart();
  }
});
