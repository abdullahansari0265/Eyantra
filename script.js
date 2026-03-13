import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getDatabase,
  ref,
  query,
  limitToLast,
  onValue,
  get,
  orderByChild,
  startAt,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCKSnCq2CReSmzWDQOvluBDzGAJuklQ-AM",
  authDomain: "lohiafarm.firebaseapp.com",
  databaseURL: "https://lohiafarm-default-rtdb.firebaseio.com",
  projectId: "lohiafarm",
  storageBucket: "lohiafarm.firebasestorage.app",
  messagingSenderId: "588921103145",
  appId: "1:588921103145:web:5fb53fa771b29560410d38",
  measurementId: "G-V8KD4B110F",
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const translations = {
  en: {
    title: "Lohia Farm Weather Station",
    lastUpdated: "Last Updated:",
    temp: "Temperature",
    hum: "Humidity",
    press: "Pressure",
    lux: "Light (Lux)",
    min: "Min",
    max: "Max",
    showPpm: "show ppm",
    showUg: "show µg/m³",
    tempTrend: "Temperature Trend",
    humTrend: "Humidity Trend",
    co2Trend: "CO2 Trend",
    pm25Trend: "PM 2.5 Trend",
  },
  hi: {
    title: "लोहिया फार्म मौसम केंद्र",
    lastUpdated: "अंतिम अपडेट:",
    temp: "तापमान",
    hum: "नमी",
    press: "दबाव",
    lux: "प्रकाश (Lux)",
    min: "न्यूनतम",
    max: "अधिकतम",
    showPpm: "ppm दिखाएं",
    showUg: "µg/m³ दिखाएं",
    tempTrend: "तापमान प्रवृत्ति",
    humTrend: "नमी प्रवृत्ति",
    co2Trend: "CO2 प्रवृत्ति",
    pm25Trend: "PM 2.5 प्रवृत्ति",
  },
  mr: {
    title: "लोहिया फार्म हवामान केंद्र",
    lastUpdated: "शेवटचे अपडेट:",
    temp: "तापमान",
    hum: "आर्द्रता",
    press: "दाब",
    lux: "प्रकाश (Lux)",
    min: "किमान",
    max: "कमाल",
    showPpm: "ppm दाखवा",
    showUg: "µg/m³ दाखवा",
    tempTrend: "तापमान कल",
    humTrend: "आर्द्रता कल",
    co2Trend: "CO2 कल",
    pm25Trend: "PM 2.5 कल",
  },
};

let currentLang = "en";
let currentData = null;

let tempChart, humChart, co2Chart, pm25Chart;
let pmUnits = { pm1: "ug", pm25: "ug", pm10: "ug" };
const UG_TO_PPM_MULTIPLIER = 0.001;

let dailyStats = {
  temperature: { min: Infinity, max: -Infinity, id: "temp" },
  humidity: { min: Infinity, max: -Infinity, id: "hum" },
  pressure: { min: Infinity, max: -Infinity, id: "press" },
  lux: { min: Infinity, max: -Infinity, id: "lux" },
  pm1: { min: Infinity, max: -Infinity, id: "pm1" },
  pm25: { min: Infinity, max: -Infinity, id: "pm25" },
  pm10: { min: Infinity, max: -Infinity, id: "pm10" },
  co2: { min: Infinity, max: -Infinity, id: "co2" },
};

const formatNum = (num, maxDecimals = 1) => {
  if (num === "--" || num === Infinity || num === -Infinity) return "--";
  let localeCode = "en-US";
  if (currentLang === "hi") localeCode = "hi-IN";
  if (currentLang === "mr") localeCode = "mr-IN";
  return new Intl.NumberFormat(localeCode, {
    numberingSystem: currentLang === "en" ? "latn" : "deva",
    maximumFractionDigits: Number.isInteger(num) ? 0 : maxDecimals,
  }).format(num);
};

