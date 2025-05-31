// Check if current tab is on a supported site
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  const tab = tabs[0];
  
  if (!tab?.url) {
    showMessage("Unable to access current tab information.", true);
    return;
  }
  
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;
    
    // Check if site is supported - include luxury.tatacliq.com
    if (!hostname.includes('ajio.com') && !hostname.includes('myntra.com') && 
        !hostname.includes('amazon.in') && !hostname.includes('flipkart.com') &&
        !hostname.includes('tatacliq.com') && hostname !== 'luxury.tatacliq.com' &&
        !hostname.includes('snapdeal.com')) {
      showMessage("This extension only works on AJIO, Myntra, Amazon, Flipkart, TataCliq, Luxury TataCliq, and Snapdeal.", true);
      return;
    }

    console.log("[Popup] Current site:", hostname, "- Supported");
    initializePopup();
  } catch (error) {
    console.error("[Popup] Error processing tab URL:", error);
    showMessage("Error accessing current page. Please refresh and try again.", true);
  }
});

function initializePopup() {
  document.addEventListener('DOMContentLoaded', function() {
    const saveCurrentBtn = document.getElementById('saveCurrent');
    const savedFiltersDiv = document.getElementById('savedFilters');
    const saveForm = document.getElementById('saveForm');
    const filterSetName = document.getElementById('filterSetName');
    const confirmSaveBtn = document.getElementById('confirmSave');
    const cancelSaveBtn = document.getElementById('cancelSave');
    const messageContainer = document.getElementById('messageContainer');
    
    // Theme toggle logic
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const body = document.body;

    function setTheme(mode) {
      if (mode === 'light') {
        body.classList.add('light-mode');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
      } else {
        body.classList.remove('light-mode');
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
      }
      localStorage.setItem('theme', mode);
    }

    // Load theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setTheme('light');
    } else {
      setTheme('dark');
    }

    themeToggle.addEventListener('click', function() {
      if (body.classList.contains('light-mode')) {
        setTheme('dark');
      } else {
        setTheme('light');
      }
    });
    
    // Show save form when save button is clicked
    saveCurrentBtn.addEventListener('click', async function() {
      try {
        // Check connection before showing save form
        await ensureContentScriptConnection();
        saveForm.style.display = 'block';
        filterSetName.focus();
      } catch (error) {
        console.error("[Popup] Connection error when trying to save:", error);
        showMessage("Unable to connect to page. Please refresh and try again.", true);
      }
    });
    
    // Confirm save
    confirmSaveBtn.addEventListener('click', async function() {
      const name = filterSetName.value.trim() || 'Unnamed Set';
      console.log("[Popup] Attempting to save filters as:", name);
      
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        console.log("[Popup] Communicating with tab:", tab.url);
        
        // Ensure connection before proceeding
        await ensureContentScriptConnection();
        
        // Retry getting filters if needed
        const response = await retryOperation(async () => {
          const response = await chrome.tabs.sendMessage(tab.id, {action: "getCurrentFilters"});
          if (!response?.filters) {
            throw new Error('No filters detected on the page');
          }
          return response;
        }, 3, 1000);
        
        console.log("[Popup] Received filters from content script:", response.filters);
        
        await saveFilterSet({
          ...response.filters,
          name: name,
          timestamp: new Date().toISOString(),
          originSite: new URL(tab.url).hostname
        });
        
        saveForm.style.display = 'none';
        filterSetName.value = '';
        showMessage(`"${name}" saved successfully!`);
      } catch (error) {
        console.error("[Popup] Error saving filters:", error);
        showMessage(error.message || 'Error saving filters', true);
      }
    });
    
    // Cancel save
    cancelSaveBtn.addEventListener('click', function() {
      saveForm.style.display = 'none';
      filterSetName.value = '';
    });
    
    // Load saved filters on popup open
    loadSavedFilters();
  });
}

