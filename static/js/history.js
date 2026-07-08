/**
 * Smart Gas Leakage Detection System - History Module JavaScript Client
 * Manages paginated database loads, filtering, searching, sorting, details viewer, and deletion alerts.
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM ELEMENT REFERENCES ---
    const historyTableBody = document.getElementById("history-table-body");
    const refreshBtn = document.getElementById("refresh-history-btn");
    const clearFiltersBtn = document.getElementById("clear-filters-btn");
    
    // Inputs & Filters
    const searchInput = document.getElementById("search-input");
    const statusFilter = document.getElementById("status-filter");
    const dateFilter = document.getElementById("date-filter");
    const sortSelect = document.getElementById("sort-select");
    
    // Statistics Displays
    const statTotal = document.getElementById("stat-total");
    const statSafe = document.getElementById("stat-safe");
    const statWarning = document.getElementById("stat-warning");
    const statDanger = document.getElementById("stat-danger");
    
    // Pagination Displays
    const paginationInfo = document.getElementById("pagination-info");
    const paginationControls = document.getElementById("pagination-controls");
    
    // Modals & Toasts
    const detailsModalEl = document.getElementById("detailsModal");
    const successToastEl = document.getElementById("success-toast");
    const toastMessage = document.getElementById("toast-message");

    // --- CLIENT STATE VARIABLES ---
    let currentPage = 1;
    let currentSearch = "";
    let currentStatus = "all";
    let currentDate = "";
    let currentSort = "newest";
    let searchDebounceTimeout = null;

    // --- FETCH AND UPDATE STATISTICS ---
    const loadStatistics = async () => {
        try {
            const response = await fetch("/api/history/stats");
            if (!response.ok) throw new Error("Failed to load statistics.");
            const result = await response.json();
            
            if (result.status === "success") {
                const { total, safe, warning, danger } = result.data;
                // Update numbers with minor text fade effects
                updateStatNumber(statTotal, total);
                updateStatNumber(statSafe, safe);
                updateStatNumber(statWarning, warning);
                updateStatNumber(statDanger, danger);
            }
        } catch (error) {
            console.error("Error loading stats:", error);
        }
    };

    const updateStatNumber = (element, targetValue) => {
        if (!element) return;
        element.classList.remove("fade-pulse");
        void element.offsetWidth; // Force layout recalculation
        element.classList.add("fade-pulse");
        element.textContent = targetValue;
    };

    // --- CONSTRUCT ENDPOINT PATH & FETCH READINGS ---
    const loadReadings = async () => {
        showLoadingState();
        
        let endpoint = `/api/history?page=${currentPage}&sort=${currentSort}`;
        
        // Decide endpoint based on active filter or search keywords
        if (currentSearch) {
            endpoint = `/api/history/search?q=${encodeURIComponent(currentSearch)}&page=${currentPage}&sort=${currentSort}`;
        } else if (currentStatus !== "all" || currentDate !== "") {
            endpoint = `/api/history/filter?status=${currentStatus}&date=${currentDate}&page=${currentPage}&sort=${currentSort}`;
        }
        
        try {
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
            const result = await response.json();
            
            if (result.status === "success") {
                renderTable(result.data.readings);
                renderPagination(result.data);
            } else {
                showTableError(result.message || "Failed to load history list.");
            }
        } catch (error) {
            console.error("Error loading readings:", error);
            showTableError("Connection to backend server failed. Please refresh later.");
        }
    };

    // --- DISPLAY LOADING SPINNER ---
    const showLoadingState = () => {
        historyTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading telemetry data...</span>
                    </div>
                </td>
            </tr>
        `;
    };

    // --- DISPLAY ERROR STRINGS IN TABLE ---
    const showTableError = (message) => {
        historyTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    <i class="fas fa-circle-exclamation fa-2x mb-2"></i>
                    <div><strong>Error:</strong> ${message}</div>
                </td>
            </tr>
        `;
    };

    // --- RENDER TABLE ROWS ---
    const renderTable = (readings) => {
        if (readings.length === 0) {
            historyTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="empty-state">
                            <i class="fas fa-filter-circle-xmark mb-3" style="font-size: 2.5rem; opacity: 0.5;"></i>
                            <h3>No records match your criteria</h3>
                            <p class="text-muted">Try adjusting your filters or date inputs.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        historyTableBody.innerHTML = "";
        readings.forEach((r) => {
            let badgeClass = "badge-table-safe";
            if (r.status === "Warning") badgeClass = "badge-table-warning";
            if (r.status === "Danger") badgeClass = "badge-table-danger";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>#${r.id}</td>
                <td><strong>${r.gas_level} PPM</strong></td>
                <td><span class="${badgeClass}">${r.status}</span></td>
                <td>${formatDate(r.reading_date)}</td>
                <td>${formatTime(r.reading_time)}</td>
                <td class="text-end" style="padding-right: 1.5rem;">
                    <div class="btn-group gap-1">
                        <button class="btn btn-sm btn-outline-primary view-btn" data-id="${r.id}" style="border-radius: 6px;" title="View Details">
                            <i class="fas fa-eye"></i> <span class="d-none d-sm-inline ms-1">View</span>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${r.id}" style="border-radius: 6px;" title="Delete Record">
                            <i class="fas fa-trash-can"></i> <span class="d-none d-sm-inline ms-1">Delete</span>
                        </button>
                    </div>
                </td>
            `;
            historyTableBody.appendChild(row);
        });

        // Bind Actions dynamically
        document.querySelectorAll(".view-btn").forEach(btn => {
            btn.addEventListener("click", () => handleViewDetails(btn.dataset.id));
        });

        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", () => handleDeleteReading(btn.dataset.id));
        });
    };

    // --- RENDER PAGINATION CONTROLS ---
    const renderPagination = (paginationData) => {
        const { current_page, total_pages, total_records } = paginationData;
        
        // 1. Update pagination status text
        if (total_records === 0) {
            paginationInfo.textContent = "Showing 0 to 0 of 0 entries";
            paginationControls.innerHTML = "";
            return;
        }

        const startIdx = (current_page - 1) * 10 + 1;
        const endIdx = Math.min(current_page * 10, total_records);
        paginationInfo.textContent = `Showing ${startIdx} to ${endIdx} of ${total_records} entries`;

        // 2. Build page buttons
        paginationControls.innerHTML = "";

        // Prev Button
        const prevLi = document.createElement("li");
        prevLi.className = `page-item ${current_page === 1 ? "disabled" : ""}`;
        prevLi.innerHTML = `<a class="page-link" aria-label="Previous">&laquo;</a>`;
        if (current_page > 1) {
            prevLi.addEventListener("click", () => {
                currentPage--;
                loadReadings();
            });
        }
        paginationControls.appendChild(prevLi);

        // Individual Page Numbers
        // Render simple range to avoid overflow if pages are high
        const maxPagesToShow = 5;
        let startPage = Math.max(1, current_page - 2);
        let endPage = Math.min(total_pages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement("li");
            pageLi.className = `page-item ${current_page === i ? "active" : ""}`;
            pageLi.innerHTML = `<a class="page-link">${i}</a>`;
            pageLi.addEventListener("click", () => {
                if (currentPage !== i) {
                    currentPage = i;
                    loadReadings();
                }
            });
            paginationControls.appendChild(pageLi);
        }

        // Next Button
        const nextLi = document.createElement("li");
        nextLi.className = `page-item ${current_page === total_pages ? "disabled" : ""}`;
        nextLi.innerHTML = `<a class="page-link" aria-label="Next">&raquo;</a>`;
        if (current_page < total_pages) {
            nextLi.addEventListener("click", () => {
                currentPage++;
                loadReadings();
            });
        }
        paginationControls.appendChild(nextLi);
    };

    // --- ACTIONS: VIEW DETAILS IN MODAL ---
    const handleViewDetails = async (id) => {
        try {
            // Find reading inside DB using specific latest endpoint or load it
            const response = await fetch(`/api/latest`); // We can also query all or a single record API if available, 
            // but wait, since `/api/history` already loaded the data, we can query it or simply query all matching ID.
            // Let's call `/api/history` with pagination 1 searching the ID exactly!
            const searchResponse = await fetch(`/api/history/search?q=${id}`);
            if (!searchResponse.ok) throw new Error("Failed to load details.");
            
            const result = await searchResponse.json();
            if (result.status === "success" && result.data.readings.length > 0) {
                const reading = result.data.readings.find(r => r.id == id);
                if (reading) {
                    populateDetailsModal(reading);
                    const detailsModal = bootstrap.Modal.getOrCreateInstance(detailsModalEl);
                    detailsModal.show();
                }
            }
        } catch (error) {
            console.error("View Details Error:", error);
            alert("Unable to fetch record specifications.");
        }
    };

    const populateDetailsModal = (reading) => {
        document.getElementById("modal-reading-id").textContent = `#${reading.id}`;
        document.getElementById("modal-gas-level").textContent = `${reading.gas_level} PPM`;
        
        let badgeClass = "badge-status";
        if (reading.status === "Safe") badgeClass = "badge-status bg-success text-white";
        if (reading.status === "Warning") badgeClass = "badge-status bg-warning text-dark";
        if (reading.status === "Danger") badgeClass = "badge-status bg-danger text-white";

        document.getElementById("modal-status").innerHTML = `<span class="${badgeClass}">${reading.status}</span>`;
        document.getElementById("modal-date").textContent = formatDate(reading.reading_date);
        document.getElementById("modal-time").textContent = formatTime(reading.reading_time);
        
        // Show raw timestamp
        document.getElementById("modal-timestamp").textContent = reading.created_at || "N/A";
    };

    // --- ACTIONS: DELETE RECORD FROM DATABASE ---
    const handleDeleteReading = async (id) => {
        const confirmDelete = confirm(`Are you sure you want to permanently delete gas reading #${id} from SQLite?`);
        if (!confirmDelete) return;

        try {
            const response = await fetch(`/api/history/${id}`, {
                method: "DELETE"
            });
            
            const result = await response.json();
            if (response.ok && result.status === "success") {
                showToast(`Reading #${id} has been permanently deleted.`);
                loadStatistics(); // Reload stats counters
                loadReadings();   // Refresh table
            } else {
                alert(result.message || "Failed to delete record.");
            }
        } catch (error) {
            console.error("Delete call failed:", error);
            alert("Error connecting to server. Deletion cancelled.");
        }
    };

    // --- TOAST EMIT HELPERS ---
    const showToast = (message) => {
        if (!successToastEl) return;
        toastMessage.textContent = message;
        const toast = bootstrap.Toast.getOrCreateInstance(successToastEl);
        toast.show();
    };

    // --- FORMAT DATE/TIME HELPERS ---
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

    // --- SEARCH DEBOUNCER KEYBOARD LISTENER ---
    searchInput.addEventListener("input", () => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            currentSearch = searchInput.value.trim();
            currentPage = 1; // Reset to page 1 on new query
            
            // Clear status and date filters if search is active (mutually exclusive layouts)
            if (currentSearch !== "") {
                statusFilter.value = "all";
                dateFilter.value = "";
                currentStatus = "all";
                currentDate = "";
            }
            loadReadings();
        }, 350); // 350ms keyboard debounce
    });

    // --- STATUS DROPDOWN FILTER CHANGE ---
    statusFilter.addEventListener("change", () => {
        currentStatus = statusFilter.value;
        currentPage = 1;
        
        // Clear text search when filters are explicitly set
        if (currentStatus !== "all") {
            searchInput.value = "";
            currentSearch = "";
        }
        loadReadings();
    });

    // --- DATE PICKER FILTER CHANGE ---
    dateFilter.addEventListener("change", () => {
        currentDate = dateFilter.value;
        currentPage = 1;
        
        if (currentDate !== "") {
            searchInput.value = "";
            currentSearch = "";
        }
        loadReadings();
    });

    // --- SORT DROPDOWN FILTER CHANGE ---
    sortSelect.addEventListener("change", () => {
        currentSort = sortSelect.value;
        currentPage = 1;
        loadReadings();
    });

    // --- CLEAR FILTERS BUTTON TRIGGER ---
    clearFiltersBtn.addEventListener("click", () => {
        searchInput.value = "";
        statusFilter.value = "all";
        dateFilter.value = "";
        sortSelect.value = "newest";
        
        currentSearch = "";
        currentStatus = "all";
        currentDate = "";
        currentSort = "newest";
        currentPage = 1;
        
        loadReadings();
    });

    // --- MANUAL REFRESH TRIGGER ---
    refreshBtn.addEventListener("click", () => {
        loadStatistics();
        loadReadings();
    });

    // --- INITIALIZE VIEWS ---
    loadStatistics();
    loadReadings();
});