const updateTextTranslations = () => {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (translations[currentLang][key]) el.innerText = translations[currentLang][key];
  });
  ["pm1", "pm25", "pm10"].forEach(sensor => {
    document.querySelector(`.toggle-btn[data-sensor="${sensor}"]`).innerText =
      pmUnits[sensor] === "ug"
        ? translations[currentLang].showPpm
        : translations[currentLang].showUg;
  });
};

const setupLangToggle = () => {
  document.getElementById("lang-toggle").addEventListener("change", e => {
    currentLang = e.target.value;
    updateTextTranslations();
    if (currentData) {
      updateCards(currentData);
      updateMinMaxUI();
      ["pm1", "pm25", "pm10"].forEach(renderPmCard);
    }
  });
};

const initCharts = () => {
  Chart.defaults.color = "#18207cff";// headings of charts
  Chart.defaults.borderColor = "rgba(255, 255, 255, 0.1)";
  Chart.defaults.font.family = "'Inter', sans-serif";

  const createChart = (ctx, label, color) => {
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: label,
            data: [],
            borderColor: color,
            backgroundColor: `${color}33`,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { ticks: { maxTicksLimit: 8 } } },
        animation: { duration: 0 },
      },
    });
  };

  tempChart = createChart(document.getElementById("tempChart"), "Temperature (°C)", "#ff8a65");
  humChart = createChart(document.getElementById("humChart"), "Humidity (%)", "#64b5f6");
  co2Chart = createChart(document.getElementById("co2Chart"), "CO2 (ppm)", "#ffb74d");
  pm25Chart = createChart(document.getElementById("pm25Chart"), "PM 2.5 (µg/m³)", "#ba68c8");
};


// updated code for light theme correction in graph
const setupThemeToggle = () => {
  const themeBtn = document.getElementById("theme-toggle");

  themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");

    themeBtn.innerText = isLight ? "🌙 Dark" : "☀️ Light";

    const textColor = isLight ? "#1a237e" : "rgba(255,255,255,0.7)";
    const gridColor = isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";

    [tempChart, humChart, co2Chart, pm25Chart].forEach(chart => {

      chart.options.scales.x.ticks.color = textColor;
      chart.options.scales.y.ticks.color = textColor;

      chart.options.scales.x.grid.color = gridColor;
      chart.options.scales.y.grid.color = gridColor;

      chart.update();
    });
  });
};

const setupToggleButtons = () => {
  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const sensor = e.target.dataset.sensor;
      pmUnits[sensor] = pmUnits[sensor] === "ug" ? "ppm" : "ug";
      e.target.innerText =
        pmUnits[sensor] === "ug"
          ? translations[currentLang].showPpm
          : translations[currentLang].showUg;
      renderPmCard(sensor);
    });
  });
};

const renderPmCard = sensor => {
  if (!currentData) return;
  const rawValue = currentData[sensor],
    stat = dailyStats[sensor];
  const valEl = document.getElementById(`val-${sensor}`),
    unitEl = document.getElementById(`unit-${sensor}`),
    minEl = document.getElementById(`val-min-${sensor}`),
    maxEl = document.getElementById(`val-max-${sensor}`);

  if (pmUnits[sensor] === "ug") {
    valEl.innerText = formatNum(rawValue, 0);
    unitEl.innerText = "µg/m³";
    if (stat.min !== Infinity) minEl.innerText = formatNum(stat.min, 0);
    if (stat.max !== -Infinity) maxEl.innerText = formatNum(stat.max, 0);
  } else {
    valEl.innerText = formatNum(rawValue * UG_TO_PPM_MULTIPLIER, 3);
    unitEl.innerText = "ppm";
    if (stat.min !== Infinity) minEl.innerText = formatNum(stat.min * UG_TO_PPM_MULTIPLIER, 3);
    if (stat.max !== -Infinity) maxEl.innerText = formatNum(stat.max * UG_TO_PPM_MULTIPLIER, 3);
  }
};

