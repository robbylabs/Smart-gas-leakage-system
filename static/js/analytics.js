/**
 * Smart Gas Leakage Detection System - Analytics Module JavaScript Client
 * Handles loading stats counters, Chart.js creations & streaming updates, 
 * summary sheets, and recent critical alert log population.
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM REFERENCES: CARDS ---
    const valTotal = document.getElementById("val-total");
    const valSafe = document.getElementById("val-safe");
    const valWarning = document.getElementById("val-warning");
    const valDanger = document.getElementById("val-danger");
    const valHighest = document.getElementById("val-highest");
    const valLowest = document.getElementById("val-lowest");
    const valAverage = document.getElementById("val-average");
    const valAlerts = document.getElementById("val-alerts");

    // --- DOM REFERENCES: SUMMARY SHEET ---
    const sumHighest = document.getElementById("sum-highest");
    const sumLowest = document.getElementById("sum-lowest");
    const sumAverage = document.getElementById("sum-average");
    const sumMedian = document.getElementById("sum-median");
    const sumSafePct = document.getElementById("sum-safe-pct");
    const sumWarningPct = document.getElementById("sum-warning-pct");
    const sumDangerPct = document.getElementById("sum-danger-pct");
    const sumLastUpdated = document.getElementById("sum-last-updated");

    // --- DOM REFERENCES: TABLES ---
    const recentAlertsTableBody = document.getElementById("recent-alerts-table-body");

    // --- GLOBAL CHART.JS INSTANCES ---
    let liveLineChart = null;
    let statusPieChart = null;
    let dailyBarChart = null;
    let weeklyLineChart = null;
    let alertDoughnutChart = null;

    // --- UPDATE STATE NUMBERS (Smooth fade effect) ---
    const updateText = (element, value, labelSuffix = "") => {
        if (!element) return;
        
        const cleanVal = `${value}${labelSuffix}`;
        if (element.textContent === cleanVal) return;

        element.classList.remove("fade-pulse");
        void element.offsetWidth; // Force layout recalculation
        element.classList.add("fade-pulse");
        element.textContent = cleanVal;
    };

    // --- CHART DRAWING & STREAMING ROUTINES ---

    // 1. Live Gas Level: Latest 20 readings line chart
    const updateLineChart = (chartData) => {
        const labels = chartData.map(r => formatTime(r.reading_time));
        const dataValues = chartData.map(r => r.gas_level);
        
        if (liveLineChart) {
            liveLineChart.data.labels = labels;
            liveLineChart.data.datasets[0].data = dataValues;
            liveLineChart.update('none'); // Update in place without reset animations for smooth rendering
        } else {
            const ctx = document.getElementById("live-line-chart").getContext("2d");
            liveLineChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Gas Level (PPM)',
                        data: dataValues,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: 'transparent',
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(30, 41, 59, 0.95)',
                            titleColor: '#f8fafc',
                            bodyColor: '#e2e8f0',
                            borderColor: '#475569',
                            borderWidth: 1,
                            padding: 10
                        }
                    },
                    scales: {
                        y: { 
                            min: 0, 
                            max: 550, 
                            grid: { color: 'rgba(255, 255, 255, 0.04)' }, 
                            ticks: { color: '#64748b' } 
                        },
                        x: { 
                            grid: { display: false }, 
                            ticks: { color: '#64748b', maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } 
                        }
                    }
                }
            });
        }
    };

    // 2. Status Distribution Pie Chart (Safe vs Warning vs Danger)
    const updatePieChart = (statusData) => {
        const dataValues = [statusData.safe, statusData.warning, statusData.danger];
        
        if (statusPieChart) {
            statusPieChart.data.datasets[0].data = dataValues;
            statusPieChart.update();
        } else {
            const ctx = document.getElementById("status-pie-chart").getContext("2d");
            statusPieChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Safe', 'Warning', 'Danger'],
                    datasets: [{
                        data: dataValues,
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 1,
                        borderColor: 'rgba(30, 41, 59, 0.5)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#64748b', boxWidth: 10, font: { size: 10 } }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(30, 41, 59, 0.95)',
                            borderColor: '#475569',
                            borderWidth: 1
                        }
                    }
                }
            });
        }
    };

    // 3. Daily Average Bar Chart
    const updateBarChart = (dailyData) => {
        const labels = dailyData.map(r => formatDateShort(r.date));
        const dataValues = dailyData.map(r => r.average);
        
        if (dailyBarChart) {
            dailyBarChart.data.labels = labels;
            dailyBarChart.data.datasets[0].data = dataValues;
            dailyBarChart.update();
        } else {
            const ctx = document.getElementById("daily-bar-chart").getContext("2d");
            dailyBarChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Average Level',
                        data: dataValues,
                        backgroundColor: 'rgba(245, 158, 11, 0.75)',
                        borderColor: '#f59e0b',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.95)' }
                    },
                    scales: {
                        y: { 
                            min: 0, 
                            max: 500, 
                            grid: { color: 'rgba(255, 255, 255, 0.04)' }, 
                            ticks: { color: '#64748b' } 
                        },
                        x: { 
                            grid: { display: false }, 
                            ticks: { color: '#64748b', autoSkip: true, maxTicksLimit: 7 } 
                        }
                    }
                }
            });
        }
    };

    // 4. Weekly Trend Line Chart
    const updateWeeklyChart = (weeklyData) => {
        const labels = weeklyData.map(r => r.date);
        const dataValues = weeklyData.map(r => r.average);
        
        if (weeklyLineChart) {
            weeklyLineChart.data.labels = labels;
            weeklyLineChart.data.datasets[0].data = dataValues;
            weeklyLineChart.update();
        } else {
            const ctx = document.getElementById("weekly-line-chart").getContext("2d");
            weeklyLineChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Weekly Mean PPM',
                        data: dataValues,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: 'transparent'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.95)' }
                    },
                    scales: {
                        y: { 
                            min: 0, 
                            max: 500, 
                            grid: { color: 'rgba(255, 255, 255, 0.04)' }, 
                            ticks: { color: '#64748b' } 
                        },
                        x: { 
                            grid: { display: false }, 
                            ticks: { color: '#64748b' } 
                        }
                    }
                }
            });
        }
    };

    // 5. Alert Distribution Doughnut Chart
    const updateDoughnutChart = (alertData) => {
        const dataValues = [alertData.warnings, alertData.danger_alerts];
        
        if (alertDoughnutChart) {
            alertDoughnutChart.data.datasets[0].data = dataValues;
            alertDoughnutChart.update();
        } else {
            const ctx = document.getElementById("alert-doughnut-chart").getContext("2d");
            alertDoughnutChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Warnings', 'Dangers'],
                    datasets: [{
                        data: dataValues,
                        backgroundColor: ['#f59e0b', '#ef4444'],
                        borderWidth: 1,
                        borderColor: 'rgba(30, 41, 59, 0.5)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#64748b', boxWidth: 10, font: { size: 10 } }
                        },
                        tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.95)' }
                    },
                    cutout: '65%'
                }
            });
        }
    };

    // --- FETCH DATA CONTROLLERS ---

    // Fetch Stats and update Cards & Sheet
    const fetchAnalyticsStats = async () => {
        try {
            const response = await fetch("/api/analytics");
            if (!response.ok) throw new Error("HTTP Error loading stats");
            const result = await response.json();
            
            if (result.status === "success") {
                const { 
                    highest_reading, lowest_reading, average_reading, median_reading,
                    total_readings, safe_count, warning_count, danger_count, total_alerts 
                } = result.data;

                // Update Stats Cards
                updateText(valTotal, total_readings);
                updateText(valSafe, safe_count);
                updateText(valWarning, warning_count);
                updateText(valDanger, danger_count);
                updateText(valHighest, highest_reading, " PPM");
                updateText(valLowest, lowest_reading, " PPM");
                updateText(valAverage, average_reading, " PPM");
                updateText(valAlerts, total_alerts);

                // Update Database Summary Sheet
                updateText(sumHighest, `${highest_reading} PPM`);
                updateText(sumLowest, `${lowest_reading} PPM`);
                updateText(sumAverage, `${average_reading} PPM`);
                updateText(sumMedian, `${median_reading} PPM`);

                // Calculate Percentages
                const safePct = total_readings > 0 ? ((safe_count / total_readings) * 100).toFixed(1) : "0.0";
                const warningPct = total_readings > 0 ? ((warning_count / total_readings) * 100).toFixed(1) : "0.0";
                const dangerPct = total_readings > 0 ? ((danger_count / total_readings) * 100).toFixed(1) : "0.0";

                updateText(sumSafePct, `${safePct}%`);
                updateText(sumWarningPct, `${warningPct}%`);
                updateText(sumDangerPct, `${dangerPct}%`);

                // Set Timestamp
                const now = new Date();
                updateText(sumLastUpdated, now.toLocaleTimeString('en-US', { hour12: false }));
            }
        } catch (error) {
            console.error("Analytics stats error:", error);
        }
    };

    // Fetch and Draw Recent Alerts
    const fetchRecentAlerts = async () => {
        try {
            const response = await fetch("/api/recent-alerts");
            if (!response.ok) throw new Error("Failed to load recent alerts");
            const result = await response.json();
            
            if (result.status === "success") {
                renderAlertsTable(result.data);
            }
        } catch (error) {
            console.error("Recent alerts load error:", error);
        }
    };

    // Fetch and Render Chart Data
    const fetchChartDatasets = async () => {
        try {
            const response = await fetch("/api/chart-data");
            if (!response.ok) throw new Error("Failed to load chart data");
            const result = await response.json();
            
            if (result.status === "success") {
                const { live_chart, status_dist, daily_avg, weekly_trend, alert_dist } = result.data;
                
                // Draw Charts
                updateLineChart(live_chart);
                updatePieChart(status_dist);
                updateBarChart(daily_avg);
                updateWeeklyChart(weekly_trend);
                updateDoughnutChart(alert_dist);
            }
        } catch (error) {
            console.error("Charts fetch error:", error);
        }
    };

    // --- RENDER TABLE ROWS ---
    const renderAlertsTable = (alerts) => {
        if (!recentAlertsTableBody) return;
        
        if (alerts.length === 0) {
            recentAlertsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-muted">
                        <i class="fas fa-shield-halved mb-2" style="font-size: 1.5rem; opacity: 0.5;"></i>
                        <div>No warning/danger incidents logged</div>
                    </td>
                </tr>
            `;
            return;
        }

        recentAlertsTableBody.innerHTML = "";
        alerts.forEach((a) => {
            const statusClass = a.status === "Danger" ? "text-danger fw-bold animate-pulse" : "text-warning fw-bold";
            recentAlertsTableBody.innerHTML += `
                <tr>
                    <td><strong>${a.gas_level} PPM</strong></td>
                    <td><span class="${statusClass}">${a.status}</span></td>
                    <td>${formatDateShort(a.reading_date)}</td>
                    <td>${formatTime(a.reading_time)}</td>
                </tr>
            `;
        });
    };

    // --- TIME AND DATE FORMAT HELPERS ---
    const formatTime = (timeStr) => {
        if (!timeStr) return "--:--";
        try {
            const parts = timeStr.split(".")[0].split(":");
            return `${parts[0]}:${parts[1]}`;
        } catch (e) {
            return timeStr;
        }
    };

    const formatDateShort = (dateStr) => {
        if (!dateStr) return "--";
        try {
            const parts = dateStr.split("-");
            if (parts.length !== 3) return dateStr;
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;
        } catch (e) {
            return dateStr;
        }
    };

    // --- SAFE DESTRUCTION CLEANUP ON NAVIGATE ---
    const destroyAllCharts = () => {
        if (liveLineChart) { liveLineChart.destroy(); liveLineChart = null; }
        if (statusPieChart) { statusPieChart.destroy(); statusPieChart = null; }
        if (dailyBarChart) { dailyBarChart.destroy(); dailyBarChart = null; }
        if (weeklyLineChart) { weeklyLineChart.destroy(); weeklyLineChart = null; }
        if (alertDoughnutChart) { alertDoughnutChart.destroy(); alertDoughnutChart = null; }
    };

    // Safe trigger to prevent memory leaks on page unload
    window.addEventListener("beforeunload", destroyAllCharts);

    // --- INITIAL DATA SEED AND TIMER LOOPS ---
    const initializeAnalytics = () => {
        fetchAnalyticsStats();
        fetchRecentAlerts();
        fetchChartDatasets();

        // Background dynamic loops updating every 2 seconds
        const pollInterval = setInterval(() => {
            // Verify if we are still active on the analytics page DOM
            if (!document.getElementById("live-line-chart")) {
                clearInterval(pollInterval);
                destroyAllCharts();
                return;
            }
            fetchAnalyticsStats();
            fetchRecentAlerts();
            fetchChartDatasets();
        }, 2000);
    };

    // Trigger initialisation
    initializeAnalytics();
});
