let tailChartInstance = null;
let sensitivityChartInstance = null;

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

function inverseNormalCDF(p) {
  if (p <= 0 || p >= 1) throw new Error('Probability must be in (0,1)');
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
  if (p > phigh) {
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

function normalPdf(x, mean = 0, sd = 1) {
  const z = (x - mean) / sd;
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

function computeVarMetrics() {
  const value = Number(document.getElementById('portfolioValueInput').value) || 0;
  const muAnnual = Number(document.getElementById('meanReturnInput').value) || 0;
  const sigmaAnnual = Number(document.getElementById('volatilityInput').value) || 0;
  const horizonDays = Math.max(1, Number(document.getElementById('horizonInput').value) || 1);
  const confInput = Number(document.getElementById('confidenceInput').value) || 95;
  const confidence = Math.min(Math.max(confInput, 90), 99.9) / 100;

  const sigmaH = sigmaAnnual * Math.sqrt(horizonDays / 252);
  const muH = muAnnual * (horizonDays / 252);
  const z = inverseNormalCDF(confidence);

  const varAbsolute = Math.abs(value * z * sigmaH);
  const es = Math.max(0, value * sigmaH * (normalPdf(z) / (1 - confidence)));
  const meanVarVaR = Math.max(0, value * ((z * sigmaH) - muH));
  const pctVaR = value > 0 ? (varAbsolute / value) * 100 : 0;

  document.getElementById('varParametric').textContent = `${formatCurrency(varAbsolute)} loss`;
  document.getElementById('varEs').textContent = `${formatCurrency(es)} loss`;
  document.getElementById('varMeanVar').textContent = `${formatCurrency(meanVarVaR)} loss`;
  document.getElementById('varPercent').textContent = formatPercent(pctVaR, 2);
  document.getElementById('varZScore').textContent = `${z.toFixed(3)} (for ${(confidence * 100).toFixed(1)}%)`;

  updateVarChart(muH, sigmaH, z);
}

function updateVarChart(mu, sigma, z) {
  const ctx = document.getElementById('varChart');
  if (!ctx) return;

  const sigmaSafe = Math.max(sigma, 1e-6);
  const extent = Math.max(0.1, Math.min(4 * sigmaSafe, 0.35));
  const minX = mu - extent;
  const maxX = mu + extent;
  const step = (maxX - minX) / 180;
  const minPercent = Number((minX * 100).toFixed(2));
  const maxPercent = Number((maxX * 100).toFixed(2));
  const xValues = [];
  const pdfValues = [];
  const tailValues = [];
  const varCut = mu - z * sigmaSafe;

  for (let x = minX; x <= maxX; x += step) {
    const pdf = normalPdf(x, mu, sigmaSafe);
    xValues.push(x * 100);
    pdfValues.push(pdf);
    tailValues.push(x <= varCut ? pdf : null);
  }

  if (tailChartInstance) tailChartInstance.destroy();

  tailChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: xValues,
      datasets: [
        {
          label: 'Normal PDF',
          data: pdfValues,
          borderColor: 'rgba(37, 99, 235, 1)',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Tail beyond VaR',
          data: tailValues,
          borderColor: 'rgba(239, 68, 68, 0.95)',
          backgroundColor: 'rgba(239, 68, 68, 0.3)',
          borderWidth: 0,
          tension: 0.3,
          pointRadius: 0,
          fill: 'origin',
          spanGaps: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: 'rgba(30, 41, 59, 0.75)', font: { family: 'Inter' } },
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#1f2937',
          callbacks: {
            title(context) {
              const label = context[0].label ?? 0;
              return `Return: ${Number(label).toFixed(1)}%`;
            },
            label(context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(4)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: 'rgba(30, 41, 59, 0.7)',
            callback: (value) => `${Number(value).toFixed(1)}%`,
          },
          title: { display: true, text: 'Return (%)', color: 'rgba(30, 41, 59, 0.75)' },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          min: minPercent,
          max: maxPercent,
        },
        y: {
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          title: { display: true, text: 'Probability density', color: 'rgba(30, 41, 59, 0.75)' },
        },
      },
    },
  });
}