// Helper function to retry operations
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`[Popup] Attempt ${i + 1} failed:`, error);
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Save filter set to storage
async function saveFilterSet(filters) {
  console.log("[Popup] Starting to save filter set:", filters.name);
  console.log("[Popup] Filter data to save:", {
    brands: filters.data.brands,
    sizes: filters.data.sizes,
    colors: filters.data.colors,
    url: filters.url,
    originSite: filters.originSite
  });

  try {
    const {savedFilters = {}} = await chrome.storage.local.get(['savedFilters']);
    const hostname = new URL(filters.url).hostname;
    
    console.log("[Popup] Current saved filters:", savedFilters);
    
    if (!savedFilters[hostname]) {
      console.log("[Popup] Creating new filter array for hostname:", hostname);
      savedFilters[hostname] = [];
    }
    
    const newFilterSet = {
      id: Date.now(),
      name: filters.name,
      filters: filters.data,
      timestamp: filters.timestamp,
      originSite: filters.originSite
    };
    
    console.log("[Popup] Adding new filter set:", newFilterSet);
    savedFilters[hostname].push(newFilterSet);
    
    await chrome.storage.local.set({savedFilters: savedFilters});
    console.log("[Popup] Filters saved successfully to storage");
    loadSavedFilters();
  } catch (error) {
    console.error("[Popup] Error saving to storage:", error);
    throw error;
  }
}

// Ensure content script connection with improved error handling
async function ensureContentScriptConnection() {
  console.log("[Popup] Ensuring content script connection...");
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw new Error('No active tab found');

    // Check if we're on a supported site
    const hostname = new URL(tab.url).hostname;
    if (!isCompatibleSite(hostname)) {
      throw new Error(`Unsupported site: ${hostname}`);
    }

    // Wait a bit to ensure content script is loaded
    await new Promise(resolve => setTimeout(resolve, 500));

    // Try to establish connection with content script with timeout
    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, {action: "ping"}),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);
    
    if (!response || response.status !== "connected") {
      throw new Error('Content script not responding properly');
    }
    
    console.log("[Popup] Content script connection established");
    return true;
  } catch (error) {
    console.error("[Popup] Content script connection error:", error);
    
    // Try to inject content script if connection failed
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (tab?.id) {
        console.log("[Popup] Attempting to inject content script...");
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js']
        });
        
        // Wait for injection and try connection again
        await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await chrome.tabs.sendMessage(tab.id, {action: "ping"});
        
        if (response && response.status === "connected") {
          console.log("[Popup] Content script injected and connected successfully");
          return true;
        }
      }
    } catch (injectionError) {
      console.error("[Popup] Content script injection failed:", injectionError);
    }
    
    throw error;
  }
}

// Load saved filters from storage
async function loadSavedFilters() {
  console.log("[Popup] Starting to load saved filters");
  
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.url) {
      console.error("[Popup] No active tab found");
      return;
    }
    
    console.log("[Popup] Current tab URL:", tab.url);
    const {savedFilters = {}} = await chrome.storage.local.get(['savedFilters']);
    const currentHostname = new URL(tab.url).hostname;
    
    console.log("[Popup] Current hostname:", currentHostname);
    console.log("[Popup] All saved filters:", savedFilters);
    
    // Get all filters that can be applied to current site
    const allCompatibleFilters = [];
    
    for (const [hostname, siteFilters] of Object.entries(savedFilters)) {
      console.log("[Popup] Checking filters for hostname:", hostname);
      if (isCompatibleSite(hostname)) {
        console.log("[Popup] Adding compatible filters from:", hostname);
        allCompatibleFilters.push(...siteFilters);
      }
    }
    
    console.log("[Popup] Total compatible filters found:", allCompatibleFilters.length);
    
    const savedFiltersDiv = document.getElementById('savedFilters');
    if (allCompatibleFilters.length === 0) {
      console.log("[Popup] No compatible filters found");
      savedFiltersDiv.innerHTML = `
        <div class="empty-state">
          <p>No saved filters found</p>
          <small>Save your current filters to get started!</small>
        </div>
      `;
      return;
    }
    
    // Sort by most recent first
    allCompatibleFilters.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    savedFiltersDiv.innerHTML = '';
    allCompatibleFilters.forEach(filterSet => {
      console.log("[Popup] Rendering filter set:", filterSet.name);
      const filterSetDiv = document.createElement('div');
      filterSetDiv.className = 'filter-set';
      filterSetDiv.dataset.filterId = filterSet.id;
      
      // Format display text for each filter type
      const formatFilterText = (filters) => {
        if (!filters || !filters.length) return 'None';
        return filters.map(f => f.text || f.value || f.id || f).join(', ');
      };
      
      const filterText = document.createElement('div');
      filterText.className = 'filter-info';
      
      // Show origin site if different from current site
      const originInfo = filterSet.originSite !== currentHostname ? 
        `<span class="site-indicator">From ${filterSet.originSite}</span>` : '';
      
      filterText.innerHTML = `
        <strong>${filterSet.name}</strong> ${originInfo}
        <small>
          <div>Brands: ${formatFilterText(filterSet.filters.brands)}</div>
          <div>Sizes: ${formatFilterText(filterSet.filters.sizes)}</div>
          <div>Colors: ${formatFilterText(filterSet.filters.colors)}</div>
        </small>
      `;
      
      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'button-group';
      
      const applyBtn = document.createElement('button');
      applyBtn.textContent = 'Apply';
      applyBtn.addEventListener('click', () => showFilterSelection(filterSet, filterSetDiv));
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn';
      deleteBtn.addEventListener('click', () => deleteFilterSet(filterSet.originSite, filterSet.id));
      
      buttonGroup.appendChild(applyBtn);
      buttonGroup.appendChild(deleteBtn);
      filterSetDiv.appendChild(filterText);
      filterSetDiv.appendChild(buttonGroup);
      savedFiltersDiv.appendChild(filterSetDiv);
    });
  } catch (error) {
    console.error("[Popup] Error loading saved filters:", error);
    const savedFiltersDiv = document.getElementById('savedFilters');
    savedFiltersDiv.innerHTML = `
      <div class="empty-state error">
        <div class="emoji"></div>
        <p>Error loading saved filters</p>
        <small>${error.message}</small>
      </div>
    `;
  }
}

