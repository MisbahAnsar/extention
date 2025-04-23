// Message listener for popup communication
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("[Content Script] Received message:", request.action);
  
  if (request.action === "ping") {
    console.log("[Content Script] Ping received, sending pong");
    sendResponse({status: "connected"});
    return true;
  }
  
  if (request.action === "getCurrentFilters") {
    console.log("[Content Script] Getting current filters...");
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
      console.log("[Content Script] Filters applied successfully");
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
    // Wait for the page to be fully loaded
    if (document.readyState !== 'complete') {
      await new Promise(resolve => {
        window.addEventListener('load', resolve);
      });
    }

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
    console.log("[Content Script] Starting to apply filters:", filters);
    
    // Wait for the page to be fully loaded
    if (document.readyState !== 'complete') {
      console.log("[Content Script] Waiting for page to load...");
      await new Promise(resolve => {
        window.addEventListener('load', resolve);
      });
    }

    // Wait for filter elements to be available
    console.log("[Content Script] Waiting for filter elements...");
    await waitForElements(20, 1000);

    if (hostname.includes('myntra.com')) {
      console.log("[Content Script] Applying filters on Myntra");
      await applyCrossSiteFilters(filters, 'myntra');
    } else if (hostname.includes('ajio.com')) {
      console.log("[Content Script] Applying filters on Ajio");
      await applyCrossSiteFilters(filters, 'ajio');
    }
    
    console.log("[Content Script] Filters applied successfully");
  } catch (error) {
    console.error("[Content Script] Error in applyFilters:", error);
    throw error;
  }
}

// Wait for necessary elements to be available
async function waitForElements(maxAttempts = 10, delay = 500) {
  const hostname = window.location.hostname;
  let attempts = 0;

  while (attempts < maxAttempts) {
    console.log(`[Content Script] Waiting for elements (attempt ${attempts + 1}/${maxAttempts})`);
    
    if (hostname.includes('myntra.com')) {
      const filterSummary = document.querySelector('.filter-summary-filterList');
      const horizontalFilters = document.querySelector('.atsa-filters');
      const filterValues = document.querySelector('.atsa-values');
      
      if (filterSummary || horizontalFilters || filterValues) {
        console.log("[Content Script] Found Myntra filter elements");
        return true;
      }
    } else if (hostname.includes('ajio.com')) {
      // Check for both types of filter elements in Ajio
      const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
      const facetList = document.querySelector('.cat-facets');
      const breadcrumbContainer = document.querySelector('#breadcrumb-container');
      
      if (appliedFilters || facetList || breadcrumbContainer) {
        console.log("[Content Script] Found Ajio filter elements");
        return true;
      }
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Required elements not found on the page');
}

// Unified filter application that works across sites
async function applyCrossSiteFilters(filters, site) {
  console.log(`[Content Script] Applying cross-site filters to ${site}`);
  
  try {
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
  } catch (error) {
    console.error("[Content Script] Error in applyCrossSiteFilters:", error);
    throw error;
  }
}

// Generic brand filter application
async function applyBrandFilters(brands, site) {
  for (const brand of brands) {
    let brandName = typeof brand === 'string' ? brand : brand.text;
    console.log(`[Content Script] Applying brand filter: ${brandName}`);
    
    if (site === 'myntra') {
      // Find and click the brand filter in the horizontal filters
      const brandFilter = document.querySelector('.atsa-filters li label input[value="Brand"]');
      if (brandFilter) {
        console.log("[Content Script] Found brand filter, clicking to expand");
        brandFilter.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Find and select the brand in the filter options
        const brandOptions = document.querySelectorAll('.atsa-values label');
        let brandFound = false;
        
        for (const option of brandOptions) {
          const optionText = option.textContent.trim().toLowerCase();
          if (optionText === brandName.toLowerCase()) {
            console.log("[Content Script] Found matching brand option, clicking");
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              brandFound = true;
              await new Promise(resolve => setTimeout(resolve, 300));
              break;
            }
          }
        }
        
        if (!brandFound) {
          console.warn(`[Content Script] Brand option not found: ${brandName}`);
        }
      } else {
        console.warn("[Content Script] Brand filter not found in horizontal filters");
      }
    } 
    else if (site === 'ajio') {
      // First try to find the brand in the breadcrumb container
      const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
      if (appliedFilters) {
        const brandFilter = Array.from(appliedFilters.querySelectorAll('.fnl-plp-afliter'))
          .find(filter => filter.querySelector('.pull-left').textContent.trim() === brandName);
        
        if (brandFilter) {
          console.log("[Content Script] Found brand in applied filters");
          continue; // Brand already applied
        }
      }

      // If not found in breadcrumb, try to apply through facet list
      const brandFacet = document.querySelector('.cat-facets .facet-left-pane-label[aria-label="brands"]');
      if (brandFacet) {
        console.log("[Content Script] Found brand facet, clicking to expand");
        brandFacet.closest('.facet-head').click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Find and select the brand in the facet list
        const brandOptions = document.querySelectorAll('.facet-linkname-brand');
        let brandFound = false;
        
        for (const option of brandOptions) {
          const optionText = option.textContent.trim().toLowerCase();
          if (optionText.includes(brandName.toLowerCase())) {
            console.log("[Content Script] Found matching brand option, clicking");
            const checkbox = option.closest('.facet-linkfref').querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              brandFound = true;
              await new Promise(resolve => setTimeout(resolve, 300));
              break;
            }
          }
        }
        
        if (!brandFound) {
          console.warn(`[Content Script] Brand option not found: ${brandName}`);
        }
      } else {
        console.warn("[Content Script] Brand facet not found");
      }
    }
  }
}

