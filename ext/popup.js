// Check if current tab is on a supported site
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  const tab = tabs[0];
  const url = new URL(tab.url);

  if (!url.hostname.includes('ajio.com') && !url.hostname.includes('myntra.com')) {
    showMessage("This extension only works on AJIO or Myntra.", true);
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
              <div class="emoji">🔍</div>
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
          applyBtn.textContent = '▶️ Apply';
          applyBtn.addEventListener('click', () => applyFilterSet(filterSet));
          
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = '🗑️ Delete';
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
            <div class="emoji">⚠️</div>
            <p>Error loading saved filters</p>
            <small>${error.message}</small>
          </div>
        `;
      }
    }
    
    // Check if a hostname is compatible with our extension
    function isCompatibleSite(hostname) {
      return hostname.includes('ajio.com') || hostname.includes('myntra.com');
    }
    
    // Apply a filter set
    async function applyFilterSet(filterSet) {
      console.log("[Popup] Starting to apply filter set:", filterSet.name);
      console.log("[Popup] Filter set details:", {
        brands: filterSet.filters.brands,
        sizes: filterSet.filters.sizes,
        colors: filterSet.filters.colors,
        originSite: filterSet.originSite
      });

      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        console.log("[Popup] Current tab URL:", tab.url);
        
        if (!isCompatibleSite(new URL(tab.url).hostname)) {
          throw new Error('Please navigate to Ajio or Myntra first');
        }

        // Ensure content script connection before applying filters
        await ensureContentScriptConnection();

        // Retry applying filters if needed
        const response = await retryOperation(async () => {
          console.log("[Popup] Sending applyFilters message to content script");
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "applyFilters",
            filters: filterSet.filters
          });
          
          console.log("[Popup] Received response from content script:", response);
          
          if (chrome.runtime.lastError) {
            console.error("[Popup] Runtime error:", chrome.runtime.lastError);
            throw new Error(chrome.runtime.lastError);
          }
          
          if (!response || !response.success) {
            throw new Error('Failed to apply filters. Please try again.');
          }
          
          return response;
        }, 3, 1000);
        
        showMessage(`"${filterSet.name}" applied successfully!`);
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
  });
});


