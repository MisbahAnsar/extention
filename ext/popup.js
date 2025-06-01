// Global variables for filter mode functionality
let allSavedFilters = [];
let currentFilterMode = 'single';
let currentDetailView = null;
let isInitialized = false;

// Global DOM elements (will be set after DOM is ready)
let savedFiltersSection = null;

// Toast notification system
async function showToast(message, type = 'success', duration = 3000) {
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab?.id) {
      // Send message to content script to show toast on the webpage
      await chrome.tabs.sendMessage(tab.id, {
        action: "showToast",
        message: message,
        type: type,
        duration: duration
      });
    }
  } catch (error) {
    console.log("[Popup] Could not show toast on webpage:", error);
    // Fallback: log to console if content script is not available
    console.log(`[Toast] ${type.toUpperCase()}: ${message}`);
  }
}

// Show loading state
function showLoadingState() {
  if (savedFiltersSection) {
    savedFiltersSection.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner">
          <i class="fa-solid fa-spinner fa-spin"></i>
        </div>
        <p>Loading saved filters...</p>
      </div>
    `;
  }
}

// Function to render filters based on current mode
function renderFiltersInCurrentMode() {
  if (!isInitialized || !savedFiltersSection) {
    console.log("[Popup] Not yet initialized, skipping render");
    return;
  }
  
  if (currentFilterMode === 'single') {
    renderSingleModeFilters();
  } else {
    renderMultipleModeFilters();
  }
}

// Single Mode: Show list with arrow and delete icons
function renderSingleModeFilters() {
  if (!savedFiltersSection) {
    console.error("[Popup] savedFiltersSection not available");
    return;
  }
  
  if (currentDetailView) {
    renderFilterDetails(currentDetailView);
    return;
  }
  
  const container = document.createElement('div');
  container.className = 'single-mode-container';
  
  if (allSavedFilters.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No saved filters found</p>
        <small>Save your current filters to get started!</small>
      </div>
    `;
    savedFiltersSection.innerHTML = '';
    savedFiltersSection.appendChild(container);
    return;
  }
  
  allSavedFilters.forEach(filterSet => {
    const filterItem = document.createElement('div');
    filterItem.className = 'filter-item-single';
    
    const originInfo = filterSet.originSite !== window.location.hostname ? 
      `<span class="site-indicator">${filterSet.originSite}</span>` : '';
    
    filterItem.innerHTML = `
      ${originInfo}
      <div class="filter-item-header">
        <h3 class="filter-item-name">${filterSet.name}</h3>
        <div class="filter-item-actions">
          <button class="filter-action-btn view-details" data-filter-id="${filterSet.id}" title="View Details">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
          <button class="filter-action-btn delete-action" data-filter-id="${filterSet.id}" data-origin="${filterSet.originSite}" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(filterItem);
  });
  
  // Add event listeners for action buttons
  container.addEventListener('click', function(e) {
    if (e.target.closest('.view-details')) {
      const filterId = parseInt(e.target.closest('.view-details').dataset.filterId);
      const filterSet = allSavedFilters.find(f => f.id === filterId);
      if (filterSet) {
        currentDetailView = filterSet;
        renderFilterDetails(filterSet);
      }
    } else if (e.target.closest('.delete-action')) {
      const filterId = parseInt(e.target.closest('.delete-action').dataset.filterId);
      const originSite = e.target.closest('.delete-action').dataset.origin;
      deleteFilterSet(originSite, filterId);
    }
  });
  
  savedFiltersSection.innerHTML = '';
  savedFiltersSection.appendChild(container);
}

// Function to render filter details for single mode
function renderFilterDetails(filterSet) {
  if (!savedFiltersSection) {
    console.error("[Popup] savedFiltersSection not available");
    return;
  }
  
  const container = document.createElement('div');
  container.className = 'single-mode-container';
  
  const detailsView = document.createElement('div');
  detailsView.className = 'filter-details-view';
  
  // Format filter text helper
  const formatFilterText = (filters) => {
    if (!filters || !filters.length) return [];
    return filters.map(f => f.text || f.value || f.id || f);
  };
  
  const brands = formatFilterText(filterSet.filters.brands);
  const sizes = formatFilterText(filterSet.filters.sizes);
  const colors = formatFilterText(filterSet.filters.colors);
  
  detailsView.innerHTML = `
    <div class="filter-details-header">
      <button class="back-to-list-btn">
        <i class="fa-solid fa-arrow-left"></i> Back
      </button>
      <h2 class="filter-details-name">${filterSet.name}</h2>
    </div>
    
    ${brands.length > 0 ? `
    <div class="filter-section">
      <div class="filter-section-title">
        <i class="fa-solid fa-tags"></i> Brands
      </div>
      <div class="filter-section-controls">
        <button class="section-control-btn" data-section="brands" data-action="all">Select All</button>
        <button class="section-control-btn" data-section="brands" data-action="none">Clear All</button>
      </div>
      <div class="filter-options-grid" data-section="brands">
        ${brands.map(brand => `
          <div class="filter-option-item" data-value="${brand}">
            <input type="checkbox" class="filter-option-checkbox" value="${brand}">
            <label class="filter-option-label">${brand}</label>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    ${sizes.length > 0 ? `
    <div class="filter-section">
      <div class="filter-section-title">
        <i class="fa-solid fa-expand"></i> Sizes
      </div>
      <div class="filter-section-controls">
        <button class="section-control-btn" data-section="sizes" data-action="all">Select All</button>
        <button class="section-control-btn" data-section="sizes" data-action="none">Clear All</button>
      </div>
      <div class="filter-options-grid" data-section="sizes">
        ${sizes.map(size => `
          <div class="filter-option-item" data-value="${size}">
            <input type="checkbox" class="filter-option-checkbox" value="${size}">
            <label class="filter-option-label">${size}</label>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    ${colors.length > 0 ? `
    <div class="filter-section">
      <div class="filter-section-title">
        <i class="fa-solid fa-palette"></i> Colors
      </div>
      <div class="filter-section-controls">
        <button class="section-control-btn" data-section="colors" data-action="all">Select All</button>
        <button class="section-control-btn" data-section="colors" data-action="none">Clear All</button>
      </div>
      <div class="filter-options-grid" data-section="colors">
        ${colors.map(color => `
          <div class="filter-option-item" data-value="${color}">
            <input type="checkbox" class="filter-option-checkbox" value="${color}">
            <label class="filter-option-label">${color}</label>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="filter-details-apply">
      <button class="filter-details-apply-btn" ${brands.length === 0 && sizes.length === 0 && colors.length === 0 ? 'disabled' : ''}>
        <i class="fa-solid fa-magic-wand-sparkles"></i> Apply Selected Filters
      </button>
    </div>
  `;
  
  // Helper function to update filter option item appearance
  function updateFilterOptionItem(checkbox) {
    const item = checkbox.closest('.filter-option-item');
    if (checkbox.checked) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  }

  // Helper function to update apply button state
  function updateApplyButtonState() {
    const applyBtn = detailsView.querySelector('.filter-details-apply-btn');
    const checkedBoxes = detailsView.querySelectorAll('.filter-option-checkbox:checked');
    applyBtn.disabled = checkedBoxes.length === 0;
  }
  
  // Add event listeners for filter details
  detailsView.addEventListener('click', function(e) {
    if (e.target.closest('.back-to-list-btn')) {
      currentDetailView = null;
      renderSingleModeFilters();
    } else if (e.target.closest('.section-control-btn')) {
      const btn = e.target.closest('.section-control-btn');
      const section = btn.dataset.section;
      const action = btn.dataset.action;
      const checkboxes = detailsView.querySelectorAll(`[data-section="${section}"] .filter-option-checkbox`);
      
      checkboxes.forEach(checkbox => {
        checkbox.checked = action === 'all';
        updateFilterOptionItem(checkbox);
      });
      
      updateApplyButtonState();
    } else if (e.target.closest('.filter-option-item')) {
      const item = e.target.closest('.filter-option-item');
      const checkbox = item.querySelector('.filter-option-checkbox');
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      updateFilterOptionItem(checkbox);
      updateApplyButtonState();
    } else if (e.target.closest('.filter-details-apply-btn')) {
      applySingleModeFilters(filterSet, detailsView);
    }
  });
  
  container.appendChild(detailsView);
  savedFiltersSection.innerHTML = '';
  savedFiltersSection.appendChild(container);
}

// Multiple Mode: Show all filters expanded with checkboxes
function renderMultipleModeFilters() {
  if (!savedFiltersSection) {
    console.error("[Popup] savedFiltersSection not available");
    return;
  }
  
  const container = document.createElement('div');
  container.className = 'multiple-mode-container';
  
  if (allSavedFilters.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No saved filters found</p>
        <small>Save your current filters to get started!</small>
      </div>
    `;
    savedFiltersSection.innerHTML = '';
    savedFiltersSection.appendChild(container);
    return;
  }
  
  // Format filter text helper
  const formatFilterText = (filters) => {
    if (!filters || !filters.length) return [];
    return filters.map(f => f.text || f.value || f.id || f);
  };
  
  allSavedFilters.forEach(filterSet => {
    const filterItem = document.createElement('div');
    filterItem.className = 'filter-item-multiple';
    
    const brands = formatFilterText(filterSet.filters.brands);
    const sizes = formatFilterText(filterSet.filters.sizes);
    const colors = formatFilterText(filterSet.filters.colors);
    
    const originInfo = filterSet.originSite !== window.location.hostname ? 
      `<span class="site-indicator">${filterSet.originSite}</span>` : '';
    
    filterItem.innerHTML = `
      ${originInfo}
      <div class="filter-item-header-multiple">
        <div class="filter-header-left">
          <input type="checkbox" class="master-checkbox" data-filter-id="${filterSet.id}">
          <h3 class="filter-item-name">${filterSet.name}</h3>
        </div>
        <button class="filter-action-btn delete-action" data-filter-id="${filterSet.id}" data-origin="${filterSet.originSite}" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      
      <div class="filter-content-expanded">
        ${brands.length > 0 ? `
        <div class="filter-type-section">
          <div class="filter-type-header">
            <i class="fa-solid fa-tags"></i> Brands
          </div>
          <div class="filter-options-multiple">
            ${brands.map(brand => `
              <div class="filter-option-multiple" data-value="${brand}" data-type="brands" data-filter-id="${filterSet.id}">
                <input type="checkbox" class="filter-option-checkbox-multiple" value="${brand}">
                <label class="filter-option-label-multiple">${brand}</label>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        ${sizes.length > 0 ? `
        <div class="filter-type-section">
          <div class="filter-type-header">
            <i class="fa-solid fa-expand"></i> Sizes
          </div>
          <div class="filter-options-multiple">
            ${sizes.map(size => `
              <div class="filter-option-multiple" data-value="${size}" data-type="sizes" data-filter-id="${filterSet.id}">
                <input type="checkbox" class="filter-option-checkbox-multiple" value="${size}">
                <label class="filter-option-label-multiple">${size}</label>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        ${colors.length > 0 ? `
        <div class="filter-type-section">
          <div class="filter-type-header">
            <i class="fa-solid fa-palette"></i> Colors
          </div>
          <div class="filter-options-multiple">
            ${colors.map(color => `
              <div class="filter-option-multiple" data-value="${color}" data-type="colors" data-filter-id="${filterSet.id}">
                <input type="checkbox" class="filter-option-checkbox-multiple" value="${color}">
                <label class="filter-option-label-multiple">${color}</label>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    `;
    
    container.appendChild(filterItem);
  });
  
  // Add Apply button at the bottom
  const applySection = document.createElement('div');
  applySection.className = 'multiple-mode-apply-section';
  applySection.innerHTML = `
    <button class="multiple-mode-apply-btn" disabled>
      <i class="fa-solid fa-magic-wand-sparkles"></i> Apply Selected Filters
    </button>
  `;
  container.appendChild(applySection);
  
  // Helper function to update filter option item appearance
  function updateFilterOptionItem(checkbox) {
    const item = checkbox.closest('.filter-option-multiple');
    if (checkbox.checked) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  }

  // Helper function to update master checkbox state
  function updateMultipleModeFilterCheckbox(optionCheckbox) {
    const filterId = optionCheckbox.closest('.filter-option-multiple').dataset.filterId;
    const masterCheckbox = container.querySelector(`.master-checkbox[data-filter-id="${filterId}"]`);
    const allOptionsInFilter = container.querySelectorAll(`.filter-option-checkbox-multiple[data-filter-id="${filterId}"]`);
    const checkedOptionsInFilter = container.querySelectorAll(`.filter-option-checkbox-multiple[data-filter-id="${filterId}"]:checked`);
    
    masterCheckbox.checked = checkedOptionsInFilter.length > 0;
    masterCheckbox.indeterminate = checkedOptionsInFilter.length > 0 && checkedOptionsInFilter.length < allOptionsInFilter.length;
  }

  // Helper function to update apply button state
  function updateMultipleModeApplyButton() {
    const applyBtn = container.querySelector('.multiple-mode-apply-btn');
    const checkedOptions = container.querySelectorAll('.filter-option-checkbox-multiple:checked');
    applyBtn.disabled = checkedOptions.length === 0;
  }
  
  // Add event listeners
  container.addEventListener('click', function(e) {
    if (e.target.closest('.delete-action')) {
      const filterId = parseInt(e.target.closest('.delete-action').dataset.filterId);
      const originSite = e.target.closest('.delete-action').dataset.origin;
      deleteFilterSet(originSite, filterId);
    } else if (e.target.classList.contains('master-checkbox')) {
      const filterId = e.target.dataset.filterId;
      const isChecked = e.target.checked;
      const relatedOptions = container.querySelectorAll(`[data-filter-id="${filterId}"] .filter-option-checkbox-multiple`);
      
      relatedOptions.forEach(option => {
        option.checked = isChecked;
        updateFilterOptionItem(option);
      });
      
      updateMultipleModeApplyButton();
    } else if (e.target.classList.contains('filter-option-checkbox-multiple')) {
      updateFilterOptionItem(e.target);
      updateMultipleModeFilterCheckbox(e.target);
      updateMultipleModeApplyButton();
    } else if (e.target.closest('.filter-option-multiple')) {
      const item = e.target.closest('.filter-option-multiple');
      const checkbox = item.querySelector('.filter-option-checkbox-multiple');
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        updateFilterOptionItem(checkbox);
        updateMultipleModeFilterCheckbox(checkbox);
        updateMultipleModeApplyButton();
      }
    } else if (e.target.closest('.multiple-mode-apply-btn')) {
      applyMultipleModeFilters(container);
    }
  });
  
  savedFiltersSection.innerHTML = '';
  savedFiltersSection.appendChild(container);
}

// Function to apply filters from single mode details view
async function applySingleModeFilters(filterSet, detailsView) {
  const selectedFilters = {
    brands: [],
    sizes: [],
    colors: [],
    originSite: filterSet.originSite
  };
  
  // Get selected brands
  const selectedBrands = detailsView.querySelectorAll('[data-section="brands"] .filter-option-checkbox:checked');
  selectedBrands.forEach(checkbox => {
    selectedFilters.brands.push(checkbox.value);
  });
  
  // Get selected sizes
  const selectedSizes = detailsView.querySelectorAll('[data-section="sizes"] .filter-option-checkbox:checked');
  selectedSizes.forEach(checkbox => {
    selectedFilters.sizes.push(checkbox.value);
  });
  
  // Get selected colors
  const selectedColors = detailsView.querySelectorAll('[data-section="colors"] .filter-option-checkbox:checked');
  selectedColors.forEach(checkbox => {
    selectedFilters.colors.push(checkbox.value);
  });
  
  console.log("[Popup] Applying single mode filters:", selectedFilters);
  
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
      
      // Go back to main list after applying
      currentDetailView = null;
      renderSingleModeFilters();
    } else if (result.partialSuccess) {
      console.log("[Popup] Filters partially applied:", result);
      
      // Create detailed partial success message
      let message;
      if (result.result && result.result.summary) {
        message = createDetailedFilterMessage(result.result.summary, true);
      } else {
        message = "Some filters were applied successfully!";
      }
      
      showMessage(message);
      
      // Go back to main list after applying
      currentDetailView = null;
      renderSingleModeFilters();
    } else {
      console.error("[Popup] Error applying filters:", result.error);
      showMessage(`❌ ${result.error || "Error applying filters"}`, true);
    }
  } catch (error) {
    console.error("[Popup] Error communicating with content script:", error);
    showMessage("Error applying filters. Please refresh the page and try again.", true);
  }
}

// Function to apply filters from multiple mode
async function applyMultipleModeFilters(container) {
  const selectedFilters = {
    brands: [],
    sizes: [],
    colors: [],
    originSite: 'multiple'
  };
  
  // Get all selected filters from multiple mode
  const selectedBrands = container.querySelectorAll('[data-type="brands"] .filter-option-checkbox-multiple:checked');
  selectedBrands.forEach(checkbox => {
    if (!selectedFilters.brands.includes(checkbox.value)) {
      selectedFilters.brands.push(checkbox.value);
    }
  });
  
  const selectedSizes = container.querySelectorAll('[data-type="sizes"] .filter-option-checkbox-multiple:checked');
  selectedSizes.forEach(checkbox => {
    if (!selectedFilters.sizes.includes(checkbox.value)) {
      selectedFilters.sizes.push(checkbox.value);
    }
  });
  
  const selectedColors = container.querySelectorAll('[data-type="colors"] .filter-option-checkbox-multiple:checked');
  selectedColors.forEach(checkbox => {
    if (!selectedFilters.colors.includes(checkbox.value)) {
      selectedFilters.colors.push(checkbox.value);
    }
  });
  
  console.log("[Popup] Applying multiple mode filters:", selectedFilters);
  
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
    } else if (result.partialSuccess) {
      console.log("[Popup] Filters partially applied:", result);
      
      // Create detailed partial success message
      let message;
      if (result.result && result.result.summary) {
        message = createDetailedFilterMessage(result.result.summary, true);
      } else {
        message = "Some filters were applied successfully!";
      }
      
      showMessage(message);
    } else {
      console.error("[Popup] Error applying filters:", result.error);
      showMessage(`❌ ${result.error || "Error applying filters"}`, true);
    }
  } catch (error) {
    console.error("[Popup] Error communicating with content script:", error);
    showMessage("Error applying filters. Please refresh the page and try again.", true);
  }
}

// Main initialization when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  console.log("[Popup] DOM content loaded, starting initialization");
  
  // Set up global DOM references
  savedFiltersSection = document.getElementById('savedFilters');
  
  // Show loading state immediately
  showLoadingState();
  
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.url) {
      showMessage("Unable to access current tab information.", true);
      return;
    }
    
  const url = new URL(tab.url);
    const hostname = url.hostname;
    console.log("[Popup] Current site:", hostname);
    
    // Check if site is supported - include luxury.tatacliq.com
    if (!hostname.includes('ajio.com') && !hostname.includes('myntra.com') && 
        !hostname.includes('amazon.in') && !hostname.includes('flipkart.com') &&
        !hostname.includes('tatacliq.com') && hostname !== 'luxury.tatacliq.com' &&
        !hostname.includes('snapdeal.com')) {
      showMessage("This extension only works on AJIO, Myntra, Amazon, Flipkart, TataCliq, Luxury TataCliq, and Snapdeal.", true);
    return;
  }

    console.log("[Popup] Current site:", hostname, "- Supported");
    
    // Initialize the popup interface
    await initializePopup();
    
    // Mark as initialized
    isInitialized = true;
    
    // Load saved filters
    await loadSavedFilters();
    
  } catch (error) {
    console.error("[Popup] Error during initialization:", error);
    showMessage("Error accessing current page. Please refresh and try again.", true);
  }
});

async function initializePopup() {
    const saveCurrentBtn = document.getElementById('saveCurrent');
    const savedFiltersDiv = document.getElementById('savedFilters');
    const saveForm = document.getElementById('saveForm');
    const filterSetName = document.getElementById('filterSetName');
    const confirmSaveBtn = document.getElementById('confirmSave');
    const cancelSaveBtn = document.getElementById('cancelSave');
    const messageContainer = document.getElementById('messageContainer');
  
  // Set global savedFiltersSection reference
  savedFiltersSection = savedFiltersDiv;
  
  // Brand List elements
  const brandListBtn = document.getElementById('brandListBtn');
  const brandListInterface = document.getElementById('brandListInterface');
  const backToBrowse = document.getElementById('backToBrowse');
  const brandsList = document.getElementById('brandsList');
  const brandSearchInput = document.getElementById('brandSearchInput');
  const selectAllBrands = document.getElementById('selectAllBrands');
  const clearAllBrands = document.getElementById('clearAllBrands');
  const applySelectedBrands = document.getElementById('applySelectedBrands');
  const selectedBrandCount = document.getElementById('selectedBrandCount');
  const savedSearchesBar = document.querySelector('.saved-searches-bar');
  
  // Filter Mode elements
  const filterModeDropdown = document.getElementById('filterModeDropdown');
  const filterModeBar = document.querySelector('.filter-mode-bar');
    
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

  // Brand List functionality
  let allBrands = new Set();
  let selectedBrands = new Set();
  let filteredBrands = [];

  // Extract all unique brands from saved filters
  async function extractAllBrands() {
    try {
      const { savedFilters = {} } = await chrome.storage.local.get(['savedFilters']);
      allBrands.clear();
      
      Object.values(savedFilters).forEach(siteFilters => {
        siteFilters.forEach(filterSet => {
          if (filterSet.filters && filterSet.filters.brands) {
            filterSet.filters.brands.forEach(brand => {
              const brandName = typeof brand === 'string' ? brand : brand.text || brand.value || brand.name;
              if (brandName && brandName.trim()) {
                allBrands.add(brandName.trim());
              }
            });
          }
        });
      });
      
      console.log('[Popup] Extracted brands:', Array.from(allBrands));
      return Array.from(allBrands).sort();
    } catch (error) {
      console.error('[Popup] Error extracting brands:', error);
      return [];
    }
  }

  // Render brands list
  function renderBrandsList(brands = null) {
    const brandsToRender = brands || Array.from(allBrands).sort();
    filteredBrands = brandsToRender;
    
    if (brandsToRender.length === 0) {
      brandsList.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
          <i class="fa-solid fa-tags" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No Brands Found</div>
          <div style="font-size: 14px;">Save some filters first to build your brand list!</div>
        </div>
      `;
      return;
    }

    brandsList.innerHTML = brandsToRender.map(brand => `
      <div class="brand-item ${selectedBrands.has(brand) ? 'selected' : ''}" data-brand="${brand}">
        <input type="checkbox" id="brand-${brand.replace(/\s+/g, '-')}" ${selectedBrands.has(brand) ? 'checked' : ''}>
        <label for="brand-${brand.replace(/\s+/g, '-')}">${brand}</label>
      </div>
    `).join('');

    // Add event listeners to brand items
    brandsList.querySelectorAll('.brand-item').forEach(item => {
      const brandName = item.getAttribute('data-brand');
      const checkbox = item.querySelector('input[type="checkbox"]');
      
      item.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox') {
          checkbox.checked = !checkbox.checked;
        }
        
        if (checkbox.checked) {
          selectedBrands.add(brandName);
          item.classList.add('selected');
        } else {
          selectedBrands.delete(brandName);
          item.classList.remove('selected');
        }
        
        updateSelectedBrandCount();
      });
    });
  }

  // Update selected brand count and apply button state
  function updateSelectedBrandCount() {
    const count = selectedBrands.size;
    selectedBrandCount.textContent = count;
    applySelectedBrands.disabled = count === 0;
    
    // Update visual state of apply button
    if (count === 0) {
      applySelectedBrands.innerHTML = '<i class="fa-solid fa-magic-wand-sparkles"></i> Apply Brands';
    } else {
      applySelectedBrands.innerHTML = `<i class="fa-solid fa-magic-wand-sparkles"></i> Apply ${count} Brand${count > 1 ? 's' : ''}`;
    }
  }

  // Search brands functionality
  brandSearchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase().trim();
    
    if (searchTerm === '') {
      renderBrandsList();
    } else {
      const filtered = Array.from(allBrands).filter(brand => 
        brand.toLowerCase().includes(searchTerm)
      );
      renderBrandsList(filtered);
    }
  });

  // Select all brands
  selectAllBrands.addEventListener('click', function() {
    filteredBrands.forEach(brand => selectedBrands.add(brand));
    renderBrandsList(filteredBrands);
    updateSelectedBrandCount();
  });

  // Clear all selected brands
  clearAllBrands.addEventListener('click', function() {
    selectedBrands.clear();
    renderBrandsList(filteredBrands);
    updateSelectedBrandCount();
  });

  // Show brand list interface
  brandListBtn.addEventListener('click', async function() {
    try {
      await extractAllBrands();
      
      // Hide main interface
      savedSearchesBar.style.display = 'none';
      savedFiltersSection.style.display = 'none';
      filterModeBar.style.display = 'none';
      
      // Show brand list interface
      brandListInterface.style.display = 'block';
      
      // Render brands
      renderBrandsList();
      updateSelectedBrandCount();
      
      // Focus search input
      brandSearchInput.focus();
    } catch (error) {
      console.error('[Popup] Error opening brand list:', error);
      showMessage('Error loading brand list', true);
    }
  });

  // Back to browse from brand list
  backToBrowse.addEventListener('click', function() {
    try {
      console.log('[Popup] Going back to browse from brand list');
      
      // Clear brand search and selections
      brandSearchInput.value = '';
      selectedBrands.clear();
      
      // Hide brand list interface
      brandListInterface.style.display = 'none';
      
      // Show main interface elements
      savedSearchesBar.style.display = 'block';
      savedFiltersSection.style.display = 'block';
      filterModeBar.style.display = 'flex';
      
      // Re-render filters in current mode
      renderFiltersInCurrentMode();
    } catch (error) {
      console.error('[Popup] Error going back to browse:', error);
      showMessage('Error returning to browse view', true);
    }
  });

  // Apply selected brands
  applySelectedBrands.addEventListener('click', async function() {
    if (selectedBrands.size === 0) return;
    
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const currentHostname = new URL(tab.url).hostname;
      
      // Check if current site is compatible
      if (!isCompatibleSite(currentHostname)) {
        showMessage('Current site is not supported for filter application', true);
        return;
      }
      
      // Ensure connection
      await ensureContentScriptConnection();
      
      // Create brand-only filter object
      const brandOnlyFilters = {
        brands: Array.from(selectedBrands),
        sizes: [],
        colors: [],
        originSite: 'brand-list'
      };
      
      console.log('[Popup] Applying brand filters:', brandOnlyFilters);
      
      // Show applying message
      showMessage(`Applying ${selectedBrands.size} brand${selectedBrands.size > 1 ? 's' : ''}...`);
      
      // Apply the brand filters
      const response = await retryOperation(async () => {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "applyFilters",
          filters: brandOnlyFilters
        });
        
        return response;
      }, 3, 1000);
      
      console.log('[Popup] Brand filters response:', response);
      
      // Analyze results and show appropriate toast
      const requestedBrands = Array.from(selectedBrands);
      let appliedBrands = [];
      let failedBrands = [];
      
      if (response?.success || response?.partialSuccess) {
        // Extract applied and failed brands from response
        if (response.results?.brands?.appliedFilters) {
          appliedBrands = response.results.brands.appliedFilters;
        } else if (response.result?.summary?.appliedFilters?.brands) {
          appliedBrands = response.result.summary.appliedFilters.brands;
        }
        
        if (response.results?.brands?.failedFilters) {
          failedBrands = response.results.brands.failedFilters;
        } else if (response.result?.summary?.failedFilters?.brands) {
          failedBrands = response.result.summary.failedFilters.brands;
        }
        
        // If we don't have detailed results, calculate based on response
        if (appliedBrands.length === 0 && failedBrands.length === 0) {
          if (response.success) {
            appliedBrands = requestedBrands;
          } else if (response.partialSuccess) {
            // Assume partial success means some worked
            appliedBrands = requestedBrands.slice(0, Math.ceil(requestedBrands.length / 2));
            failedBrands = requestedBrands.slice(Math.ceil(requestedBrands.length / 2));
          }
        }
      } else {
        // Complete failure
        failedBrands = requestedBrands;
      }
      
      // Show appropriate toast notification
      if (appliedBrands.length === 0 && failedBrands.length > 0) {
        // No brands could be applied
        showMessage(`❌ None of the selected brands were found on this site:\n${failedBrands.join(', ')}`, true);
      } else if (appliedBrands.length > 0 && failedBrands.length > 0) {
        // Some brands applied, some failed
        let message = `⚠️ ${appliedBrands.length}/${requestedBrands.length} brands applied successfully!\n\n`;
        message += `✅ Applied: ${appliedBrands.join(', ')}\n\n`;
        message += `❌ Not found: ${failedBrands.join(', ')}`;
        showMessage(message);
      } else if (appliedBrands.length > 0) {
        // All brands applied successfully
        showMessage(`✅ All ${appliedBrands.length} brand${appliedBrands.length > 1 ? 's' : ''} applied successfully!\n${appliedBrands.join(', ')}`);
      } else {
        // Unknown state - show generic message
        showMessage(`${selectedBrands.size} brand${selectedBrands.size > 1 ? 's' : ''} processed. Check results on the page.`);
      }
      
      // Clear selections and go back
      setTimeout(() => {
        selectedBrands.clear();
        backToBrowse.click();
      }, 3000); // Increased delay to let users read the toast
      
    } catch (error) {
      console.error('[Popup] Error applying brand filters:', error);
      showMessage(`❌ Error applying brand filters: ${error.message || 'Unknown error occurred'}`, true);
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
      
      // Create detailed save confirmation message
      const filters = response.filters.data;
      const brandCount = filters.brands ? filters.brands.length : 0;
      const sizeCount = filters.sizes ? filters.sizes.length : 0;
      const colorCount = filters.colors ? filters.colors.length : 0;
      const totalCount = brandCount + sizeCount + colorCount;
      
      let saveMessage = `✅ "${name}" saved successfully!\n\n`;
      if (totalCount > 0) {
        saveMessage += `Saved ${totalCount} filter${totalCount > 1 ? 's' : ''}:\n`;
        if (brandCount > 0) saveMessage += `• ${brandCount} brand${brandCount > 1 ? 's' : ''}\n`;
        if (sizeCount > 0) saveMessage += `• ${sizeCount} size${sizeCount > 1 ? 's' : ''}\n`;
        if (colorCount > 0) saveMessage += `• ${colorCount} color${colorCount > 1 ? 's' : ''}\n`;
      } else {
        saveMessage += `No active filters found to save.`;
      }
      
      // showMessage(saveMessage.trim());
      
      // Refresh brand list if it's currently open
      if (brandListInterface.style.display !== 'none') {
        await extractAllBrands();
        renderBrandsList();
      }
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
  
  // Filter Mode functionality
  
  // Load saved filter mode preference
  const savedFilterMode = localStorage.getItem('filterMode') || 'single';
  currentFilterMode = savedFilterMode;
  filterModeDropdown.value = savedFilterMode;
  
  // Filter mode dropdown change handler
  filterModeDropdown.addEventListener('change', function() {
    currentFilterMode = this.value;
    localStorage.setItem('filterMode', currentFilterMode);
    
    // Clear any detail view when switching modes
    currentDetailView = null;
    
    // Re-render the filters in the new mode
    renderFiltersInCurrentMode();
  });
}

// End of initializePopup function
    
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
        
        // Show success toast notification
        showToast(`Filter set "${filters.name}" saved successfully!`, 'save');
      } catch (error) {
        console.error("[Popup] Error saving to storage:", error);
        
        // Show error toast notification
        showToast(`Failed to save filter set: ${error.message}`, 'error');
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
        
    // Clear the existing filters array
    allSavedFilters.length = 0;
        
    // Get all filters that can be applied to current site
        for (const [hostname, siteFilters] of Object.entries(savedFilters)) {
          console.log("[Popup] Checking filters for hostname:", hostname);
          if (isCompatibleSite(hostname)) {
            console.log("[Popup] Adding compatible filters from:", hostname);
        // Add origin site information to each filter
        siteFilters.forEach(filterSet => {
          allSavedFilters.push({
            ...filterSet,
            originSite: hostname
          });
        });
      }
    }
    
    console.log("[Popup] Total compatible filters found:", allSavedFilters.length);
        
        // Sort by most recent first
    allSavedFilters.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Render filters using the current mode
    renderFiltersInCurrentMode();
    
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
    } else if (result.partialSuccess) {
      console.log("[Popup] Filters partially applied:", result);
      
      // Create detailed partial success message
      let message;
      if (result.result && result.result.summary) {
        message = createDetailedFilterMessage(result.result.summary, true);
          } else {
        message = "Some filters were applied successfully!";
        }
        
      showMessage(message);
        filterSelection.remove();
    } else {
      console.error("[Popup] Error applying filters:", result.error);
      showMessage(`❌ ${result.error || "Error applying filters"}`, true);
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
      try {
        const {savedFilters = {}} = await chrome.storage.local.get(['savedFilters']);
        
        if (savedFilters[originSite]) {
      // Find the filter set name before deleting for better toast message
      const filterToDelete = savedFilters[originSite].find(filter => filter.id === id);
      const filterName = filterToDelete ? filterToDelete.name : 'Filter set';
      
      if (!confirm(`Are you sure you want to delete "${filterName}"?`)) {
        return;
      }
      
      savedFilters[originSite] = savedFilters[originSite].filter(filter => filter.id !== id);
      
      // Remove the site entry if no filters remain
      if (savedFilters[originSite].length === 0) {
        delete savedFilters[originSite];
      }
      
          await chrome.storage.local.set({savedFilters: savedFilters});
      // showMessage(`✅ "${filterName}" deleted successfully!`);
      
      // Show delete toast notification
      showToast(`Filter set "${filterName}" deleted successfully!`, 'delete');
      
      // Reset detail view if we're in single mode and viewing the deleted filter
      if (currentFilterMode === 'single' && currentDetailView && currentDetailView.id === id) {
        currentDetailView = null;
      }
      
      // Reload saved filters to refresh the current view
          loadSavedFilters();
      
      // Refresh brand list if it's currently open
      const brandListInterface = document.getElementById('brandListInterface');
      if (brandListInterface && brandListInterface.style.display !== 'none') {
        const extractAllBrands = window.extractAllBrands;
        const renderBrandsList = window.renderBrandsList;
        if (extractAllBrands && renderBrandsList) {
          await extractAllBrands();
          renderBrandsList();
        }
      }
        }
      } catch (error) {
        console.error("[Popup] Error deleting filter set:", error);
        showMessage("❌ Error deleting filter set", true);
        
        // Show error toast notification
        showToast(`Failed to delete filter set: ${error.message}`, 'error');
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


