// Check if current tab is on a supported site
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  const tab = tabs[0];
  const url = new URL(tab.url);

  if (!url.hostname.includes('ajio.com') && !url.hostname.includes('myntra.com') && 
      !url.hostname.includes('amazon.in') && !url.hostname.includes('flipkart.com') &&
      !url.hostname.includes('tatacliq.com')) {
    showMessage("This extension only works on AJIO, Myntra, Amazon, Flipkart, and TataCliq.", true);
    return;
  }

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
    saveCurrentBtn.addEventListener('click', function() {
      saveForm.style.display = 'block';
      filterSetName.focus();
    });
    
    // Confirm save
    confirmSaveBtn.addEventListener('click', async function() {
      const name = filterSetName.value.trim() || 'Unnamed Set';
      console.log("[Popup] Attempting to save filters as:", name);
      
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        console.log("[Popup] Communicating with tab:", tab.url);
        
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
        // First ensure we have a valid connection to the content script
        await ensureContentScriptConnection();
        
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
    
    // Ensure content script connection
    async function ensureContentScriptConnection() {
      console.log("[Popup] Ensuring content script connection...");
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tab?.id) throw new Error('No active tab found');

        // Try to establish connection with content script
        const response = await chrome.tabs.sendMessage(tab.id, {action: "ping"});
        if (!response) {
          throw new Error('Could not establish connection with content script');
        }
        console.log("[Popup] Content script connection established");
        return true;
      } catch (error) {
        console.error("[Popup] Content script connection error:", error);
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
             hostname.includes('tatacliq.com');
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
      filterSelection.querySelectorAll('#brandCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFilters.brands.push(checkbox.value);
      });
      
      // Get selected sizes
      filterSelection.querySelectorAll('#sizeCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFilters.sizes.push(checkbox.value);
      });
      
      // Get selected colors
      filterSelection.querySelectorAll('#colorCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFilters.colors.push(checkbox.value);
      });
      
      // Show loading state
      const applySelectedBtn = filterSelection.querySelector('#applySelected');
      const originalText = applySelectedBtn.innerHTML;
      applySelectedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying Filters...';
      applySelectedBtn.disabled = true;
      
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!isCompatibleSite(new URL(tab.url).hostname)) {
          throw new Error('Please navigate to Ajio, Myntra, Amazon, Flipkart, or TataCliq first');
        }

        // Add origin site information
        selectedFilters.originSite = filterSet.originSite;

        // For Amazon, reload the page first to avoid back/forward cache issues
        if (tab.url.includes('amazon.in')) {
          applySelectedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reloading page...';
          await chrome.tabs.reload(tab.id);
          // Wait for page to load
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Ensure content script is injected
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['contentScript.js']
          });
        } catch (error) {
          console.log("[Popup] Content script already injected");
        }

        // Wait longer for content script to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Ensure content script connection with retries
        let connected = false;
        for (let i = 0; i < 3; i++) {
          try {
            await ensureContentScriptConnection();
            connected = true;
            break;
          } catch (error) {
            console.log(`[Popup] Connection attempt ${i + 1} failed:`, error);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!connected) {
          throw new Error('Could not establish connection with the page. Please try refreshing.');
        }

        // For all sites, wait longer for the page to be fully loaded
        applySelectedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing filters...';
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Set up a timeout promise
        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), 45000); // 45 second timeout
        });

        // Apply selected filters with timeout and retries
        applySelectedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying filters...';
        const applyPromise = new Promise(async (resolve, reject) => {
          let lastError;
          for (let i = 0; i < 3; i++) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id, {
                action: "applyFilters",
                filters: selectedFilters
              });
              resolve(response);
              return;
            } catch (error) {
              console.log(`[Popup] Apply attempt ${i + 1} failed:`, error);
              lastError = error;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          reject(lastError || new Error('Failed to apply filters after retries'));
        });

        // Wait for either the apply operation to complete or timeout
        const response = await Promise.race([applyPromise, timeout]);

        if (!response || !response.success) {
          // If we have a partial success, show a different message
          if (response?.partialSuccess) {
            const summary = response.result?.summary;
            if (summary) {
              const successMessage = `Partially applied filters: ${summary.totalApplied}/${summary.totalRequested} filters applied successfully.`;
              const detailMessage = createDetailedFilterMessage(summary, true);
              showMessage(successMessage + detailMessage, false);
            } else {
              showMessage('Some filters were applied successfully, but not all. Please check the results.', false);
            }
            filterSelection.remove();
            window.close();
            return;
          }
          throw new Error(response?.error || 'Failed to apply filters. Please try again.');
        }
        
        // Handle successful application
        const summary = response.result?.summary;
        if (summary) {
          if (summary.totalApplied === summary.totalRequested) {
            showMessage(`All ${summary.totalApplied} filters from "${filterSet.name}" applied successfully!`);
          } else if (summary.totalApplied > 0) {
            const successMessage = `Partially applied filters: ${summary.totalApplied}/${summary.totalRequested} filters applied successfully.`;
            const detailMessage = createDetailedFilterMessage(summary, true);
            showMessage(successMessage + detailMessage, false);
          } else {
            showMessage('No filters could be applied. Please check if the filters are still available on the page.', true);
          }
        } else {
          showMessage(`Selected filters from "${filterSet.name}" applied successfully!`);
        }
        
        filterSelection.remove();
        window.close(); // Close popup after successful apply
      } catch (error) {
        console.error("[Popup] Error applying filters:", error);
        
        // Create detailed error message
        let errorMessage = `Error applying filters: ${error.message}`;
        if (error.message.includes('timeout')) {
          errorMessage += ' The operation took too long. Some filters might have been applied. Please check the page.';
        }
        
        showMessage(errorMessage, true);
      } finally {
        // Restore button state
        applySelectedBtn.innerHTML = originalText;
        applySelectedBtn.disabled = false;
      }
    }
    
    // Helper function to create detailed filter messages
    function createDetailedFilterMessage(summary, isPartial = false) {
      const parts = [];
      
      if (summary.appliedFilters.brands.length > 0) {
        parts.push(`Brands: ${summary.appliedFilters.brands.join(', ')}`);
      }
      if (summary.appliedFilters.sizes.length > 0) {
        parts.push(`Sizes: ${summary.appliedFilters.sizes.join(', ')}`);
      }
      if (summary.appliedFilters.colors.length > 0) {
        parts.push(`Colors: ${summary.appliedFilters.colors.join(', ')}`);
      }
      
      let message = '';
      if (parts.length > 0) {
        message += ` Successfully applied: ${parts.join('; ')}.`;
      }
      
      if (isPartial) {
        const failedParts = [];
        if (summary.failedFilters.brands.length > 0) {
          failedParts.push(`Brands: ${summary.failedFilters.brands.join(', ')}`);
        }
        if (summary.failedFilters.sizes.length > 0) {
          failedParts.push(`Sizes: ${summary.failedFilters.sizes.join(', ')}`);
        }
        if (summary.failedFilters.colors.length > 0) {
          failedParts.push(`Colors: ${summary.failedFilters.colors.join(', ')}`);
        }
        
        if (failedParts.length > 0) {
          message += ` Failed to apply: ${failedParts.join('; ')}.`;
        }
      }
      
      return message;
    }
    
    // Delete a filter set
    async function deleteFilterSet(originSite, id) {
      console.log("[Popup] Deleting filter set:", id);
      try {
        const {savedFilters = {}} = await chrome.storage.local.get(['savedFilters']);
        
        if (savedFilters[originSite]) {
          savedFilters[originSite] = savedFilters[originSite].filter(set => set.id !== id);
          await chrome.storage.local.set({savedFilters: savedFilters});
          showMessage('Filter set deleted');
          loadSavedFilters();
        }
      } catch (error) {
        console.error("[Popup] Error deleting filter set:", error);
        showMessage('Error deleting filter set', true);
      }
    }
    
    // Show status messages
    function showMessage(message, isError = false) {
      console.log(`[Popup] ${isError ? 'Error:' : 'Success:'} ${message}`);
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${isError ? 'error' : 'success'}`;
      messageDiv.textContent = message;
      
      messageContainer.innerHTML = '';
      messageContainer.appendChild(messageDiv);
      
      setTimeout(() => {
        messageDiv.remove();
      }, 3000);
    }
    
    // Load saved filters when popup opens
    loadSavedFilters();
  });
});