// Check if a hostname is compatible with our extension
function isCompatibleSite(hostname) {
  return hostname.includes('ajio.com') || hostname.includes('myntra.com') || 
         hostname.includes('amazon.in') || hostname.includes('flipkart.com') ||
         hostname.includes('tatacliq.com') || hostname === 'luxury.tatacliq.com' ||
         hostname.includes('snapdeal.com');
}

// Function to show filter selection UI - now accepts the filter container element
function showFilterSelection(filterSet, filterContainer) {
  // Remove any existing filter selection modals
  const existingModals = document.querySelectorAll('.inline-filter-selection');
  existingModals.forEach(modal => modal.remove());
  
  // Create the filter selection modal
  const filterSelection = document.createElement('div');
  filterSelection.className = 'inline-filter-selection';
  filterSelection.innerHTML = `
    <div class="filter-selection-header">
      <h4>Select Filters to Apply</h4>
      <div class="select-all-container">
        <label>Select All</label>
        <input type="checkbox" id="selectAllFilters" class="modern-checkbox">
      </div>
    </div>
    
    <div class="filter-checkbox-group">
      <div class="filter-checkbox-header">
        <label>Brands</label>
        <input type="checkbox" id="selectAllBrands" class="modern-checkbox">
      </div>
      <div id="brandCheckboxes" class="filter-checkbox-list"></div>
      
      <div class="filter-checkbox-header">
        <label>Sizes</label>
        <input type="checkbox" id="selectAllSizes" class="modern-checkbox">
      </div>
      <div id="sizeCheckboxes" class="filter-checkbox-list"></div>
      
      <div class="filter-checkbox-header">
        <label>Colors</label>
        <input type="checkbox" id="selectAllColors" class="modern-checkbox">
      </div>
      <div id="colorCheckboxes" class="filter-checkbox-list"></div>
    </div>
    
    <div class="filter-selection-buttons">
      <button id="applySelected" class="apply-selected-btn" disabled>
        <i class="fa-solid fa-check"></i> Apply Selected Filters
      </button>
      <button id="closeSelection" class="cancel-btn">
        <i class="fa-solid fa-times"></i> Cancel
      </button>
    </div>
  `;
  
  // Insert the modal right after the filter container
  filterContainer.insertAdjacentElement('afterend', filterSelection);
  
  const brandCheckboxes = filterSelection.querySelector('#brandCheckboxes');
  const sizeCheckboxes = filterSelection.querySelector('#sizeCheckboxes');
  const colorCheckboxes = filterSelection.querySelector('#colorCheckboxes');
  const applySelectedBtn = filterSelection.querySelector('#applySelected');
  const closeSelectionBtn = filterSelection.querySelector('#closeSelection');
  
  // Clear previous checkboxes
  brandCheckboxes.innerHTML = '';
  sizeCheckboxes.innerHTML = '';
  colorCheckboxes.innerHTML = '';
  
  // Add brand checkboxes
  if (filterSet.filters.brands && filterSet.filters.brands.length > 0) {
    filterSet.filters.brands.forEach(brand => {
      const brandName = typeof brand === 'string' ? brand : brand.text;
      const checkboxDiv = createCheckboxItem(brandName);
      brandCheckboxes.appendChild(checkboxDiv);
    });
  }
  
  // Add size checkboxes
  if (filterSet.filters.sizes && filterSet.filters.sizes.length > 0) {
    filterSet.filters.sizes.forEach(size => {
      const sizeValue = typeof size === 'string' ? size : size.text;
      const checkboxDiv = createCheckboxItem(sizeValue);
      sizeCheckboxes.appendChild(checkboxDiv);
    });
  }
  
  // Add color checkboxes
  if (filterSet.filters.colors && filterSet.filters.colors.length > 0) {
    filterSet.filters.colors.forEach(color => {
      const colorValue = typeof color === 'string' ? color : color.text;
      const checkboxDiv = createCheckboxItem(colorValue);
      colorCheckboxes.appendChild(checkboxDiv);
    });
  }
  
  // Update apply button state
  updateApplyButtonState(filterSelection);
  
  // Add event listeners for checkboxes
  filterSelection.querySelectorAll('.filter-checkbox-item input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => updateApplyButtonState(filterSelection));
  });

  // Add event listeners for select all checkboxes
  const selectAllFilters = filterSelection.querySelector('#selectAllFilters');
  const selectAllBrands = filterSelection.querySelector('#selectAllBrands');
  const selectAllSizes = filterSelection.querySelector('#selectAllSizes');
  const selectAllColors = filterSelection.querySelector('#selectAllColors');

  // Handle main "Select All" checkbox
  selectAllFilters.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    selectAllBrands.checked = isChecked;
    selectAllSizes.checked = isChecked;
    selectAllColors.checked = isChecked;
    
    filterSelection.querySelectorAll('.filter-checkbox-item input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = isChecked;
    });
    updateApplyButtonState(filterSelection);
  });

  // Handle individual group checkboxes
  selectAllBrands.addEventListener('change', (e) => {
    const checkboxes = brandCheckboxes.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
    updateSelectAllState(filterSelection);
    updateApplyButtonState(filterSelection);
  });

  selectAllSizes.addEventListener('change', (e) => {
    const checkboxes = sizeCheckboxes.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
    updateSelectAllState(filterSelection);
    updateApplyButtonState(filterSelection);
  });

  selectAllColors.addEventListener('change', (e) => {
    const checkboxes = colorCheckboxes.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
    updateSelectAllState(filterSelection);
    updateApplyButtonState(filterSelection);
  });

  // Add event listener for apply button
  applySelectedBtn.addEventListener('click', () => applySelectedFilters(filterSet, filterSelection));
  
  // Add event listener for close button
  closeSelectionBtn.addEventListener('click', () => {
    filterSelection.remove();
  });
  
  // Scroll the modal into view
  filterSelection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Helper function to create checkbox item
