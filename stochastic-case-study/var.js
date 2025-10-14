let normalChart = null;

function normalPdf(x) {
  const coeff = 1 / Math.sqrt(2 * Math.PI);
  return coeff * Math.exp(-0.5 * x * x);
}

function buildNormalChart() {
  const ctx = document.getElementById('normalChart').getContext('2d');
  const xs = [];
  const pdf = [];
  const tail = [];
  const xMin = -4;
  const xMax = 4;
  const step = 0.05;
  const varCutoff = -1.6448536269514722; // 5% left-tail threshold for 95% VaR.

  for (let x = xMin; x <= xMax + 1e-6; x += step) {
    const value = normalPdf(x);
    xs.push(Number(x.toFixed(2)));
    pdf.push(value);
    tail.push(x <= varCutoff ? value : null);
  }

  if (normalChart) {
    normalChart.destroy();
  }

  normalChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: xs,
      datasets: [
        {
          label: 'Standard Normal PDF',
          data: pdf,
          borderColor: 'rgba(37, 99, 235, 1)',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          fill: false,
          tension: 0.25,
          pointRadius: 0
        },
        {
          label: '5% Loss Tail',
          data: tail,
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.3)',
          fill: true,
          tension: 0.25,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: 'rgba(30, 41, 59, 0.7)',
            font: { family: 'Inter' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#1f2937',
          callbacks: {
            label(context) {
              const value = context.parsed.y ?? 0;
              return `${context.dataset.label}: ${value.toFixed(4)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          title: {
            display: true,
            text: 'Standardised Return (σ units)',
            color: 'rgba(30, 41, 59, 0.8)',
            font: { family: 'Inter', weight: 500 }
          }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          title: {
            display: true,
            text: 'Probability Density',
            color: 'rgba(30, 41, 59, 0.8)',
            font: { family: 'Inter', weight: 500 }
          },
          suggestedMin: 0
        }
      }
    }
  });
}

function randomNormal() {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function simulateFullRevaluation({ portfolioValue, mu, sigma, horizonDays, paths, confidence }) {
  const dt = horizonDays / 252;
  const sqrtDt = Math.sqrt(dt);
  const pnl = new Array(paths);

  for (let i = 0; i < paths; i++) {
    const z = randomNormal();
    const revalued = portfolioValue * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * sqrtDt * z);
    pnl[i] = revalued - portfolioValue;
  }

  pnl.sort((a, b) => a - b);

  const tailFraction = 1 - confidence / 100;
  const index = Math.max(0, Math.floor(tailFraction * paths) - 1);
  const lossAtQuantile = pnl[index];
  const varAbsolute = -lossAtQuantile;
  const varPercent = (varAbsolute / portfolioValue) * 100;

  const mean = pnl.reduce((acc, value) => acc + value, 0) / paths;
  const tailLosses = pnl.filter(value => value <= lossAtQuantile);
  const cvar = tailLosses.length
    ? -tailLosses.reduce((acc, value) => acc + value, 0) / tailLosses.length
    : 0;

  return {
    varAbsolute,
    varPercent,
    mean,
    cvar
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function updateResults(results) {
  const { varAbsolute, varPercent, mean, cvar } = results;
  const varAbsNode = document.getElementById('varAbsolute');
  const varPctNode = document.getElementById('varPercent');
  const meanNode = document.getElementById('meanPnL');
  const cvarNode = document.getElementById('cvarResult');

  varAbsNode.textContent = `${formatCurrency(-Math.abs(varAbsolute))} loss`;
  varPctNode.textContent = `-${formatPercent(Math.abs(varPercent))}`;
  meanNode.textContent = formatCurrency(mean);
  cvarNode.textContent = `${formatCurrency(-Math.abs(cvar))} loss`;
}

function runSimulationFromInputs() {
  const portfolioValue = Number(document.getElementById('portfolioValue').value);
  const mu = Number(document.getElementById('expectedReturn').value);
  const sigma = Number(document.getElementById('volatilityInput').value);
  const horizonDays = Number(document.getElementById('horizon').value);
  const paths = Number(document.getElementById('paths').value);
  const confidence = Number(document.getElementById('confidence').value);

  if (!portfolioValue || !sigma || !horizonDays || !paths) {
    return;
  }

  const results = simulateFullRevaluation({
    portfolioValue,
    mu,
    sigma,
    horizonDays,
    paths,
    confidence
  });

  updateResults(results);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('normalChart')) {
    buildNormalChart();
  }

  const button = document.getElementById('runSimulation');
  if (button) {
    button.addEventListener('click', runSimulationFromInputs);
    runSimulationFromInputs();
  }
});
