// Check if current tab is on a supported site
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  const tab = tabs[0];
  const url = new URL(tab.url);

  if (!url.hostname.includes('ajio.com') && !url.hostname.includes('myntra.com') && 
      !url.hostname.includes('amazon.in') && !url.hostname.includes('flipkart.com') &&
      !url.hostname.includes('nykaa.com')) {
    showMessage("This extension only works on AJIO, Myntra, Amazon, Flipkart, or Nykaa.", true);
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
          applyBtn.addEventListener('click', () => showFilterSelection(filterSet));
          
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
             hostname.includes('nykaa.com') || hostname.includes('nykaa.com');
    }
    
    // Function to show filter selection UI
    function showFilterSelection(filterSet) {
      const filterSelection = document.getElementById('filterSelection');
      const brandCheckboxes = document.getElementById('brandCheckboxes');
      const sizeCheckboxes = document.getElementById('sizeCheckboxes');
      const colorCheckboxes = document.getElementById('colorCheckboxes');
      const applySelectedBtn = document.getElementById('applySelected');
      
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
      
      // Show filter selection UI
      filterSelection.style.display = 'block';
      
      // Update apply button state
      updateApplyButtonState();
      
      // Add event listeners for checkboxes
      document.querySelectorAll('.filter-checkbox-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateApplyButtonState);
      });

      // Add event listeners for select all checkboxes
      const selectAllFilters = document.getElementById('selectAllFilters');
      const selectAllBrands = document.getElementById('selectAllBrands');
      const selectAllSizes = document.getElementById('selectAllSizes');
      const selectAllColors = document.getElementById('selectAllColors');

      // Handle main "Select All" checkbox
      selectAllFilters.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        // Update all individual checkboxes
        selectAllBrands.checked = isChecked;
        selectAllSizes.checked = isChecked;
        selectAllColors.checked = isChecked;
        
        // Update all filter checkboxes
        document.querySelectorAll('.filter-checkbox-item input[type="checkbox"]').forEach(checkbox => {
          checkbox.checked = isChecked;
        });
        updateApplyButtonState();
      });

      // Handle individual group checkboxes
      selectAllBrands.addEventListener('change', (e) => {
        const checkboxes = brandCheckboxes.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
        updateSelectAllState();
        updateApplyButtonState();
      });

      selectAllSizes.addEventListener('change', (e) => {
        const checkboxes = sizeCheckboxes.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
        updateSelectAllState();
        updateApplyButtonState();
      });

      selectAllColors.addEventListener('change', (e) => {
        const checkboxes = colorCheckboxes.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
        updateSelectAllState();
        updateApplyButtonState();
      });

      // Add event listener for apply button
      applySelectedBtn.onclick = () => applySelectedFilters(filterSet);
    }
    
    // Helper function to create checkbox item
    function createCheckboxItem(value) {
      const div = document.createElement('div');
      div.className = 'filter-checkbox-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `filter-${value}`;
      checkbox.value = value;
      
      const label = document.createElement('label');
      label.htmlFor = `filter-${value}`;
      label.textContent = value;
      
      div.appendChild(checkbox);
      div.appendChild(label);
      return div;
    }
    
    // Helper function to update apply button state
    function updateApplyButtonState() {
      const applySelectedBtn = document.getElementById('applySelected');
      const hasSelectedFilters = document.querySelectorAll('.filter-checkbox-item input[type="checkbox"]:checked').length > 0;
      applySelectedBtn.disabled = !hasSelectedFilters;
    }
    
    // Helper function to update the main "Select All" checkbox state
    function updateSelectAllState() {
      const selectAllFilters = document.getElementById('selectAllFilters');
      const allCheckboxes = document.querySelectorAll('.filter-checkbox-item input[type="checkbox"]');
      const checkedCheckboxes = document.querySelectorAll('.filter-checkbox-item input[type="checkbox"]:checked');
      
      selectAllFilters.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length;
    }
    
    // Function to apply selected filters
    async function applySelectedFilters(filterSet) {
      const selectedFilters = {
        brands: [],
        sizes: [],
        colors: []
      };
      
      // Get selected brands
      document.querySelectorAll('#brandCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFilters.brands.push(checkbox.value);
      });
      
      // Get selected sizes
      document.querySelectorAll('#sizeCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFilters.sizes.push(checkbox.value);
      });
      
      // Get selected colors
      document.querySelectorAll('#colorCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFilters.colors.push(checkbox.value);
      });
      
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!isCompatibleSite(new URL(tab.url).hostname)) {
          throw new Error('Please navigate to Ajio, Myntra, Amazon, Flipkart, or Nykaa first');
        }

        // Add origin site information
        selectedFilters.originSite = filterSet.originSite;

        // For Amazon, reload the page first to avoid back/forward cache issues
        if (tab.url.includes('amazon.in')) {
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
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Set up a timeout promise
        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), 30000); // 30 second timeout
        });

        // Apply selected filters with timeout and retries
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
            showMessage('Some filters were applied successfully, but not all. Please check the results.', false);
            document.getElementById('filterSelection').style.display = 'none';
            window.close();
            return;
          }
          throw new Error(response?.error || 'Failed to apply filters. Please try again.');
        }
        
        showMessage(`Selected filters from "${filterSet.name}" applied successfully!`);
        document.getElementById('filterSelection').style.display = 'none';
        window.close(); // Close popup after successful apply
      } catch (error) {
        console.error("[Popup] Error applying filters:", error);
        showMessage(`Error applying filters: ${error.message}`, true);
      }
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

    // Ensure all checkboxes in filter selection modal use .modern-checkbox
    function updateCheckboxStyles() {
      const allCheckboxes = document.querySelectorAll('#filterSelection input[type="checkbox"]');
      allCheckboxes.forEach(cb => {
        cb.classList.add('modern-checkbox');
      });
    }
    // Call after rendering modal
    const observer = new MutationObserver(updateCheckboxStyles);
    observer.observe(document.getElementById('filterSelection'), { childList: true, subtree: true });
    updateCheckboxStyles();
  });
});