function createCheckboxItem(value) {
  const div = document.createElement('div');
  div.className = 'filter-checkbox-item';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `filter-${value}`;
  checkbox.value = value;
  checkbox.className = 'modern-checkbox';
  
  const label = document.createElement('label');
  label.htmlFor = `filter-${value}`;
  label.textContent = value;
  
  div.appendChild(checkbox);
  div.appendChild(label);
  return div;
}

// Helper function to update apply button state
function updateApplyButtonState(container) {
  const applySelectedBtn = container.querySelector('#applySelected');
  const hasSelectedFilters = container.querySelectorAll('.filter-checkbox-item input[type="checkbox"]:checked').length > 0;
  applySelectedBtn.disabled = !hasSelectedFilters;
}

// Helper function to update the main "Select All" checkbox state
function updateSelectAllState(container) {
  const selectAllFilters = container.querySelector('#selectAllFilters');
  const allCheckboxes = container.querySelectorAll('.filter-checkbox-item input[type="checkbox"]');
  const checkedCheckboxes = container.querySelectorAll('.filter-checkbox-item input[type="checkbox"]:checked');
  
  selectAllFilters.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length;
}

// Function to apply selected filters
async function applySelectedFilters(filterSet, filterSelection) {
  const selectedFilters = {
    brands: [],
    sizes: [],
    colors: []
  };
  
  // Get selected brands
  const selectedBrands = filterSelection.querySelectorAll('#brandCheckboxes input[type="checkbox"]:checked');
  selectedBrands.forEach(checkbox => {
    selectedFilters.brands.push(checkbox.value);
  });
  
  // Get selected sizes
  const selectedSizes = filterSelection.querySelectorAll('#sizeCheckboxes input[type="checkbox"]:checked');
  selectedSizes.forEach(checkbox => {
    selectedFilters.sizes.push(checkbox.value);
  });
  
  // Get selected colors
  const selectedColors = filterSelection.querySelectorAll('#colorCheckboxes input[type="checkbox"]:checked');
  selectedColors.forEach(checkbox => {
    selectedFilters.colors.push(checkbox.value);
  });
  
  console.log("[Popup] Selected filters to apply:", selectedFilters);
  
  // Add originSite to the filters for cross-site tracking
  selectedFilters.originSite = filterSet.originSite;
  
  try {
    // Ensure connection before applying filters
    await ensureContentScriptConnection();
    
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    console.log("[Popup] Sending filters to content script for application");
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: "applyFilters",
      filters: selectedFilters
    });
    
    if (result.success) {
      console.log("[Popup] Filters applied successfully:", result);
      
      // Create detailed success message
      let message;
      if (result.result && result.result.summary) {
        message = createDetailedFilterMessage(result.result.summary, result.result.partialSuccess);
      } else {
        message = "Filters applied successfully!";
      }
      
      showMessage(message);
      filterSelection.remove();
    } else {
      console.error("[Popup] Error applying filters:", result.error);
      showMessage(result.error || "Error applying filters", true);
    }
  } catch (error) {
    console.error("[Popup] Error communicating with content script:", error);
    showMessage("Error applying filters. Please refresh the page and try again.", true);
  }
}

