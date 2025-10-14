let irmShortChart = null;
let irmYieldChart = null;

const irmDefaults = {
  r0: 2.5,
  theta: 3.5,
  kappa: 0.6,
  sigma: 1.5,
  tilt: 120,
  decay: 4,
};

function toDecimal(value) {
  return Number(value) || 0;
}

function getIrmParams() {
  return {
    r0: toDecimal(document.getElementById('irmInitialRate').value) / 100,
    theta: toDecimal(document.getElementById('irmLongRunRate').value) / 100,
    kappa: Math.max(0.01, toDecimal(document.getElementById('irmMeanReversion').value)),
    sigma: Math.max(0, toDecimal(document.getElementById('irmVolatility').value) / 100),
    tilt: toDecimal(document.getElementById('irmTilt').value) / 10000,
    decay: Math.max(0.1, toDecimal(document.getElementById('irmDecay').value)),
  };
}

function expectedShortRate(t, params) {
  const { r0, theta, kappa, tilt, decay } = params;
  const hwTarget = theta + tilt * Math.exp(-decay * t);
  return hwTarget + (r0 - hwTarget) * Math.exp(-kappa * t);
}

function expectedYield(maturity, params) {
  const steps = Math.max(10, Math.round(maturity * 24));
  let integral = 0;
  const dt = maturity / steps;
  for (let i = 0; i < steps; i += 1) {
    const time = (i + 0.5) * dt;
    integral += expectedShortRate(time, params);
  }
  return integral * dt / maturity;
}

function buildTimeline(maxYears = 30, step = 0.25) {
  const timeline = [];
  for (let t = 0; t <= maxYears + 1e-8; t += step) {
    timeline.push(Number(t.toFixed(2)));
  }
  return timeline;
}

function updateIrmCharts() {
  const params = getIrmParams();
  const timeline = buildTimeline(20, 0.25);
  const maturities = [0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30];

  const expectedPath = timeline.map((t) => expectedShortRate(t, params) * 100);
  const yields = maturities.map((T) => expectedYield(T, params) * 100);

  const shortCtx = document.getElementById('irmShortRateChart');
  if (irmShortChart) irmShortChart.destroy();
  irmShortChart = new Chart(shortCtx, {
    type: 'line',
    data: {
      labels: timeline,
      datasets: [
        {
          label: 'Expected short rate',
          data: expectedPath,
          borderColor: 'rgba(37, 99, 235, 1)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          tension: 0.25,
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
              return `${context.parsed.y.toFixed(2)}% at t=${context.label}y`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Years ahead', color: 'rgba(30, 41, 59, 0.75)' },
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
        },
        y: {
          title: { display: true, text: 'Rate (%)', color: 'rgba(30, 41, 59, 0.75)' },
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
        },
      },
    },
  });

  const yieldCtx = document.getElementById('irmYieldChart');
  if (irmYieldChart) irmYieldChart.destroy();
  irmYieldChart = new Chart(yieldCtx, {
    type: 'line',
    data: {
      labels: maturities,
      datasets: [
        {
          label: 'Spot yield',
          data: yields,
          borderColor: 'rgba(129, 140, 248, 1)',
          backgroundColor: 'rgba(129, 140, 248, 0.1)',
          borderWidth: 2,
          tension: 0.25,
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
              return `${context.parsed.y.toFixed(2)}% at ${context.label}y`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Maturity (years)', color: 'rgba(30, 41, 59, 0.75)' },
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
        },
        y: {
          title: { display: true, text: 'Yield (%)', color: 'rgba(30, 41, 59, 0.75)' },
          ticks: { color: 'rgba(30, 41, 59, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
        },
      },
    },
  });
}

function attachIrmControls() {
  const ids = [
    'irmInitialRate',
    'irmLongRunRate',
    'irmMeanReversion',
    'irmVolatility',
    'irmTilt',
    'irmDecay',
  ];
  ids.forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateIrmCharts);
      input.addEventListener('change', updateIrmCharts);
    }
  });

  const resetBtn = document.getElementById('irmReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', (event) => {
      event.preventDefault();
      document.getElementById('irmInitialRate').value = irmDefaults.r0;
      document.getElementById('irmLongRunRate').value = irmDefaults.theta;
      document.getElementById('irmMeanReversion').value = irmDefaults.kappa;
      document.getElementById('irmVolatility').value = irmDefaults.sigma;
      document.getElementById('irmTilt').value = irmDefaults.tilt;
      document.getElementById('irmDecay').value = irmDefaults.decay;
      updateIrmCharts();
    });
  }
}

function setupPageNav() {
  const links = Array.from(document.querySelectorAll('.page-nav__link'));
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const index = sections.indexOf(entry.target);
        if (index >= 0) {
          const link = links[index];
          if (entry.isIntersecting) {
            links.forEach((l) => l.classList.remove('is-active'));
            link.classList.add('is-active');
          }
        }
      });
    },
    { rootMargin: '-50% 0px -45% 0px', threshold: [0, 1] }
  );

  sections.forEach((section) => observer.observe(section));
}

window.addEventListener('DOMContentLoaded', () => {
  attachIrmControls();
  updateIrmCharts();
  setupPageNav();
});
