// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, query, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCKSnCq2CReSmzWDQOvluBDzGAJuklQ-AM",
  authDomain: "lohiafarm.firebaseapp.com",
  databaseURL: "https://lohiafarm-default-rtdb.firebaseio.com",
  projectId: "lohiafarm",
  storageBucket: "lohiafarm.firebasestorage.app",
  messagingSenderId: "588921103145",
  appId: "1:588921103145:web:5fb53fa771b29560410d38",
  measurementId: "G-V8KD4B110F"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let tempChart, humChart, co2Chart, pm25Chart;

// State management for PM units
let latestRawData = { pm1: 0, pm25: 0, pm10: 0 };
let pmUnits = { pm1: 'ug', pm25: 'ug', pm10: 'ug' }; // 'ug' stands for µg/m³

// The mock conversion factor. Update this if you have a real formula.
const UG_TO_PPM_MULTIPLIER = 0.001; 

const initCharts = () => {
    Chart.defaults.color = '#a0a0a0';
    Chart.defaults.borderColor = '#333';

    const createChart = (ctx, label, color) => {
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: label,
                    data: [],
                    borderColor: color,
                    backgroundColor: `${color}33`, 
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { ticks: { maxTicksLimit: 8 } } },
                animation: { duration: 0 }
            }
        });
    };

    tempChart = createChart(document.getElementById('tempChart'), 'Temperature (°C)', '#ff5252');
    humChart = createChart(document.getElementById('humChart'), 'Humidity (%)', '#448aff');
    co2Chart = createChart(document.getElementById('co2Chart'), 'CO2 (ppm)', '#ffab40');
    pm25Chart = createChart(document.getElementById('pm25Chart'), 'PM 2.5 (µg/m³)', '#e040fb');
};

// Handle Button Clicks
const setupToggleButtons = () => {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sensor = e.target.dataset.sensor; // gets 'pm1', 'pm25', or 'pm10'
            
            // Toggle the state
            pmUnits[sensor] = pmUnits[sensor] === 'ug' ? 'ppm' : 'ug';
            
            // Update button text
            e.target.innerText = pmUnits[sensor] === 'ug' ? 'show ppm' : 'show µg/m³';
            
            // Re-render that specific card
            renderPmCard(sensor);
        });
    });
};

// Calculate and render the value based on current unit state
const renderPmCard = (sensor) => {
    const rawValue = latestRawData[sensor];
    const valueElement = document.getElementById(`val-${sensor}`);
    const unitElement = document.getElementById(`unit-${sensor}`);

    if (pmUnits[sensor] === 'ug') {
        valueElement.innerText = rawValue;
        unitElement.innerText = 'µg/m³';
    } else {
        // Apply dummy conversion for PPM
        const ppmValue = (rawValue * UG_TO_PPM_MULTIPLIER).toFixed(3);
        valueElement.innerText = ppmValue;
        unitElement.innerText = 'ppm';
    }
};

const updateCards = (data) => {
    document.getElementById('val-temp').innerText = data.temperature.toFixed(1);
    document.getElementById('val-hum').innerText = data.humidity.toFixed(1);
    document.getElementById('val-press').innerText = data.pressure.toFixed(1);
    document.getElementById('val-lux').innerText = data.lux.toFixed(1);
    document.getElementById('val-co2').innerText = data.co2;

    // Save raw PM data to state so we can toggle it without waiting for next Firebase update
    latestRawData.pm1 = data.pm1;
    latestRawData.pm25 = data.pm25;
    latestRawData.pm10 = data.pm10;

    // Render PM cards based on their individual toggle states
    renderPmCard('pm1');
    renderPmCard('pm25');
    renderPmCard('pm10');

    const date = new Date(data.timestamp);
    document.getElementById('timestamp').innerText = date.toLocaleString();
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
    const weatherRef = query(ref(db, 'weather'), limitToLast(20));

    onValue(weatherRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const keys = Object.keys(data);
            
            const latestKey = keys[keys.length - 1];
            const latestData = data[latestKey];
            updateCards(latestData);

            const labels = [];
            const temps = [];
            const hums = [];
            const co2s = [];
            const pm25s = [];

            keys.forEach(key => {
                const entry = data[key];
                const time = new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                labels.push(time);
                temps.push(entry.temperature);
                hums.push(entry.humidity);
                co2s.push(entry.co2);
                pm25s.push(entry.pm25); // Chart always uses raw µg/m³
            });

            updateCharts(labels, temps, hums, co2s, pm25s);
        }
    });
};

window.onload = () => {
    initCharts();
    setupToggleButtons();
    startDataListener();
};