/**
 * Chart Display Module
 * Handles the visualization of posture data using Chart.js
 */

// Data for posture chart
let postureChartData = {
    labels: [],
    goodPostureData: [],
    badPostureData: []
};

// Chart instance
let postureChart = null;

// Max data points to display
const MAX_DATA_POINTS = 60;

// Update frequency (seconds)
const UPDATE_INTERVAL = 1;

// Last update timestamp
let lastChartUpdate = 0;

/**
 * Initialize posture chart
 */
function initializePostureChart() {
    const ctx = document.getElementById('postureChart').getContext('2d');
    
    // Reset chart data
    resetPostureChartData();
    
    // Create chart
    postureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: postureChartData.labels,
            datasets: [
                {
                    label: 'Good Posture',
                    data: postureChartData.goodPostureData,
                    borderColor: '#4caf50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    fill: true,
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 0
                },
                {
                    label: 'Poor Posture',
                    data: postureChartData.badPostureData,
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    fill: true,
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return value === 1 ? 'Yes' : 'No';
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 6,
                        maxRotation: 0
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            animation: {
                duration: 0
            }
        }
    });
    
    // Make chart instance globally accessible
    window.postureChart = postureChart;
}

/**
 * Reset chart data
 */
function resetPostureChartData() {
    postureChartData = {
        labels: [],
        goodPostureData: [],
        badPostureData: []
    };
    
    // Initialize with empty data
    for (let i = 0; i < MAX_DATA_POINTS; i++) {
        const timeLabel = formatTimeLabel(i);
        postureChartData.labels.push(timeLabel);
        postureChartData.goodPostureData.push(null);
        postureChartData.badPostureData.push(null);
    }
}

/**
 * Format time label for chart
 */
function formatTimeLabel(secondsAgo) {
    const now = new Date();
    const time = new Date(now.getTime() - secondsAgo * 1000);
    return time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false
    });
}

/**
 * Update chart with new posture data
 */
function updatePostureChart(isGoodPosture) {
    const now = Date.now();
    
    // Only update chart every UPDATE_INTERVAL seconds
    if (now - lastChartUpdate < UPDATE_INTERVAL * 1000) {
        return;
    }
    
    lastChartUpdate = now;
    
    // Shift arrays to remove oldest data point
    postureChartData.labels.shift();
    postureChartData.goodPostureData.shift();
    postureChartData.badPostureData.shift();
    
    // Add new data point
    const timeLabel = formatTimeLabel(0);
    postureChartData.labels.push(timeLabel);
    postureChartData.goodPostureData.push(isGoodPosture ? 1 : 0);
    postureChartData.badPostureData.push(isGoodPosture ? 0 : 1);
    
    // Update chart
    if (postureChart) {
        postureChart.data.labels = postureChartData.labels;
        postureChart.data.datasets[0].data = postureChartData.goodPostureData;
        postureChart.data.datasets[1].data = postureChartData.badPostureData;
        postureChart.update();
    }
}

/**
 * Reset posture chart
 */
function resetPostureChart() {
    resetPostureChartData();
    
    if (postureChart) {
        postureChart.data.labels = postureChartData.labels;
        postureChart.data.datasets[0].data = postureChartData.goodPostureData;
        postureChart.data.datasets[1].data = postureChartData.badPostureData;
        postureChart.update();
    }
    
    lastChartUpdate = 0;
}

// Expose functions globally
window.initializePostureChart = initializePostureChart;
window.updatePostureChart = updatePostureChart;
window.resetPostureChart = resetPostureChart;