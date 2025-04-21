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
      await applyCrossSiteFilters(filters, 'myntra');
    } else if (hostname.includes('ajio.com')) {
      await applyCrossSiteFilters(filters, 'ajio');
    }
  } catch (error) {
    console.error("Error in applyFilters:", error);
    throw error;
  }
}

// Unified filter application that works across sites
async function applyCrossSiteFilters(filters, site) {
  console.log(`[Content Script] Applying cross-site filters to ${site}`);
  
  // First reset all filters
  if (site === 'ajio') {
    await resetAjioFilters();
  } else if (site === 'myntra') {
    await resetMyntraFilters();
  }
  
  // Apply brand filters
  if (filters.brands && filters.brands.length > 0) {
    console.log("[Content Script] Applying brand filters:", filters.brands);
    await applyBrandFilters(filters.brands, site);
  }
  
  // Apply size filters
  if (filters.sizes && filters.sizes.length > 0) {
    console.log("[Content Script] Applying size filters:", filters.sizes);
    await applySizeFilters(filters.sizes, site);
  }
  
  // Apply color filters
  if (filters.colors && filters.colors.length > 0) {
    console.log("[Content Script] Applying color filters:", filters.colors);
    await applyColorFilters(filters.colors, site);
  }
  
  // Click apply button if needed (Ajio)
  if (site === 'ajio') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const applyButton = document.querySelector('.filter-apply-button');
    if (applyButton) {
      console.log("[Content Script] Clicking apply button");
      applyButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  console.log("[Content Script] Filter application complete");
}

// Generic brand filter application
async function applyBrandFilters(brands, site) {
  for (const brand of brands) {
    let brandName = typeof brand === 'string' ? brand : brand.text;
    
    if (site === 'myntra') {
      const labels = document.querySelectorAll('.brand-list label');
      for (const label of labels) {
        const labelText = label.textContent
          .replace(/\(\d+\)$/, '')
          .trim();
        
        if (labelText.toLowerCase().includes(brandName.toLowerCase())) {
          const checkbox = label.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            await new Promise(resolve => setTimeout(resolve, 200));
            break;
          }
        }
      }
    } 
    else if (site === 'ajio') {
      const inputs = document.querySelectorAll('input[name="brand"]');
      for (const input of inputs) {
        const label = input.closest('.facet-linkhead')?.querySelector('.facet-linkname');
        if (label) {
          const labelText = label.textContent
            .replace(/\(\d+\)$/, '')
            .trim();
          
          if (labelText.toLowerCase().includes(brandName.toLowerCase())) {
            if (!input.checked) {
              input.click();
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            break;
          }
        }
      }
    }
  }
}

// Generic size filter application
async function applySizeFilters(sizes, site) {
  for (const size of sizes) {
    let sizeValue = typeof size === 'string' ? size : size.text;
    
    if (site === 'myntra') {
      const sizeContainer = document.querySelector('.size-container');
      if (sizeContainer) {
        const labels = document.querySelectorAll('.size-list label');
        for (const label of labels) {
          const labelText = label.textContent
            .replace(/\(\d+\)$/, '')
            .trim();
          
          if (labelText.toLowerCase().includes(sizeValue.toLowerCase())) {
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              await new Promise(resolve => setTimeout(resolve, 200));
              break;
            }
          }
        }
      }
    } 
    else if (site === 'ajio') {
      const inputs = document.querySelectorAll('input[name="verticalsizegroupformat"]');
      for (const input of inputs) {
        const label = input.closest('.facet-linkhead')?.querySelector('.facet-linkname');
        if (label) {
          const labelText = label.textContent
            .replace(/\(\d+\)$/, '')
            .trim();
          
          if (labelText.toLowerCase().includes(sizeValue.toLowerCase())) {
            if (!input.checked) {
              input.click();
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            break;
          }
        }
      }
    }
  }
}

// Generic color filter application
async function applyColorFilters(colors, site) {
  for (const color of colors) {
    let colorValue = typeof color === 'string' ? color : color.text;
    let colorSwatch = color.swatch;
    
    if (site === 'myntra') {
      const labels = document.querySelectorAll('.colour-listItem label');
      for (const label of labels) {
        const labelText = label.textContent
          .replace(/\(\d+\)$/, '')
          .trim();
        
        if (labelText.toLowerCase().includes(colorValue.toLowerCase())) {
          const checkbox = label.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            await new Promise(resolve => setTimeout(resolve, 200));
            break;
          }
        }
      }
    } 
    else if (site === 'ajio') {
      // Try to find by text first
      let input = null;
      const inputs = document.querySelectorAll('input[name="verticalcolorfamily"]');
      
      for (const colorInput of inputs) {
        const label = colorInput.closest('.facet-linkhead')?.querySelector('.facet-linkname');
        if (label) {
          const labelText = label.textContent
            .replace(/\(\d+\)$/, '')
            .trim();
          
          if (labelText.toLowerCase().includes(colorValue.toLowerCase())) {
            input = colorInput;
            break;
          }
        }
      }
      
      // If not found by text, try by swatch color
      if (!input && colorSwatch) {
        for (const colorInput of inputs) {
          const swatch = colorInput.closest('.facet-linkhead')?.querySelector('.facet-checkbox-color-inner');
          if (swatch?.style.backgroundColor === colorSwatch) {
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
}

// Myntra-specific functions
async function getMyntraFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };
  
  // Get selected brands
  const brandCheckboxes = document.querySelectorAll('.brand-list input[type="checkbox"]:checked');
  brandCheckboxes.forEach(checkbox => {
    const brandName = checkbox.parentElement.textContent
      .replace(/\(\d+\)$/, '')
      .trim();
    if (brandName) filters.brands.push(brandName);
  });
  
  // Get selected sizes (if size filter exists)
  const sizeCheckboxes = document.querySelectorAll('.size-list input[type="checkbox"]:checked');
  if (sizeCheckboxes.length > 0) {
    sizeCheckboxes.forEach(checkbox => {
      const size = checkbox.parentElement.textContent
        .replace(/\(\d+\)$/, '')
        .trim();
      if (size) filters.sizes.push(size);
    });
  }
  
  // Get selected colors
  const colorCheckboxes = document.querySelectorAll('.colour-listItem input[type="checkbox"]:checked');
  colorCheckboxes.forEach(checkbox => {
    const color = checkbox.parentElement.textContent
      .replace(/\(\d+\)$/, '')
      .trim();
    if (color) filters.colors.push(color);
  });
  
  return filters;
}

async function resetMyntraFilters() {
  console.log("[Content Script] Resetting Myntra filters...");
  
  // Reset brands
  const brandCheckboxes = document.querySelectorAll('.brand-list input[type="checkbox"]:checked');
  for (const checkbox of brandCheckboxes) {
    if (checkbox.checked) {
      checkbox.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Reset sizes (if exists)
  const sizeCheckboxes = document.querySelectorAll('.size-list input[type="checkbox"]:checked');
  for (const checkbox of sizeCheckboxes) {
    if (checkbox.checked) {
      checkbox.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Reset colors
  const colorCheckboxes = document.querySelectorAll('.colour-listItem input[type="checkbox"]:checked');
  for (const checkbox of colorCheckboxes) {
    if (checkbox.checked) {
      checkbox.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    }
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

async function resetAjioFilters() {
  console.log("[Content Script] Resetting Ajio filters...");
  
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