// Generic color filter application
async function applyColorFilters(colors, site) {
  for (const color of colors) {
    let colorValue = typeof color === 'string' ? color : color.text;
    console.log(`[Content Script] Applying color filter: ${colorValue}`);
    
    if (site === 'myntra') {
      // Find and click the color filter in the vertical filters
      const colorFilter = document.querySelector('.vertical-filters-filters .vertical-filters-header');
      if (colorFilter) {
        console.log("[Content Script] Found color filter");
        
        // Find and select the color in the filter options
        const colorOptions = document.querySelectorAll('.colour-listItem label');
        let colorFound = false;
        
        for (const option of colorOptions) {
          const optionText = option.textContent.trim().toLowerCase();
          if (optionText.includes(colorValue.toLowerCase())) {
            console.log("[Content Script] Found matching color option, clicking");
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              colorFound = true;
              await new Promise(resolve => setTimeout(resolve, 300));
              break;
            }
          }
        }
        
        if (!colorFound) {
          console.warn(`[Content Script] Color option not found: ${colorValue}`);
        }
      } else {
        console.warn("[Content Script] Color filter not found in vertical filters");
      }
    } 
    else if (site === 'ajio') {
      // First try to find the color in the breadcrumb container
      const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
      if (appliedFilters) {
        const colorFilter = Array.from(appliedFilters.querySelectorAll('.fnl-plp-afliter'))
          .find(filter => filter.querySelector('.pull-left').textContent.trim() === colorValue);
        
        if (colorFilter) {
          console.log("[Content Script] Found color in applied filters");
          continue; // Color already applied
        }
      }

      // If not found in breadcrumb, try to apply through facet list
      const colorFacet = document.querySelector('.cat-facets .facet-left-pane-label[aria-label="colors"]');
      if (colorFacet) {
        console.log("[Content Script] Found color facet, clicking to expand");
        colorFacet.closest('.facet-head').click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Find and select the color in the facet list
        const colorOptions = document.querySelectorAll('.facet-linkname-verticalcolorfamily');
        let colorFound = false;
        
        for (const option of colorOptions) {
          const optionText = option.textContent.trim().toLowerCase();
          if (optionText.includes(colorValue.toLowerCase())) {
            console.log("[Content Script] Found matching color option, clicking");
            const checkbox = option.closest('.facet-linkfref').querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              colorFound = true;
              await new Promise(resolve => setTimeout(resolve, 300));
              break;
            }
          }
        }
        
        if (!colorFound) {
          console.warn(`[Content Script] Color option not found: ${colorValue}`);
        }
      } else {
        console.warn("[Content Script] Color facet not found");
      }
    }
  }
}

