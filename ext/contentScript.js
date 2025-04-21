// Message listener for popup communication
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("[Content Script] Received message:", request.action);
  
  if (request.action === "getCurrentFilters") {
    getCurrentFilters().then(filters => {
      console.log("[Content Script] Sending filters to popup:", JSON.stringify(filters, null, 2));
      sendResponse({
        filters: {
          url: window.location.href,
          data: filters
        }
      });
    }).catch(error => {
      console.error("[Content Script] Error getting filters:", error);
      sendResponse({filters: null, error: error.message});
    });
    return true;
  } 
  else if (request.action === "applyFilters") {
    console.log("[Content Script] Applying filters:", JSON.stringify(request.filters, null, 2));
    applyFilters(request.filters).then(() => {
      sendResponse({success: true});
    }).catch(error => {
      console.error("[Content Script] Error applying filters:", error);
      sendResponse({success: false, error: error.message});
    });
    return true;
  }
});

// Get current filters from the page
async function getCurrentFilters() {
  const hostname = window.location.hostname;
  let filters = {
    brands: [],
    sizes: [],
    colors: []
  };
  
  try {
    if (hostname.includes('myntra.com')) {
      filters = await getMyntraFilters();
    } else if (hostname.includes('ajio.com')) {
      filters = await getAjioFilters();
    }
  } catch (error) {
    console.error("Error in getCurrentFilters:", error);
    throw error;
  }
  
  return filters;
}

// Apply filters to the page
async function applyFilters(filters) {
  const hostname = window.location.hostname;
  
  try {
    if (hostname.includes('myntra.com')) {
      await applyMyntraFilters(filters);
    } else if (hostname.includes('ajio.com')) {
      await applyAjioFilters(filters);
    }
  } catch (error) {
    console.error("Error in applyFilters:", error);
    throw error;
  }
}

// Myntra-specific functions
async function getMyntraFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };
  
  const brandCheckboxes = document.querySelectorAll('.brand-search .common-checkboxIndicator:checked');
  brandCheckboxes.forEach(checkbox => {
    const brandName = checkbox.closest('label').textContent.trim();
    if (brandName) filters.brands.push(brandName);
  });
  
  const sizeCheckboxes = document.querySelectorAll('.size-search .common-checkboxIndicator:checked');
  sizeCheckboxes.forEach(checkbox => {
    const size = checkbox.closest('label').textContent.trim();
    if (size) filters.sizes.push(size);
  });
  
  const colorCheckboxes = document.querySelectorAll('.color-search .common-checkboxIndicator:checked');
  colorCheckboxes.forEach(checkbox => {
    const color = checkbox.closest('label').textContent.trim();
    if (color) filters.colors.push(color);
  });
  
  return filters;
}

