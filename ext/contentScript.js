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
    
    // Wait for filters to reset
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Apply filters in sequence with proper delays
    if (filters.brands && filters.brands.length > 0) {
      console.log("[Content Script] Applying brand filters:", filters.brands);
      await applyBrandFilters(filters.brands, site);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (filters.sizes && filters.sizes.length > 0) {
      console.log("[Content Script] Applying size filters:", filters.sizes);
      await applySizeFilters(filters.sizes, site);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (filters.colors && filters.colors.length > 0) {
      console.log("[Content Script] Applying color filters:", filters.colors);
      await applyColorFilters(filters.colors, site);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Click apply button if needed (Ajio)
    if (site === 'ajio') {
      const applyButton = document.querySelector('.filter-apply-button');
      if (applyButton) {
        console.log("[Content Script] Clicking apply button");
        applyButton.click();
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }
    
    // Verify filters were applied with retries and reapply if needed
    let retryCount = 0;
    const maxRetries = 3;
    let missingFilters = [];
    
    while (retryCount < maxRetries) {
      try {
        // Get currently applied filters
        const appliedFilters = await getCurrentFilters();
        missingFilters = [];
        
        // Check which filters are missing
        if (filters.brands && filters.brands.length > 0) {
          for (const brand of filters.brands) {
            const brandName = typeof brand === 'string' ? brand : brand.text;
            if (!appliedFilters.brands.some(b => 
              b.toLowerCase().includes(brandName.toLowerCase()))) {
              missingFilters.push({ type: 'brand', value: brandName });
            }
          }
        }
        
        if (filters.sizes && filters.sizes.length > 0) {
          for (const size of filters.sizes) {
            const sizeValue = typeof size === 'string' ? size : size.text;
            if (!appliedFilters.sizes.some(s => 
              s.toLowerCase().includes(sizeValue.toLowerCase()))) {
              missingFilters.push({ type: 'size', value: sizeValue });
            }
          }
        }
        
        if (filters.colors && filters.colors.length > 0) {
          for (const color of filters.colors) {
            const colorValue = typeof color === 'string' ? color : color.text;
            if (!appliedFilters.colors.some(c => 
              c.toLowerCase().includes(colorValue.toLowerCase()))) {
              missingFilters.push({ type: 'color', value: colorValue });
            }
          }
        }
        
        if (missingFilters.length === 0) {
          console.log("[Content Script] All filters verified successfully");
          break;
        }
        
        console.log("[Content Script] Missing filters:", missingFilters);
        
        // Reapply missing filters
        const missingBrands = missingFilters.filter(f => f.type === 'brand').map(f => f.value);
        const missingSizes = missingFilters.filter(f => f.type === 'size').map(f => f.value);
        const missingColors = missingFilters.filter(f => f.type === 'color').map(f => f.value);
        
        if (missingBrands.length > 0) {
          console.log("[Content Script] Reapplying brand filters:", missingBrands);
          await applyBrandFilters(missingBrands, site);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        if (missingSizes.length > 0) {
          console.log("[Content Script] Reapplying size filters:", missingSizes);
          await applySizeFilters(missingSizes, site);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        if (missingColors.length > 0) {
          console.log("[Content Script] Reapplying color filters:", missingColors);
          await applyColorFilters(missingColors, site);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Click apply button again if needed (Ajio)
        if (site === 'ajio' && (missingBrands.length > 0 || missingSizes.length > 0 || missingColors.length > 0)) {
          const applyButton = document.querySelector('.filter-apply-button');
          if (applyButton) {
            console.log("[Content Script] Clicking apply button again");
            applyButton.click();
            await new Promise(resolve => setTimeout(resolve, 2500));
          }
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.warn(`[Content Script] Verification attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (missingFilters.length > 0) {
      throw new Error(`Failed to apply filters: ${missingFilters.map(f => `${f.type}: ${f.value}`).join(', ')}`);
    }
    
    console.log("[Content Script] Filter application complete");
  } catch (error) {
    console.error("[Content Script] Error in applyCrossSiteFilters:", error);
    throw error;
  }
}

// Update verifyFiltersApplied to be more lenient with matching
async function verifyFiltersApplied(filters, site) {
  console.log("[Content Script] Verifying applied filters...");
  
  // Wait for filters to be visible in the UI
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const appliedFilters = await getCurrentFilters();
  let missingFilters = [];
  
  // Helper function to check if a value is included in the applied filters
  const isFilterApplied = (value, appliedList) => {
    const normalizedValue = value.toLowerCase().trim();
    return appliedList.some(applied => 
      applied.toLowerCase().trim().includes(normalizedValue) || 
      normalizedValue.includes(applied.toLowerCase().trim())
    );
  };
  
  // Check brands
  if (filters.brands && filters.brands.length > 0) {
    for (const brand of filters.brands) {
      const brandName = typeof brand === 'string' ? brand : brand.text;
      if (!isFilterApplied(brandName, appliedFilters.brands)) {
        missingFilters.push(`Brand: ${brandName}`);
      }
    }
  }
  
  // Check sizes
  if (filters.sizes && filters.sizes.length > 0) {
    for (const size of filters.sizes) {
      const sizeValue = typeof size === 'string' ? size : size.text;
      if (!isFilterApplied(sizeValue, appliedFilters.sizes)) {
        missingFilters.push(`Size: ${sizeValue}`);
      }
    }
  }
  
  // Check colors
  if (filters.colors && filters.colors.length > 0) {
    for (const color of filters.colors) {
      const colorValue = typeof color === 'string' ? color : color.text;
      if (!isFilterApplied(colorValue, appliedFilters.colors)) {
        missingFilters.push(`Color: ${colorValue}`);
      }
    }
  }
  
  if (missingFilters.length > 0) {
    console.warn("[Content Script] Some filters were not applied:", missingFilters);
    throw new Error(`Failed to apply filters: ${missingFilters.join(', ')}`);
  }
  
  console.log("[Content Script] All filters verified successfully");
}

// Update applyBrandFilters to handle multiple brands better
async function applyBrandFilters(brands, site) {
  console.log(`[Content Script] Applying brand filters:`, brands);
  let appliedCount = 0;
  
  for (const brand of brands) {
    let brandName = typeof brand === 'string' ? brand : brand.text;
    console.log(`[Content Script] Attempting to apply brand filter: ${brandName}`);
    
    try {
      if (site === 'myntra') {
        // First try to find the brand in the filter summary
        const filterList = document.querySelector('.filter-summary-filterList');
        if (filterList) {
          const brandFilter = Array.from(filterList.querySelectorAll('.filter-summary-filter'))
            .find(filter => filter.textContent.trim() === brandName);
          
          if (brandFilter) {
            console.log("[Content Script] Brand already applied:", brandName);
            appliedCount++;
            continue;
          }
        }

        // Find and select the brand in the vertical filters
        const brandOptions = document.querySelectorAll('.brand-list label');
        let brandFound = false;
        
        for (const option of brandOptions) {
          const optionText = option.textContent.trim().toLowerCase();
          if (optionText.includes(brandName.toLowerCase())) {
            console.log("[Content Script] Found matching brand option, clicking");
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              brandFound = true;
              appliedCount++;
              // Wait for the checkbox to be checked
              await new Promise(resolve => setTimeout(resolve, 500));
              break;
            }
          }
        }
        
        if (!brandFound) {
          console.warn(`[Content Script] Brand option not found: ${brandName}`);
        }
      } 
      else if (site === 'ajio') {
        // First try to find the brand in the breadcrumb container
        const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
        if (appliedFilters) {
          const brandFilter = Array.from(appliedFilters.querySelectorAll('.fnl-plp-afliter'))
            .find(filter => filter.querySelector('.pull-left').textContent.trim() === brandName);
          
          if (brandFilter) {
            console.log("[Content Script] Brand already applied:", brandName);
            appliedCount++;
            continue;
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
                appliedCount++;
                // Wait for the checkbox to be checked
                await new Promise(resolve => setTimeout(resolve, 500));
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
    } catch (error) {
      console.error(`[Content Script] Error applying brand filter ${brandName}:`, error);
      // Continue with next brand instead of breaking
    }
  }
  
  console.log(`[Content Script] Successfully applied ${appliedCount} out of ${brands.length} brand filters`);
  return appliedCount > 0;
}

// Update applyColorFilters to handle multiple colors better
async function applyColorFilters(colors, site) {
  console.log(`[Content Script] Applying color filters:`, colors);
  let appliedCount = 0;
  
  for (const color of colors) {
    let colorValue = typeof color === 'string' ? color : color.text;
    console.log(`[Content Script] Attempting to apply color filter: ${colorValue}`);
    
    try {
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
                appliedCount++;
                await new Promise(resolve => setTimeout(resolve, 500));
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
            console.log("[Content Script] Color already applied:", colorValue);
            appliedCount++;
            continue;
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
                appliedCount++;
                await new Promise(resolve => setTimeout(resolve, 500));
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
    } catch (error) {
      console.error(`[Content Script] Error applying color filter ${colorValue}:`, error);
      // Continue with next color instead of breaking
    }
  }
  
  console.log(`[Content Script] Successfully applied ${appliedCount} out of ${colors.length} color filters`);
  return appliedCount > 0;
}

// Update applySizeFilters to handle multiple sizes better
async function applySizeFilters(sizes, site) {
  console.log(`[Content Script] Applying size filters:`, sizes);
  let appliedCount = 0;
  
  for (const size of sizes) {
    let sizeValue = typeof size === 'string' ? size : size.text;
    console.log(`[Content Script] Attempting to apply size filter: ${sizeValue}`);
    
    try {
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
                appliedCount++;
                await new Promise(resolve => setTimeout(resolve, 500));
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
            console.log("[Content Script] Size already applied:", sizeValue);
            appliedCount++;
            continue;
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
                appliedCount++;
                await new Promise(resolve => setTimeout(resolve, 500));
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
    } catch (error) {
      console.error(`[Content Script] Error applying size filter ${sizeValue}:`, error);
      // Continue with next size instead of breaking
    }
  }
  
  console.log(`[Content Script] Successfully applied ${appliedCount} out of ${sizes.length} size filters`);
  return appliedCount > 0;
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
      
      if (filterType === 'Brand') {
        // For brand filters, get the text content
        const brandText = item.textContent.trim();
        if (brandText) {
          filters.brands.push(brandText);
        }
      } else if (filterType === 'Color') {
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

  // Also check for brand filters in the vertical filters
  const brandCheckboxes = document.querySelectorAll('.brand-list input[type="checkbox"]:checked');
  for (const checkbox of brandCheckboxes) {
    const brandText = checkbox.value;
    if (brandText && !filters.brands.includes(brandText)) {
      filters.brands.push(brandText);
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
      const filterType = item.querySelector('.fnl-plp-afliter-type')?.textContent.trim().toLowerCase();
      
      // Use the filter type if available, otherwise try to determine from text
      if (filterType) {
        if (filterType.includes('brand')) {
          filters.brands.push(filterText);
        } else if (filterType.includes('color')) {
          filters.colors.push(filterText);
        } else if (filterType.includes('size')) {
          filters.sizes.push(filterText);
        }
      } else {
        // Fallback to text-based detection
        if (filterText.match(/^(XS|S|M|L|XL|XXL|\d+)$/i)) {
          filters.sizes.push(filterText);
        } else if (filterText.match(/^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Navy|Maroon|Olive|Teal|Cyan|Magenta|Gold|Silver|Bronze|Multi|Printed|Striped|Floral|Geometric|Abstract|Animal Print|Camouflage|Tie & Dye|Ombre|Metallic|Glitter|Holographic|Neon|Pastel|Vintage|Washed|Faded|Distressed|Embellished|Sequined|Beaded|Quilted|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace)$/i)) {
          filters.colors.push(filterText);
        } else {
          // Assume it's a brand if it doesn't match size or color patterns
          filters.brands.push(filterText);
        }
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