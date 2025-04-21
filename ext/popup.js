chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  const tab = tabs[0];
  const url = new URL(tab.url);

  if (!url.hostname.includes('ajio.com') && !url.hostname.includes('myntra.com')) {
    showMessage("This extension only works on AJIO or Myntra.");
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
        
        const response = await chrome.tabs.sendMessage(tab.id, {action: "getCurrentFilters"});
        
        if (!response?.filters) {
          throw new Error('No filters detected on the page');
        }
        
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
    
    // Save filter set to storage
    async function saveFilterSet(filters) {
      console.log("[Popup] Saving filter set:", filters);
      try {
        const {savedFilters = {}} = await chrome.storage.local.get(['savedFilters']);
        const hostname = new URL(filters.url).hostname;
        
        if (!savedFilters[hostname]) {
          savedFilters[hostname] = [];
        }
        
        savedFilters[hostname].push({
          id: Date.now(),
          name: filters.name,
          filters: filters.data,
          timestamp: filters.timestamp,
          originSite: filters.originSite
        });
        
        await chrome.storage.local.set({savedFilters: savedFilters});
        console.log("[Popup] Filters saved successfully");
        loadSavedFilters();
      } catch (error) {
        console.error("[Popup] Error saving to storage:", error);
        throw error;
      }
    }
    
    // Load saved filters from storage
    async function loadSavedFilters() {
      console.log("[Popup] Loading saved filters...");
      savedFiltersDiv.innerHTML = '';
      
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tab?.url) return;
        
        const {savedFilters = {}} = await chrome.storage.local.get(['savedFilters']);
        const currentHostname = new URL(tab.url).hostname;
        
        // Get all filters that can be applied to current site (either from same site or cross-compatible)
        const allCompatibleFilters = [];
        
        for (const [hostname, siteFilters] of Object.entries(savedFilters)) {
          if (isCompatibleSite(hostname)) {
            allCompatibleFilters.push(...siteFilters);
          }
        }
        
        console.log(`[Popup] Found ${allCompatibleFilters.length} compatible filters`);
        
        if (allCompatibleFilters.length === 0) {
          savedFiltersDiv.innerHTML = '<p style="text-align: center; color: #666;">No saved filters for supported sites</p>';
          return;
        }
        
        // Sort by most recent first
        allCompatibleFilters.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        allCompatibleFilters.forEach(filterSet => {
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
            `<small>(From ${filterSet.originSite})</small>` : '';
          
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
        savedFiltersDiv.innerHTML = '<p style="color: red;">Error loading saved filters</p>';
      }
    }
    
    // Check if a hostname is compatible with our extension
    function isCompatibleSite(hostname) {
      return hostname.includes('ajio.com') || hostname.includes('myntra.com');
    }
    
    // Apply a filter set
    async function applyFilterSet(filterSet) {
      console.log("[Popup] Applying filter set:", filterSet.name);
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!isCompatibleSite(new URL(tab.url).hostname)) {
          throw new Error('Please navigate to Ajio or Myntra first');
        }
        
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "applyFilters",
          filters: filterSet.filters
        });
        
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError);
        }
        
        showMessage(`"${filterSet.name}" applied successfully!`);
        window.close(); // Close popup after successful apply
      } catch (error) {
        console.error("[Popup] Error applying filters:", error);
        showMessage('Error applying filters. Please try again.', true);
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