// Create detailed filter application message
function createDetailedFilterMessage(summary, isPartial = false) {
  const { totalRequested, totalApplied, appliedFilters, failedFilters } = summary;
  
  let message = isPartial ? "Filters partially applied!\n\n" : "Filters applied successfully!\n\n";
  
  if (totalApplied > 0) {
    message += `✅ Applied ${totalApplied}/${totalRequested} filters:\n`;
    
    if (appliedFilters.brands && appliedFilters.brands.length > 0) {
      message += `• Brands: ${appliedFilters.brands.join(', ')}\n`;
    }
    
    if (appliedFilters.sizes && appliedFilters.sizes.length > 0) {
      message += `• Sizes: ${appliedFilters.sizes.join(', ')}\n`;
    }
    
    if (appliedFilters.colors && appliedFilters.colors.length > 0) {
      message += `• Colors: ${appliedFilters.colors.join(', ')}\n`;
    }
  }
  
  if (failedFilters && (failedFilters.brands?.length || failedFilters.sizes?.length || failedFilters.colors?.length)) {
    message += `\n❌ Not found on this site:\n`;
    
    if (failedFilters.brands && failedFilters.brands.length > 0) {
      message += `• Brands: ${failedFilters.brands.join(', ')}\n`;
    }
    
    if (failedFilters.sizes && failedFilters.sizes.length > 0) {
      message += `• Sizes: ${failedFilters.sizes.join(', ')}\n`;
    }
    
    if (failedFilters.colors && failedFilters.colors.length > 0) {
      message += `• Colors: ${failedFilters.colors.join(', ')}\n`;
    }
  }
  
  return message.trim();
}

// Function to delete a filter set
async function deleteFilterSet(originSite, id) {
  if (!confirm("Are you sure you want to delete this filter set?")) {
    return;
  }
  
  try {
    const {savedFilters = {}} = await chrome.storage.local.get(['savedFilters']);
    
    if (savedFilters[originSite]) {
      savedFilters[originSite] = savedFilters[originSite].filter(filter => filter.id !== id);
      
      // Remove the site entry if no filters remain
      if (savedFilters[originSite].length === 0) {
        delete savedFilters[originSite];
      }
      
      await chrome.storage.local.set({savedFilters: savedFilters});
      showMessage("Filter set deleted successfully!");
      loadSavedFilters();
    }
  } catch (error) {
    console.error("[Popup] Error deleting filter set:", error);
    showMessage("Error deleting filter set", true);
  }
}

// Function to show messages to the user
function showMessage(message, isError = false) {
  const messageContainer = document.getElementById('messageContainer');
  if (!messageContainer) return;
  
  messageContainer.className = `message-container ${isError ? 'error' : 'success'}`;
  messageContainer.textContent = message;
  messageContainer.style.display = 'block';
  
  setTimeout(() => {
    messageContainer.style.display = 'none';
  }, isError ? 5000 : 3000);
}