// Generic size filter application
async function applySizeFilters(sizes, site) {
  for (const size of sizes) {
    let sizeValue = typeof size === 'string' ? size : size.text;
    console.log(`[Content Script] Applying size filter: ${sizeValue}`);
    
    if (site === 'myntra') {
      // Find and click the size filter in the horizontal filters
      const sizeFilter = document.querySelector('.atsa-filters li label input[value="size_facet"]');
      if (sizeFilter) {
        console.log("[Content Script] Found size filter, clicking to expand");
        sizeFilter.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Find and select the size in the filter options
        const sizeOptions = document.querySelectorAll('.atsa-values label');
        let sizeFound = false;
        
        for (const option of sizeOptions) {
          const optionText = option.textContent.trim().toLowerCase();
          if (optionText === sizeValue.toLowerCase()) {
            console.log("[Content Script] Found matching size option, clicking");
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              sizeFound = true;
              await new Promise(resolve => setTimeout(resolve, 300));
              break;
            }
          }
        }
        
        if (!sizeFound) {
          console.warn(`[Content Script] Size option not found: ${sizeValue}`);
        }
      } else {
        console.warn("[Content Script] Size filter not found in horizontal filters");
      }
    } 
    else if (site === 'ajio') {
      // First try to find the size in the breadcrumb container
      const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
      if (appliedFilters) {
        const sizeFilter = Array.from(appliedFilters.querySelectorAll('.fnl-plp-afliter'))
          .find(filter => filter.querySelector('.pull-left').textContent.trim() === sizeValue);
        
        if (sizeFilter) {
          console.log("[Content Script] Found size in applied filters");
          continue; // Size already applied
        }
      }

      // If not found in breadcrumb, try to apply through facet list
      const sizeFacet = document.querySelector('.cat-facets .facet-left-pane-label[aria-label="size & fit"]');
      if (sizeFacet) {
        console.log("[Content Script] Found size facet, clicking to expand");
        sizeFacet.closest('.facet-head').click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Find and select the size in the facet list
        const sizeOptions = document.querySelectorAll('.facet-linkname-verticalsizegroupformat');
        let sizeFound = false;
        
        for (const option of sizeOptions) {
          const optionText = option.textContent.trim().toLowerCase();
          if (optionText.includes(sizeValue.toLowerCase())) {
            console.log("[Content Script] Found matching size option, clicking");
            const checkbox = option.closest('.facet-linkfref').querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              sizeFound = true;
              await new Promise(resolve => setTimeout(resolve, 300));
              break;
            }
          }
        }
        
        if (!sizeFound) {
          console.warn(`[Content Script] Size option not found: ${sizeValue}`);
        }
      } else {
        console.warn("[Content Script] Size facet not found");
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

  // Get selected filters from the filter summary container
  const filterList = document.querySelector('.filter-summary-filterList');
  if (filterList) {
    const filterItems = filterList.querySelectorAll('.filter-summary-filter');
    for (const item of filterItems) {
      const filterInput = item.querySelector('input[type="checkbox"]');
      const filterType = filterInput?.dataset.group;
      
      if (filterType === 'Color') {
        // For color filters, get the text after the color box
        const colorText = item.querySelector('span:not(.filter-summary-colourBox)')?.textContent.trim();
        if (colorText) {
          filters.colors.push(colorText);
        }
      } else if (filterType === 'size_facet') {
        // For size filters, get the text content excluding the remove icon
        const sizeText = Array.from(item.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent.trim())
          .join('')
          .trim();
        if (sizeText) {
          filters.sizes.push(sizeText);
        }
      }
    }
  }

  // Also check for size filters in the horizontal filters
  const sizeFilter = document.querySelector('.atsa-filters li label input[value="size_facet"]');
  if (sizeFilter) {
    sizeFilter.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const sizeOptions = document.querySelectorAll('.atsa-values label input[type="checkbox"]:checked');
    for (const option of sizeOptions) {
      const sizeText = option.closest('label')?.textContent.trim();
      if (sizeText && !filters.sizes.includes(sizeText)) {
        filters.sizes.push(sizeText);
      }
    }
  }

  console.log("[Content Script] Extracted Myntra filters:", filters);
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
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  // Get selected filters from the breadcrumb container
  const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
  if (appliedFilters) {
    const filterItems = appliedFilters.querySelectorAll('.fnl-plp-afliter');
    for (const item of filterItems) {
      const filterText = item.querySelector('.pull-left').textContent.trim();
      
      // Determine filter type based on the text
      if (filterText.match(/^(XS|S|M|L|XL|XXL|\d+)$/i)) {
        filters.sizes.push(filterText);
      } else if (filterText.match(/^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange)$/i)) {
        filters.colors.push(filterText);
      } else {
        // Assume it's a brand if it doesn't match size or color patterns
        filters.brands.push(filterText);
      }
    }
  }

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