const fetchDailyMinMax = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayQuery = query(
    ref(db, "weather"),
    orderByChild("timestamp"),
    startAt(startOfDay.getTime())
  );
  try {
    const snapshot = await get(todayQuery);
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const data = child.val();
        Object.keys(dailyStats).forEach(key => {
          if (data[key] !== undefined) {
            if (data[key] < dailyStats[key].min) dailyStats[key].min = data[key];
            if (data[key] > dailyStats[key].max) dailyStats[key].max = data[key];
          }
        });
      });
      updateMinMaxUI();
      ["pm1", "pm25", "pm10"].forEach(renderPmCard);
    }
  } catch (error) {
    console.error("Error fetching daily min/max:", error);
  }
};

const updateMinMaxUI = () => {
  ["temperature", "humidity", "pressure", "lux", "co2"].forEach(key => {
    const stat = dailyStats[key];
    if (stat.min !== Infinity)
      document.getElementById(`val-min-${stat.id}`).innerText = formatNum(stat.min);
    if (stat.max !== -Infinity)
      document.getElementById(`val-max-${stat.id}`).innerText = formatNum(stat.max);
  });
};

const updateCards = data => {
  currentData = data;
  document.getElementById("val-temp").innerText = formatNum(data.temperature);
  document.getElementById("val-hum").innerText = formatNum(data.humidity);
  document.getElementById("val-press").innerText = formatNum(data.pressure);
  document.getElementById("val-lux").innerText = formatNum(data.lux);
  document.getElementById("val-co2").innerText = formatNum(data.co2);

  Object.keys(dailyStats).forEach(key => {
    if (data[key] !== undefined) {
      if (data[key] < dailyStats[key].min) dailyStats[key].min = data[key];
      if (data[key] > dailyStats[key].max) dailyStats[key].max = data[key];
    }
  });
  updateMinMaxUI();
  renderPmCard("pm1");
  renderPmCard("pm25");
  renderPmCard("pm10");

  const date = new Date(data.timestamp);
  const localeCode = currentLang === "hi" ? "hi-IN" : currentLang === "mr" ? "mr-IN" : "en-US";
  document.getElementById("timestamp").innerText = new Intl.DateTimeFormat(localeCode, {
    dateStyle: "short",
    timeStyle: "medium",
    numberingSystem: currentLang === "en" ? "latn" : "deva",
  }).format(date);
};

const updateCharts = (labels, temps, hums, co2s, pm25s) => {
  tempChart.data.labels = labels;
  tempChart.data.datasets[0].data = temps;
  tempChart.update();
  humChart.data.labels = labels;
  humChart.data.datasets[0].data = hums;
  humChart.update();
  co2Chart.data.labels = labels;
  co2Chart.data.datasets[0].data = co2s;
  co2Chart.update();
  pm25Chart.data.labels = labels;
  pm25Chart.data.datasets[0].data = pm25s;
  pm25Chart.update();
};

const startDataListener = () => {
  onValue(query(ref(db, "weather"), limitToLast(20)), snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const keys = Object.keys(data);
      updateCards(data[keys[keys.length - 1]]);

      const labels = [],
        temps = [],
        hums = [],
        co2s = [],
        pm25s = [];
      const localeCode = currentLang === "hi" ? "hi-IN" : currentLang === "mr" ? "mr-IN" : "en-US";
      keys.forEach(key => {
        const entry = data[key];
        labels.push(
          new Intl.DateTimeFormat(localeCode, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            numberingSystem: currentLang === "en" ? "latn" : "deva",
          }).format(new Date(entry.timestamp))
        );
        temps.push(entry.temperature);
        hums.push(entry.humidity);
        co2s.push(entry.co2);
        pm25s.push(entry.pm25);
      });
      updateCharts(labels, temps, hums, co2s, pm25s);
    }
  });
};

window.onload = () => {
  initCharts();
  setupThemeToggle();
  setupLangToggle();
  setupToggleButtons();
  fetchDailyMinMax();
  startDataListener();
};