async function applyMyntraFilters(filters) {
  if (filters.brands && filters.brands.length > 0) {
    const brandLabels = document.querySelectorAll('.brand-search label');
    brandLabels.forEach(label => {
      const brandName = label.textContent.trim();
      if (filters.brands.includes(brandName)) {
        const checkbox = label.querySelector('.common-checkboxIndicator');
        if (checkbox && !checkbox.checked) {
          label.click();
        }
      }
    });
  }
  
  if (filters.sizes && filters.sizes.length > 0) {
    const sizeLabels = document.querySelectorAll('.size-search label');
    sizeLabels.forEach(label => {
      const size = label.textContent.trim();
      if (filters.sizes.includes(size)) {
        const checkbox = label.querySelector('.common-checkboxIndicator');
        if (checkbox && !checkbox.checked) {
          label.click();
        }
      }
    });
  }
  
  if (filters.colors && filters.colors.length > 0) {
    const colorLabels = document.querySelectorAll('.color-search label');
    colorLabels.forEach(label => {
      const color = label.textContent.trim();
      if (filters.colors.includes(color)) {
        const checkbox = label.querySelector('.common-checkboxIndicator');
        if (checkbox && !checkbox.checked) {
          label.click();
        }
      }
    });
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Ajio-specific functions
async function getAjioFilters() {
  console.log("[Content Script] Getting Ajio filters...");
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  // Get selected brands
  const brandInputs = document.querySelectorAll('input[name="brand"]:checked');
  console.log(`[Content Script] Found ${brandInputs.length} checked brand filters`);
  
  brandInputs.forEach(input => {
    const label = input.closest('.facet-linkhead')?.querySelector('.facet-linkname');
    if (label) {
      const brand = {
        id: input.id,
        value: input.value,
        text: label.textContent.replace(/\(\d+\)$/, '').trim(),
        element: 'brand'
      };
      console.log("[Content Script] Brand filter found:", brand);
      filters.brands.push(brand);
    }
  });

  // Get selected sizes
  const sizeInputs = document.querySelectorAll('input[name="verticalsizegroupformat"]:checked');
  console.log(`[Content Script] Found ${sizeInputs.length} checked size filters`);
  
  sizeInputs.forEach(input => {
    const label = input.closest('.facet-linkhead')?.querySelector('.facet-linkname');
    if (label) {
      const size = {
        id: input.id,
        value: input.value,
        text: label.textContent.replace(/\(\d+\)$/, '').trim(),
        element: 'size'
      };
      console.log("[Content Script] Size filter found:", size);
      filters.sizes.push(size);
    }
  });

  // Get selected colors
  const colorInputs = document.querySelectorAll('input[name="verticalcolorfamily"]:checked');
  console.log(`[Content Script] Found ${colorInputs.length} checked color filters`);
  
  colorInputs.forEach(input => {
    const label = input.closest('.facet-linkhead')?.querySelector('.facet-linkname');
    if (label) {
      const color = {
        id: input.id,
        value: input.value,
        text: label.textContent.replace(/\(\d+\)$/, '').trim(),
        swatch: label.querySelector('.facet-checkbox-color-inner')?.style.backgroundColor,
        element: 'color'
      };
      console.log("[Content Script] Color filter found:", color);
      filters.colors.push(color);
    }
  });

  console.log("[Content Script] Final filters object:", filters);
  return filters;
}

async function applyAjioFilters(filters) {
  console.log("[Content Script] Starting filter application...");
  
  // Reset current filters first
  await resetAjioFilters();
  console.log("[Content Script] Reset complete");

  // Function to expand filter section if needed
  const expandFilterSection = async (sectionName) => {
    const sectionHeaders = {
      brand: 'brands',
      size: 'size & fit',
      color: 'colors'
    };
    
    const headerText = sectionHeaders[sectionName];
    if (!headerText) return;
    
    const header = Array.from(document.querySelectorAll('.facet-left-pane-label'))
      .find(el => el.textContent.toLowerCase().includes(headerText.toLowerCase()));
    
    if (header) {
      const parent = header.closest('.facet-head');
      if (parent && !parent.classList.contains('facet-xpndicon')) {
        console.log(`[Content Script] Expanding ${sectionName} section`);
        parent.click();
        await new Promise(resolve => setTimeout(resolve, 800)); // Wait for animation
      }
    }
  };

  // Apply filters in sequence with proper delays
  if (filters.brands?.length > 0) {
    await expandFilterSection('brand');
    for (const brand of filters.brands) {
      const input = document.querySelector(`input[name="brand"][value="${CSS.escape(brand.value)}"]`);
      if (input && !input.checked) {
        input.click();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  if (filters.sizes?.length > 0) {
    await expandFilterSection('size');
    for (const size of filters.sizes) {
      const input = document.querySelector(`input[name="verticalsizegroupformat"][value="${CSS.escape(size.value)}"]`);
      if (input && !input.checked) {
        input.click();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  if (filters.colors?.length > 0) {
    await expandFilterSection('color');
    for (const color of filters.colors) {
      // Try to find by exact value match first
      let input = document.querySelector(`input[name="verticalcolorfamily"][value="${CSS.escape(color.value)}"]`);
      
      // If not found by value, try to find by swatch color
      if (!input && color.swatch) {
        const colorInputs = document.querySelectorAll('input[name="verticalcolorfamily"]');
        for (const colorInput of colorInputs) {
          const swatch = colorInput.closest('.facet-linkhead')?.querySelector('.facet-checkbox-color-inner');
          if (swatch?.style.backgroundColor === color.swatch) {
            input = colorInput;
            break;
          }
        }
      }
      
      if (input && !input.checked) {
        input.click();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  // Final apply button click
  console.log("[Content Script] Looking for apply button...");
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  let applyButton = document.querySelector('.filter-apply-button');
  if (!applyButton) {
    // Sometimes the button needs to be found again after DOM updates
    applyButton = document.querySelector('.filter-apply-button');
  }
  
  if (applyButton) {
    console.log("[Content Script] Clicking apply button");
    applyButton.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
  } else {
    console.log("[Content Script] No apply button found");
  }
  
  console.log("[Content Script] Filter application complete");
}

// Reset all filters with verification
async function resetAjioFilters() {
  console.log("[Content Script] Resetting filters...");
  
  const resetFilterType = async (selector) => {
    const checkboxes = document.querySelectorAll(`${selector}:checked`);
    console.log(`[Content Script] Resetting ${checkboxes.length} ${selector} filters`);
    
    for (const checkbox of checkboxes) {
      try {
        if (checkbox.checked) {
          checkbox.click();
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Verify it was unchecked
          if (checkbox.checked) {
            console.log("[Content Script] Filter still checked, trying again");
            checkbox.click();
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      } catch (error) {
        console.error("[Content Script] Error resetting filter:", error);
      }
    }
  };
  
  await resetFilterType('input[name="brand"]');
  await resetFilterType('input[name="verticalsizegroupformat"]');
  await resetFilterType('input[name="verticalcolorfamily"]');
  
  console.log("[Content Script] Reset complete");
  await new Promise(resolve => setTimeout(resolve, 500));
}