function computeSensitivities() {
  const pv01 = Number(document.getElementById('pv01Input').value) || 0;
  const cs01 = Number(document.getElementById('cs01Input').value) || 0;
  const eqDelta = Number(document.getElementById('eqDeltaInput').value) || 0;
  const fxDelta = Number(document.getElementById('fxDeltaInput').value) || 0;
  const cmdDelta = Number(document.getElementById('cmdDeltaInput').value) || 0;
  const optionDelta = Number(document.getElementById('deltaInput').value) || 0;
  const gamma = Number(document.getElementById('gammaInput').value) || 0;
  const vega = Number(document.getElementById('vegaInput').value) || 0;
  const theta = Number(document.getElementById('thetaInput').value) || 0;
  const rho = Number(document.getElementById('rhoInput').value) || 0;

  const rateShockBps = Number(document.getElementById('rateShockInput').value) || 0;
  const spreadShockBps = Number(document.getElementById('spreadShockInput').value) || 0;
  const equityShockPct = Number(document.getElementById('eqShockInput').value) || 0;
  const fxShockPct = Number(document.getElementById('fxShockInput').value) || 0;
  const deltaS = Number(document.getElementById('priceChangeInput').value) || 0;
  const deltaSigma = Number(document.getElementById('volChangeInput').value) || 0;
  const deltaT = Number(document.getElementById('timeChangeInput').value) || 0;
  const deltaR = Number(document.getElementById('rateChangeInput').value) || 0;

  const pv01PnL = pv01 * rateShockBps;
  const cs01PnL = cs01 * spreadShockBps;
  const eqPnL = eqDelta * (equityShockPct / 1);
  const fxPnL = fxDelta * (fxShockPct / 1);
  const cmdPnL = cmdDelta * (fxShockPct / 1);
  const deltaPnL = optionDelta * deltaS;
  const gammaPnL = 0.5 * gamma * deltaS * deltaS;
  const vegaPnL = vega * deltaSigma;
  const thetaPnL = theta * deltaT;
  const rhoPnL = rho * deltaR;

  const contributions = [
    { label: 'PV01', value: pv01PnL },
    { label: 'CS01', value: cs01PnL },
    { label: 'Equity delta', value: eqPnL },
    { label: 'FX delta', value: fxPnL },
    { label: 'Commodity delta', value: cmdPnL },
    { label: 'Option delta', value: deltaPnL },
    { label: 'Gamma', value: gammaPnL },
    { label: 'Vega', value: vegaPnL },
    { label: 'Theta', value: thetaPnL },
    { label: 'Rho', value: rhoPnL },
  ];

  const total = contributions.reduce((acc, item) => acc + item.value, 0);

  const tableBody = document.getElementById('sensitivityTableBody');
  const totalCell = document.getElementById('sensitivityTotal');
  if (tableBody) {
    tableBody.innerHTML = contributions
      .map((item) => `<tr><td>${item.label}</td><td>${formatCurrency(item.value)}</td></tr>`)
      .join('');
  }
  if (totalCell) {
    totalCell.textContent = formatCurrency(total);
  }

  updateSensitivityChart(contributions);
}

function updateSensitivityChart(contributions) {
  const ctx = document.getElementById('sensitivityChart');
  if (!ctx) return;
  if (sensitivityChartInstance) sensitivityChartInstance.destroy();

  sensitivityChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: contributions.map((item) => item.label),
      datasets: [
        {
          label: 'P&L ($)',
          data: contributions.map((item) => item.value),
          backgroundColor: contributions.map((_, idx) => `hsla(${(idx * 36) % 360},70%,65%,0.6)`),
          borderColor: 'rgba(37, 99, 235, 0.85)',
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
              return `${context.label}: ${formatCurrency(context.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.15)' },
        },
        y: {
          ticks: {
            color: 'rgba(30, 41, 59, 0.7)',
            callback: (value) => formatCurrency(value),
          },
          grid: { color: 'rgba(148, 163, 184, 0.15)' },
          title: { display: true, text: 'Contribution to P&L ($)', color: 'rgba(30, 41, 59, 0.75)' },
        },
      },
    },
  });
}

function updateStressResults() {
  const baseVar = Number(document.getElementById('stressVarInput').value) || 0;
  const baseEs = Number(document.getElementById('stressEsInput').value) || 0;
  const rateShock = Number(document.getElementById('stressRateShock').value) || 0;
  const equityShock = Number(document.getElementById('stressEquityShock').value) || 0;
  const volShock = Number(document.getElementById('stressVolShock').value) || 0;
  const correlation = Number(document.getElementById('stressCorrelation').value) || 0;

  document.getElementById('stressCorrelationLabel').textContent = correlation.toFixed(2);

  const rateFactor = 1 + Math.abs(rateShock) / 500; // 200 bps -> 1.4
  const equityFactor = 1 + Math.abs(equityShock) / 40; // 30% -> 1.75
  const volFactor = 1 + Math.abs(volShock) * 2;
  const correlationFactor = 1 + Math.max(correlation, 0) * 0.5;
  const totalFactor = rateFactor * equityFactor * volFactor * correlationFactor;

  const stressedVar = baseVar * totalFactor;
  const stressedEs = baseEs * (totalFactor + 0.1 * Math.sign(equityShock));

  document.getElementById('stressVarResult').textContent = formatCurrency(stressedVar);
  document.getElementById('stressEsResult').textContent = formatCurrency(stressedEs);
  document.getElementById('stressVarChange').textContent = `${formatCurrency(stressedVar - baseVar)} (${formatPercent(((stressedVar - baseVar) / (baseVar || 1)) * 100)})`;
  document.getElementById('stressEsChange').textContent = `${formatCurrency(stressedEs - baseEs)} (${formatPercent(((stressedEs - baseEs) / (baseEs || 1)) * 100)})`;
}

function attachVarListeners() {
  ['portfolioValueInput', 'meanReturnInput', 'volatilityInput', 'horizonInput', 'confidenceInput'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', computeVarMetrics);
      input.addEventListener('change', computeVarMetrics);
    }
  });
  computeVarMetrics();
}

function attachSensitivityListeners() {
  [
    'pv01Input',
    'cs01Input',
    'eqDeltaInput',
    'fxDeltaInput',
    'cmdDeltaInput',
    'deltaInput',
    'gammaInput',
    'vegaInput',
    'thetaInput',
    'rhoInput',
    'rateShockInput',
    'spreadShockInput',
    'eqShockInput',
    'fxShockInput',
    'priceChangeInput',
    'volChangeInput',
    'timeChangeInput',
    'rateChangeInput',
  ].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', computeSensitivities);
      input.addEventListener('change', computeSensitivities);
    }
  });
  computeSensitivities();
}

function attachStressListeners() {
  [
    'stressVarInput',
    'stressEsInput',
    'stressRateShock',
    'stressEquityShock',
    'stressVolShock',
    'stressCorrelation',
  ].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateStressResults);
      input.addEventListener('change', updateStressResults);
    }
  });
  updateStressResults();
}

window.addEventListener('DOMContentLoaded', () => {
  attachVarListeners();
  attachSensitivityListeners();
  attachStressListeners();
});
