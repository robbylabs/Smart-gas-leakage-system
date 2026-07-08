/**
 * Smart Gas Leakage Detection System - Dashboard JavaScript Client
 * Handles real-time polling (simulation), DOM updates, Audio alarms, 
 * Toast triggers, Progress bar, and sidebar animations.
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM ELEMENT REFERENCES ---
    const wrapper = document.getElementById("wrapper");
    const menuToggle = document.getElementById("menu-toggle");
    const darkModeToggle = document.getElementById("dark-mode-toggle");
    const darkModeIcon = darkModeToggle.querySelector("i");
    
    // Header Info
    const dateDisplay = document.getElementById("date-display");
    const timeDisplay = document.getElementById("time-display");
    
    // Stat Cards
    const cardGasLevel = document.getElementById("card-gas-level");
    const valGasLevel = document.getElementById("val-gas-level");
    const descGasLevel = document.getElementById("desc-gas-level");
    const gasProgressBar = document.getElementById("gas-progress-bar");
    
    const cardStatus = document.getElementById("card-status");
    const valStatus = document.getElementById("val-status");
    const descStatus = document.getElementById("desc-status");
    
    const valHighest = document.getElementById("val-highest");
    const valAverage = document.getElementById("val-average");
    const valTotal = document.getElementById("val-total");
    const valAlerts = document.getElementById("val-alerts");
    
    // Critical Alarm Elements
    const dangerBanner = document.getElementById("danger-banner");
    const toastEl = document.getElementById("alarm-toast");
    
    // Table Body & Container
    const tableBody = document.getElementById("readings-table-body");
    const errorContainer = document.getElementById("error-container");
    const pulseSpinner = document.getElementById("pulse-spinner");

    // --- ALARM SOUND STATE (Web Audio API) ---
    let audioCtx = null;
    let alarmInterval = null;

    // --- STATE VARIABLES ---
    let secondsSinceLastUpdate = 0;
    let updateTimerInterval = null;
    let isInitialLoad = true;

    // --- SIDEBAR TOGGLE ACTION ---
    if (menuToggle) {
        menuToggle.addEventListener("click", (e) => {
            e.preventDefault();
            wrapper.classList.toggle("toggled");
        });
    }

    // --- DARK MODE TOGGLE & LOCAL STORAGE ---
    const enableDarkMode = () => {
        document.body.classList.add("dark-mode");
        darkModeIcon.classList.remove("fa-moon");
        darkModeIcon.classList.add("fa-sun");
        localStorage.setItem("darkMode", "enabled");
    };

    const disableDarkMode = () => {
        document.body.classList.remove("dark-mode");
        darkModeIcon.classList.remove("fa-sun");
        darkModeIcon.classList.add("fa-moon");
        localStorage.setItem("darkMode", "disabled");
    };

    // Apply persisted theme on load
    if (localStorage.getItem("darkMode") === "enabled") {
        enableDarkMode();
    } else {
        disableDarkMode();
    }

    darkModeToggle.addEventListener("click", () => {
        if (document.body.classList.contains("dark-mode")) {
            disableDarkMode();
        } else {
            enableDarkMode();
        }
    });

    // --- CLOCK AND DATE DISPLAY ---
    const updateClock = () => {
        const now = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
        dateDisplay.textContent = now.toLocaleDateString('en-US', dateOptions);
        timeDisplay.textContent = now.toLocaleTimeString('en-US', { hour12: true });
    };
    
    updateClock();
    setInterval(updateClock, 1000);

    // --- LAST UPDATED COUNT TIMER ---
    const resetUpdateTimer = () => {
        secondsSinceLastUpdate = 0;
        if (descGasLevel) {
            descGasLevel.textContent = "Last update: just now";
        }
        if (updateTimerInterval) clearInterval(updateTimerInterval);
        
        updateTimerInterval = setInterval(() => {
            secondsSinceLastUpdate++;
            if (descGasLevel) {
                descGasLevel.textContent = `Last update: ${secondsSinceLastUpdate}s ago`;
            }
        }, 1000);
    };

    // --- WEB AUDIO API ALARM SYNTHESIS ---
    const startAlarmSound = () => {
        if (alarmInterval) return; // Already running
        
        // Lazy initialize AudioContext on user interaction
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        alarmInterval = setInterval(() => {
            if (!audioCtx) return;
            
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            // Sweep frequency sound mimicking an industrial emergency alert
            osc.type = 'sawtooth';
            const now = audioCtx.currentTime;
            osc.frequency.setValueAtTime(880, now); // A5 note
            osc.frequency.linearRampToValueAtTime(1150, now + 0.35); // Sweep upward
            
            gain.gain.setValueAtTime(0.08, now); // Reasonable volume
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38); // Decay
            
            osc.start(now);
            osc.stop(now + 0.4);
        }, 450); // Repeat cycle every 450ms
    };

    const stopAlarmSound = () => {
        if (alarmInterval) {
            clearInterval(alarmInterval);
            alarmInterval = null;
        }
    };

    // --- SMOOTH NUMERIC ANIMATION FUNCTION ---
    const animateValue = (element, targetValue, duration = 600, isFloat = false) => {
        if (!element) return;
        
        // Extract starting value from dataset or default to 0
        const startValue = parseFloat(element.dataset.value || "0");
        if (startValue === targetValue) {
            updateText(element, targetValue, isFloat);
            return;
        }
        
        // Save target value to dataset for subsequent transitions
        element.dataset.value = targetValue;
        const startTime = performance.now();
        
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing formula (Ease Out Quad)
            const easeProgress = progress * (2 - progress);
            
            const currentValue = startValue + (targetValue - startValue) * easeProgress;
            const finalVal = isFloat ? parseFloat(currentValue.toFixed(1)) : Math.floor(currentValue);
            
            updateText(element, finalVal, isFloat);
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                updateText(element, targetValue, isFloat);
            }
        };
        
        requestAnimationFrame(update);
    };

    const updateText = (element, value, isFloat) => {
        // Trigger a CSS fade animation pulse on value changes
        element.classList.remove("fade-pulse");
        void element.offsetWidth; // Trigger reflow to restart keyframe
        element.classList.add("fade-pulse");
        
        if (element.id === "val-gas-level" || element.id === "val-highest" || element.id === "val-average") {
            element.textContent = `${value} PPM`;
        } else {
            element.textContent = value;
        }
    };

    // --- FETCH DATA (INITIAL READ FROM DATABASE) ---
    const fetchDashboardData = async () => {
        if (pulseSpinner) pulseSpinner.style.display = "block";
        
        try {
            const response = await fetch("/api/dashboard");
            if (!response.ok) {
                throw new Error(`HTTP Error! Status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === "success") {
                hideError();
                updateDashboardUI(result.data);
                resetUpdateTimer();
            } else {
                showError(result.message || "Failed to load dashboard details.");
            }
        } catch (error) {
            console.error("Fetch API error:", error);
            showError("Unable to fetch initial dashboard details.");
        } finally {
            if (pulseSpinner) pulseSpinner.style.display = "none";
            isInitialLoad = false;
        }
    };

    // --- SIMULATE GAS READING (POLL TIMER EVENT ROUTINE) ---
    const simulateGasReading = async () => {
        if (pulseSpinner) pulseSpinner.style.display = "block";
        
        try {
            // Post trigger to simulate and store
            const response = await fetch("/api/simulate", {
                method: "POST"
            });
            if (!response.ok) {
                throw new Error(`HTTP Error! Status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === "success") {
                hideError();
                updateDashboardUI(result.data);
                resetUpdateTimer();
            } else {
                showError(result.message || "Simulation trigger failed.");
            }
        } catch (error) {
            console.error("Simulation endpoint error:", error);
            showError("Telemetry link interrupted. Attempting reconnection...");
        } finally {
            if (pulseSpinner) pulseSpinner.style.display = "none";
        }
    };

    // --- UPDATE UI ELEMENTS ---
    const updateDashboardUI = (data) => {
        const { current_reading, highest_reading, average_reading, total_readings, total_alerts, latest_10_readings } = data;

        // 1. Update Statistical Card Values with animations
        animateValue(valHighest, highest_reading);
        animateValue(valAverage, average_reading, 600, true);
        animateValue(valTotal, total_readings);
        animateValue(valAlerts, total_alerts);

        // Handles empty database state
        if (!current_reading) {
            valGasLevel.textContent = "--";
            if (descGasLevel) descGasLevel.textContent = "No data received";
            
            valStatus.innerHTML = `<span class="badge-status">N/A</span>`;
            descStatus.textContent = "Waiting for sensor input...";
            
            cardGasLevel.className = "stat-card";
            cardStatus.className = "stat-card";
            
            if (gasProgressBar) {
                gasProgressBar.style.width = "0%";
                gasProgressBar.className = "progress-bar progress-bar-striped progress-bar-animated bg-success";
            }
            
            if (dangerBanner) dangerBanner.classList.add("d-none");
            stopAlarmSound();
            renderEmptyTable();
            return;
        }

        // Update animated gas level
        animateValue(valGasLevel, current_reading.gas_level);

        // 2. Manage Threshold Progress Bar
        if (gasProgressBar) {
            // Map 0-500 PPM range to 0-100% progress width
            const progressPercent = Math.min(Math.max((current_reading.gas_level / 500) * 100, 0), 100);
            gasProgressBar.style.width = `${progressPercent}%`;
            gasProgressBar.setAttribute("aria-valuenow", current_reading.gas_level);
            
            // Adjust bar colors dynamically
            gasProgressBar.className = "progress-bar progress-bar-striped progress-bar-animated";
            if (current_reading.status === "Safe") {
                gasProgressBar.classList.add("bg-success");
            } else if (current_reading.status === "Warning") {
                gasProgressBar.classList.add("bg-warning");
            } else if (current_reading.status === "Danger") {
                gasProgressBar.classList.add("bg-danger");
            }
        }

        // 3. Status Level Logic & Dynamic Classes
        let badgeHTML = "";
        let cardClassSuffix = "";
        let statusDescription = "";

        if (current_reading.status === "Safe") {
            badgeHTML = `<span class="badge-status">Safe</span>`;
            cardClassSuffix = "card-safe";
            statusDescription = "Gas concentrations are normal.";
            
            // Revert alerts
            if (dangerBanner) dangerBanner.classList.add("d-none");
            cardStatus.classList.remove("flashing");
            stopAlarmSound();
        } else if (current_reading.status === "Warning") {
            badgeHTML = `<span class="badge-status">Warning</span>`;
            cardClassSuffix = "card-warning";
            statusDescription = "Elevated gas levels detected.";
            
            // Revert alerts
            if (dangerBanner) dangerBanner.classList.add("d-none");
            cardStatus.classList.remove("flashing");
            stopAlarmSound();
        } else if (current_reading.status === "Danger") {
            badgeHTML = `<span class="badge-status">Danger</span>`;
            cardClassSuffix = "card-danger";
            statusDescription = "CRITICAL LEAK! Evacuate area.";
            
            // --- ALERT EMERGENCIES ACTIVATION ---
            // Display Warning banner
            if (dangerBanner) {
                dangerBanner.classList.remove("d-none");
                dangerBanner.classList.add("d-flex");
            }
            
            // Flashing Red card shadow border
            cardStatus.classList.add("flashing");
            
            // Play alarm synthesized siren
            startAlarmSound();
            
            // Show Bootstrap Toast notification
            if (toastEl && !toastEl.classList.contains("show")) {
                const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
                toast.show();
            }
        }

        // Apply visual themes
        cardGasLevel.className = `stat-card ${cardClassSuffix}`;
        cardStatus.className = `stat-card ${cardClassSuffix} ${current_reading.status === "Danger" ? "flashing" : ""}`;
        
        valStatus.innerHTML = badgeHTML;
        descStatus.textContent = statusDescription;

        // 4. Render Table Rows
        if (latest_10_readings.length === 0) {
            renderEmptyTable();
        } else {
            renderTableRows(latest_10_readings);
        }
    };

    // Helper: Formats 24h reading_time (HH:MM:SS) to localized readable format
    const formatTime = (timeStr) => {
        if (!timeStr) return "--";
        try {
            const cleanTime = timeStr.split(".")[0];
            const parts = cleanTime.split(":");
            if (parts.length < 2) return timeStr;
            
            let hours = parseInt(parts[0], 10);
            const minutes = parts[1];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            hours = hours % 12;
            hours = hours ? hours : 12;
            
            return `${hours}:${minutes} ${ampm}`;
        } catch (e) {
            return timeStr;
        }
    };

    // Helper: Formats ISO Date string (YYYY-MM-DD) to readable format
    const formatDate = (dateStr) => {
        if (!dateStr) return "--";
        try {
            const parts = dateStr.split("-");
            if (parts.length !== 3) return dateStr;
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}, ${parts[0]}`;
        } catch (e) {
            return dateStr;
        }
    };

    // --- RENDER TABLE ROWS ---
    const renderTableRows = (readings) => {
        tableBody.innerHTML = "";
        readings.forEach((reading) => {
            let badgeClass = "badge-table-safe";
            if (reading.status === "Warning") badgeClass = "badge-table-warning";
            if (reading.status === "Danger") badgeClass = "badge-table-danger";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>#${reading.id}</td>
                <td><strong>${reading.gas_level} PPM</strong></td>
                <td><span class="${badgeClass}">${reading.status}</span></td>
                <td>${formatDate(reading.reading_date)}</td>
                <td>${formatTime(reading.reading_time)}</td>
            `;
            tableBody.appendChild(row);
        });
    };

    // --- RENDER EMPTY STATE IN TABLE ---
    const renderEmptyTable = () => {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-database mb-3"></i>
                        <h3>No sensor readings available</h3>
                        <p>Simulations will start committing data automatically every 2 seconds.</p>
                    </div>
                </td>
            </tr>
        `;
    };

    // --- ERROR BANNER ACTIONS ---
    const showError = (message) => {
        if (!errorContainer) return;
        errorContainer.innerHTML = `
            <div class="api-error-banner">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Connection Alert:</strong> ${message}
                </div>
            </div>
        `;
        errorContainer.style.display = "block";
    };

    const hideError = () => {
        if (!errorContainer) return;
        errorContainer.style.display = "none";
        errorContainer.innerHTML = "";
    };

    // --- INITIALIZATION AND LOOP ---
    // Only run polling and data fetching if we are on the dashboard page
    if (valGasLevel) {
        // Fetch existing records immediately
        fetchDashboardData();
        // Trigger simulated readings every 2 seconds
        setInterval(simulateGasReading, 2000);
    }
});
