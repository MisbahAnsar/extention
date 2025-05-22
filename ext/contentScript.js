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
    
    // Set a timeout to prevent message channel from closing
    let responseSent = false;
    let responseTimeout = setTimeout(() => {
      if (!responseSent) {
        console.log("[Content Script] Sending timeout response for getCurrentFilters");
        responseSent = true;
        sendResponse({filters: null, error: "Timeout getting filters, please try again"});
      }
    }, 20000); // 20 second timeout
    
    getCurrentFilters().then(filters => {
      clearTimeout(responseTimeout);
      if (!responseSent) {
        console.log("[Content Script] Sending filters to popup:", JSON.stringify(filters, null, 2));
        responseSent = true;
        sendResponse({
          filters: {
            url: window.location.href,
            data: filters
          }
        });
      }
    }).catch(error => {
      clearTimeout(responseTimeout);
      if (!responseSent) {
        console.error("[Content Script] Error getting filters:", error);
        responseSent = true;
        sendResponse({filters: null, error: error.message});
      }
    });
    
    return true;
  } 
  else if (request.action === "applyFilters") {
    console.log("[Content Script] Applying filters:", JSON.stringify(request.filters, null, 2));
    
    // Set a timeout to ensure response is sent before message channel closes
    let responseSent = false;
    let responseTimeout = setTimeout(() => {
      if (!responseSent) {
        console.log("[Content Script] Sending timeout response to prevent channel closing");
        responseSent = true;
        sendResponse({success: false, error: "Operation taking too long, continuing in background"});
      }
    }, 20000); // 20 second timeout
    
    // Process the request
    applyFilters(request.filters)
      .then((result) => {
        clearTimeout(responseTimeout);
        if (!responseSent) {
          console.log("[Content Script] Filters applied successfully", result);
          responseSent = true;
          sendResponse({success: true, result: result});
        }
      })
      .catch(error => {
        clearTimeout(responseTimeout);
        if (!responseSent) {
          console.error("[Content Script] Error applying filters:", error);
          responseSent = true;
          sendResponse({success: false, error: error.message});
        }
      });
    
    return true;
  }
});

// Amazon.in-specific functions
async function getAmazonFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  // Get selected brands
  const brandLinks = document.querySelectorAll('#filter-p_123 .a-link-normal.s-navigation-item');
  for (const link of brandLinks) {
    const checkbox = link.querySelector('input[type="checkbox"]');
    if (checkbox && checkbox.checked) {
      const brandText = link.querySelector('.a-size-base.a-color-base')?.textContent.trim();
      if (brandText) {
        filters.brands.push(brandText);
      }
    }
  }

  // Get selected sizes
  const sizeLinks = document.querySelectorAll('#filter-p_n_size_browse-vebin .a-link-normal.s-navigation-item');
  for (const link of sizeLinks) {
    if (link.getAttribute('aria-current') === 'true') {
      const sizeText = link.querySelector('.a-size-base.a-color-base')?.textContent.trim();
      if (sizeText) {
        filters.sizes.push(sizeText);
      }
    }
  }

  // Get selected colors
  const colorLinks = document.querySelectorAll('#filter-p_n_size_two_browse-vebin .a-link-normal.s-navigation-item');
  for (const link of colorLinks) {
    const colorText = link.getAttribute('title');
    if (colorText && link.getAttribute('aria-current') === 'true') {
      filters.colors.push(colorText);
    }
  }

  console.log("[Content Script] Extracted Amazon filters:", filters);
  return filters;
}

// Get current filters from the page
async function getCurrentFilters() {
  const hostname = window.location.hostname;
  let filters = {
    brands: [],
    sizes: [],
    colors: []
  };
  
  try {
    console.log("[Content Script] Getting current filters from", hostname);
    
    // Wait for the page to be fully loaded
    if (document.readyState !== 'complete') {
      console.log("[Content Script] Waiting for page to load completely...");
      await new Promise(resolve => {
        window.addEventListener('load', resolve);
      });
    }

    // Give additional time for filter elements to be rendered
    console.log("[Content Script] Waiting for filter elements to render...");
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Attempt to get filters based on the hostname
    try {
      if (hostname.includes('myntra.com')) {
        filters = await getMyntraFilters();
      } else if (hostname.includes('ajio.com')) {
        filters = await getAjioFilters();
      } else if (hostname.includes('amazon.in')) {
        filters = await getAmazonFilters();
      } else if (hostname.includes('flipkart.com')) {
        filters = await getFlipkartFilters();
      } else if (hostname.includes('snapdeal.com')) {
        filters = await getSnapdealFilters();
      } else if (hostname.includes('nykaa.com')) {
        filters = await getNykaaFilters();
      }
    } catch (firstError) {
      console.warn("[Content Script] First attempt to get filters failed:", firstError);
      
      // Wait longer and try again one more time
      console.log("[Content Script] Waiting longer and trying again...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (hostname.includes('myntra.com')) {
        filters = await getMyntraFilters();
      } else if (hostname.includes('ajio.com')) {
        filters = await getAjioFilters();
      } else if (hostname.includes('amazon.in')) {
        filters = await getAmazonFilters();
      } else if (hostname.includes('flipkart.com')) {
        filters = await getFlipkartFilters();
      } else if (hostname.includes('snapdeal.com')) {
        filters = await getSnapdealFilters();
      } else if (hostname.includes('nykaa.com')) {
        filters = await getNykaaFilters();
      }
    }

    console.log("[Content Script] Successfully retrieved filters:", filters);
  } catch (error) {
    console.error("[Content Script] Error in getCurrentFilters:", error);
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

    // Wait longer for filter elements to be available
    console.log("[Content Script] Waiting for filter elements...");
    await waitForElements(30, 2000); // Increased attempts and delay

    // Normalize filters to handle different input formats
    const normalizedFilters = {
      brands: Array.isArray(filters.brands) ? filters.brands : [],
      sizes: Array.isArray(filters.sizes) ? filters.sizes : [],
      colors: Array.isArray(filters.colors) ? filters.colors : [],
      originSite: filters.originSite || null
    };

    let result;
    if (hostname.includes('myntra.com')) {
      console.log("[Content Script] Applying filters on Myntra");
      result = await applyCrossSiteFilters(normalizedFilters, 'myntra');
    } else if (hostname.includes('ajio.com')) {
      console.log("[Content Script] Applying filters on Ajio");
      result = await applyCrossSiteFilters(normalizedFilters, 'ajio');
    } else if (hostname.includes('amazon.in')) {
      console.log("[Content Script] Applying filters on Amazon");
      result = await applyAmazonFilters(normalizedFilters);
    } else if (hostname.includes('flipkart.com')) {
      console.log("[Content Script] Applying filters on Flipkart");
      result = await applyFlipkartFilters(normalizedFilters);
    } else if (hostname.includes('snapdeal.com')) {
      console.log("[Content Script] Applying filters on Snapdeal");
      result = await applySnapdealFilters(normalizedFilters);
    } else if (hostname.includes('nykaa.com')) {
      console.log("[Content Script] Applying filters on Nykaa");
      result = await applyNykaaFilters(normalizedFilters);
    }
    
    // Return success even if some filters couldn't be applied
    return { 
      success: true,
      result: result,
      partialSuccess: result?.partialSuccess || false
    };
  } catch (error) {
    console.error("[Content Script] Error in applyFilters:", error);
    // Return a more informative error response
    return {
      success: false,
      error: error.message,
      partialSuccess: false
    };
  }
}

// Wait for necessary elements to be available
async function waitForElements(maxAttempts = 10, delay = 1000) {
  const hostname = window.location.hostname;
  let attempts = 0;
  
  // For Flipkart, use a more aggressive approach with fewer attempts
  if (hostname.includes('flipkart.com')) {
    maxAttempts = 5; // Reduce max attempts for Flipkart
    delay = 500; // Reduce delay between attempts
    
    while (attempts < maxAttempts) {
      console.log(`[Content Script] Checking for Flipkart elements (attempt ${attempts + 1}/${maxAttempts})`);
      
      // Check for any of these selectors to indicate filters are ready
      const filterIndicators = [
        'section[class*="pgRLLn"]', // Applied filters section
        'section[class*="-5qqlC"]', // Filter sections
        '.aOfogh', // Clear all button
        '.filter-summary-filter' // Filter summary
      ];
      
      for (const selector of filterIndicators) {
        const element = document.querySelector(selector);
        if (element) {
          console.log(`[Content Script] Found Flipkart filter elements (${selector})`);
          // Give a small delay for other elements to load
          await new Promise(resolve => setTimeout(resolve, 500));
          return true;
        }
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.warn("[Content Script] Could not find Flipkart filter elements after", maxAttempts, "attempts");
    // Return true anyway for Flipkart to attempt filter application
    return true;
  }
  
  // Original logic for other sites
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
      const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
      const facetList = document.querySelector('.cat-facets');
      const breadcrumbContainer = document.querySelector('#breadcrumb-container');
      
      if (appliedFilters || facetList || breadcrumbContainer) {
        console.log("[Content Script] Found Ajio filter elements");
        return true;
      }
    } else if (hostname.includes('amazon.in')) {
      const brandFilters = document.querySelector('#filter-p_123');
      const colorFilters = document.querySelector('#filter-p_n_size_two_browse-vebin');
      
      if (brandFilters || colorFilters) {
        console.log("[Content Script] Found Amazon filter elements");
        return true;
      }
    } else if (hostname.includes('snapdeal.com')) {
      const filterSections = document.querySelectorAll('.filter-section');
      
      if (filterSections.length > 0) {
        console.log("[Content Script] Found Snapdeal filter sections:", filterSections.length);
        return true;
      }
    } else if (hostname.includes('nykaa.com')) {
      const brandFilter = document.querySelector('#first-filter');
      const filterSections = document.querySelectorAll('div[class="css-w2222k"]');
      const appliedFilters = document.querySelector('.css-19j3ean');
      
      if (brandFilter || filterSections.length > 0 || appliedFilters) {
        console.log("[Content Script] Found Nykaa filter elements");
        return true;
      }
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.warn("[Content Script] Could not find filter elements after", maxAttempts, "attempts");
  return false;
}

// Unified filter application that works across sites
async function applyCrossSiteFilters(filters, site) {
  console.log(`[Content Script] Applying cross-site filters for ${site}:`, filters);
  
  try {
    // Wait for filter elements to be present
    const elementsFound = await waitForElements();
    if (!elementsFound) {
      throw new Error('Filter elements not found on the page');
    }
    
    let result;
    
    // Apply filters based on the site
    if (site === 'myntra') {
      result = await applyMyntraFilters(filters);
    } else if (site === 'ajio') {
      result = await applyAjioFilters(filters);
    } else if (site === 'amazon') {
      result = await applyAmazonFilters(filters);
    } else if (site === 'flipkart') {
      result = await applyFlipkartFilters(filters);
    } else if (site === 'snapdeal') {
      result = await applySnapdealFilters(filters);
    } else if (site === 'nykaa') {
      result = await applyNykaaFilters(filters);
    } else {
      throw new Error(`Unsupported site: ${site}`);
    }
    
    // Verify filters were applied correctly
    const success = await verifyFiltersApplied(filters, site);
    if (!success && !result.partialSuccess) {
      throw new Error('Failed to verify all filters were applied correctly');
    }
    
    console.log(`[Content Script] Successfully applied filters on ${site}`);
    return result;
  } catch (error) {
    console.error(`[Content Script] Error applying filters on ${site}:`, error);
    throw error;
  }
}

// Update verifyFiltersApplied to be more lenient
async function verifyFiltersApplied(filters, site) {
  console.log("[Content Script] Verifying applied filters...");
  
  // Wait longer for filters to be visible in the UI
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    const appliedFilters = await getCurrentFilters();
    let appliedCount = 0;
    let totalFilters = 0;
    
    // Helper function to check if a value is included in the applied filters
    const isFilterApplied = (value, appliedList) => {
      if (!value || !appliedList) return false;
      const normalizedValue = value.toLowerCase().trim();
      return appliedList.some(applied => {
        const appliedText = (typeof applied === 'string' ? applied : applied.text || applied.value || '').toLowerCase().trim();
        return appliedText.includes(normalizedValue) || 
               normalizedValue.includes(appliedText) ||
               // Check for similar words
               normalizedValue.split(' ').some(word => 
                 appliedText.includes(word) && word.length > 3
               );
      });
    };
    
    // Check brands
    if (filters.brands && filters.brands.length > 0) {
      totalFilters += filters.brands.length;
      for (const brand of filters.brands) {
        const brandName = typeof brand === 'string' ? brand : brand.text;
        if (isFilterApplied(brandName, appliedFilters.brands)) {
          appliedCount++;
        }
      }
    }
    
    // Check sizes
    if (filters.sizes && filters.sizes.length > 0) {
      totalFilters += filters.sizes.length;
      for (const size of filters.sizes) {
        const sizeValue = typeof size === 'string' ? size : size.text;
        if (isFilterApplied(sizeValue, appliedFilters.sizes)) {
          appliedCount++;
        }
      }
    }
    
    // Check colors
    if (filters.colors && filters.colors.length > 0) {
      totalFilters += filters.colors.length;
      for (const color of filters.colors) {
        const colorValue = typeof color === 'string' ? color : color.text;
        if (isFilterApplied(colorValue, appliedFilters.colors)) {
          appliedCount++;
        }
      }
    }
    
    // Consider it successful if at least 50% of filters were applied
    const successRate = totalFilters > 0 ? appliedCount / totalFilters : 1;
    console.log(`[Content Script] Filter application success rate: ${(successRate * 100).toFixed(1)}%`);
    
    return successRate >= 0.5;
  } catch (error) {
    console.error("[Content Script] Error verifying filters:", error);
    // Return true to avoid blocking the process on verification errors
    return true;
  }
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

        // Try to find and click the color facet to open the modal
        const colorFacet = document.querySelector('.cat-facets .facet-left-pane-label[aria-label="colors"]');
        if (colorFacet) {
          console.log("[Content Script] Found color facet, clicking to expand");
          colorFacet.closest('.facet-head').click();
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Look for the color in the modal
          const colorModal = document.querySelector('.more-popup-container');
          if (colorModal) {
            console.log("[Content Script] Found color modal");
            
            // Find the color checkbox in the modal
            const colorCheckbox = Array.from(colorModal.querySelectorAll('input[name="verticalcolorfamily"]'))
              .find(input => {
                const label = input.closest('label');
                const colorName = label.querySelector('.facet-list-title-name')?.textContent.trim();
                return colorName && colorName.toLowerCase() === colorValue.toLowerCase();
              });

            if (colorCheckbox) {
              console.log(`[Content Script] Found color checkbox for: ${colorValue}`);
              
              // Click the checkbox if not already checked
              if (!colorCheckbox.checked) {
                colorCheckbox.click();
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Click the Apply button in the modal
                const applyButton = colorModal.querySelector('.apply-popup-button');
                if (applyButton) {
                  console.log("[Content Script] Clicking Apply button in color modal");
                  applyButton.click();
                  appliedCount++;
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } else {
                console.log(`[Content Script] Color ${colorValue} already checked`);
                appliedCount++;
              }
            } else {
              console.warn(`[Content Script] Color option not found in modal: ${colorValue}`);
            }
          } else {
            // If modal not found, try the regular color options
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

  try {
    console.log("[Content Script] Getting Ajio filters");

    // Helper function to determine if a text is a size
    const isSize = (text) => {
      // Match UK sizes
      if (text.match(/^UK \d+$/i)) return true;
      // Match standard letter sizes (S, M, L, XL, XXL, etc.)
      if (text.match(/^(XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)$/i)) return true;
      // Match numeric sizes
      if (text.match(/^(\d{1,2}|one size)$/i)) return true;
      return false;
    };

    // Give the page time to fully render filters if they're being loaded dynamically
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get selected filters from the applied filters container
    const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
    if (appliedFilters) {
      console.log("[Content Script] Found applied filters container");
      const filterItems = appliedFilters.querySelectorAll('.fnl-plp-afliter');
      
      for (const item of filterItems) {
        try {
          const filterText = item.querySelector('.pull-left')?.textContent.trim();
          const filterType = item.querySelector('.fnl-plp-afliter-type')?.textContent.trim().toLowerCase();
          
          if (!filterText) continue;
          
          // Use the filter type if available, otherwise try to determine from text
          if (filterType) {
            if (filterType.includes('brand')) {
              if (!filters.brands.includes(filterText)) {
                filters.brands.push(filterText);
                console.log(`[Content Script] Added brand: ${filterText}`);
              }
            } else if (filterType.includes('color') || filterType.includes('colour')) {
              if (!filters.colors.includes(filterText)) {
                filters.colors.push(filterText);
                console.log(`[Content Script] Added color: ${filterText}`);
              }
            } else if (filterType.includes('size')) {
              if (!filters.sizes.includes(filterText)) {
                filters.sizes.push(filterText);
                console.log(`[Content Script] Added size: ${filterText}`);
              }
            }
          } else {
            // Fallback to text-based detection
            if (isSize(filterText)) {
              if (!filters.sizes.includes(filterText)) {
                filters.sizes.push(filterText);
                console.log(`[Content Script] Added size (by pattern): ${filterText}`);
              }
            } else if (filterText.match(/^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Navy|Maroon|Olive|Teal|Cyan|Magenta|Gold|Silver|Bronze|Multicolor|Printed|Striped|Floral|Geometric|Abstract|Animal Print|Camouflage|Tie & Dye|Ombre|Metallic|Glitter|Holographic|Neon|Pastel|Vintage|Washed|Faded|Distressed|Embellished|Sequined|Beaded|Quilted|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace)$/i)) {
              if (!filters.colors.includes(filterText)) {
                filters.colors.push(filterText);
                console.log(`[Content Script] Added color (by pattern): ${filterText}`);
              }
            } else {
              // Only add as brand if it doesn't match size or color patterns
              if (!filters.brands.includes(filterText)) {
                filters.brands.push(filterText);
                console.log(`[Content Script] Added brand (by default): ${filterText}`);
              }
            }
          }
        } catch (error) {
          console.error("[Content Script] Error processing filter item:", error);
        }
      }
    }

    // If no filters found in applied filters, check the facet menu directly
    if (filters.brands.length === 0 && filters.sizes.length === 0 && filters.colors.length === 0) {
      console.log("[Content Script] No filters found in applied filters, checking facets");
      
      // Check for brands
      const brandCheckboxes = document.querySelectorAll('input[name="brand"]:checked');
      for (const checkbox of brandCheckboxes) {
        try {
          const label = checkbox.closest('.facet-linkfref')?.querySelector('.facet-linkname-brand')?.textContent.trim();
          if (label && !filters.brands.includes(label)) {
            filters.brands.push(label);
            console.log(`[Content Script] Added brand from facet: ${label}`);
          }
        } catch (error) {
          console.error("[Content Script] Error getting brand from checkbox:", error);
        }
      }
      
      // Check for sizes - specifically look for UK sizes
      const sizeCheckboxes = document.querySelectorAll('input[name="verticalsizegroupformat"]:checked');
      for (const checkbox of sizeCheckboxes) {
        try {
          const label = checkbox.closest('.facet-linkfref')?.querySelector('.facet-linkname-verticalsizegroupformat')?.textContent.trim();
          if (label) {
            // Extract just the size value (e.g., "UK 2 (61)" -> "UK 2")
            const sizeMatch = label.match(/^(UK \d+)/i);
            if (sizeMatch && !filters.sizes.includes(sizeMatch[1])) {
              filters.sizes.push(sizeMatch[1]);
              console.log(`[Content Script] Added size from facet: ${sizeMatch[1]}`);
            }
          }
        } catch (error) {
          console.error("[Content Script] Error getting size from checkbox:", error);
        }
      }
      
      // Check for colors
      const colorCheckboxes = document.querySelectorAll('input[name="verticalcolorfamily"]:checked');
      for (const checkbox of colorCheckboxes) {
        try {
          const label = checkbox.closest('.facet-linkfref')?.querySelector('.facet-linkname-verticalcolorfamily, .facet-list-title-name')?.textContent.trim();
          if (label && !filters.colors.includes(label)) {
            filters.colors.push(label);
            console.log(`[Content Script] Added color from facet: ${label}`);
          }
        } catch (error) {
          console.error("[Content Script] Error getting color from checkbox:", error);
        }
      }
    }

    console.log("[Content Script] Final Ajio filters:", filters);
  } catch (error) {
    console.error("[Content Script] Error getting Ajio filters:", error);
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

// Amazon.in-specific functions
async function applyAmazonFilters(filters) {
  console.log("[Content Script] Applying Amazon filters:", filters);
  
  try {
    // Normalize filter values - handle both string and object formats
    const normalizedFilters = {
      brands: (filters.brands || []).map(b => typeof b === 'string' ? b : b.text || b.value || b),
      sizes: (filters.sizes || []).map(s => typeof s === 'string' ? s : s.text || s.value || s),
      colors: (filters.colors || []).map(c => typeof c === 'string' ? c : c.text || c.value || c)
    };
    
    console.log("[Content Script] Normalized filters:", normalizedFilters);
    
    // Helper function to wait for element and click
    const waitAndClick = async (element, description) => {
      if (!element) {
        console.warn(`[Content Script] ${description} not found`);
        return false;
      }
      
      try {
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Click the element
        element.click();
        console.log(`[Content Script] Clicked ${description}`);
        // Reduced delay after clicking
        await new Promise(resolve => setTimeout(resolve, 1500));
        return true;
      } catch (error) {
        console.error(`[Content Script] Error clicking ${description}:`, error);
        return false;
      }
    };

    // Track successfully applied filters
    let appliedFilters = {
      brands: [],
      sizes: [],
      colors: []
    };

    // Helper function for fuzzy matching
    const fuzzyMatch = (value, candidate) => {
      if (!value || !candidate) return false;
      
      const valueNormalized = value.toLowerCase().trim();
      const candidateNormalized = candidate.toLowerCase().trim();
      
      return valueNormalized.includes(candidateNormalized) || 
             candidateNormalized.includes(valueNormalized) ||
             valueNormalized.split(' ').some(word => 
               candidateNormalized.includes(word) && word.length > 3
             );
    };

    // Helper function to verify if a filter is currently applied
    const isFilterApplied = async (filterType, value) => {
      try {
        const currentFilters = await getAmazonFilters();
        return currentFilters[filterType].some(f => fuzzyMatch(f, value));
      } catch (error) {
        console.error(`[Content Script] Error verifying ${filterType} filter:`, error);
        return false;
      }
    };

    // Apply brand filters first
    if (normalizedFilters.brands.length > 0) {
      console.log("[Content Script] Starting brand filter application");
      
      for (const brand of normalizedFilters.brands) {
        // Skip if brand is already applied
        if (await isFilterApplied('brands', brand)) {
          console.log(`[Content Script] Brand ${brand} is already applied, skipping`);
          appliedFilters.brands.push(brand);
          continue;
        }

        console.log(`[Content Script] Looking for brand: ${brand}`);
        const brandLinks = Array.from(document.querySelectorAll('#filter-p_123 .a-link-normal.s-navigation-item'));
        const brandMatches = brandLinks.filter(link => {
          const brandText = link.querySelector('.a-size-base.a-color-base')?.textContent.trim();
          return brandText && fuzzyMatch(brandText, brand);
        });
        
        if (brandMatches.length > 0) {
          const brandLink = brandMatches[0];
          const brandText = brandLink.querySelector('.a-size-base.a-color-base')?.textContent.trim();
          
          const success = await waitAndClick(brandLink, `brand filter: ${brandText}`);
          if (success && await isFilterApplied('brands', brand)) {
            appliedFilters.brands.push(brand);
            console.log(`[Content Script] Successfully applied brand filter: ${brand}`);
          }
        }
      }
    }

    // Apply color filters next
    if (normalizedFilters.colors.length > 0) {
      console.log("[Content Script] Starting color filter application");
      
      for (const color of normalizedFilters.colors) {
        // Skip if color is already applied
        if (await isFilterApplied('colors', color)) {
          console.log(`[Content Script] Color ${color} is already applied, skipping`);
          appliedFilters.colors.push(color);
          continue;
        }

        console.log(`[Content Script] Looking for color: ${color}`);
        const colorLinks = Array.from(document.querySelectorAll('#filter-p_n_size_two_browse-vebin .a-link-normal.s-navigation-item'));
        const colorMatches = colorLinks.filter(link => {
          const titleText = link.getAttribute('title');
          const visibleText = link.querySelector('.a-size-base.a-color-base')?.textContent.trim();
          return (titleText && fuzzyMatch(titleText, color)) || 
                 (visibleText && fuzzyMatch(visibleText, color));
        });
        
        if (colorMatches.length > 0) {
          const colorLink = colorMatches[0];
          const colorText = colorLink.getAttribute('title') || 
                          colorLink.querySelector('.a-size-base.a-color-base')?.textContent.trim();
          
          const success = await waitAndClick(colorLink, `color filter: ${colorText}`);
          if (success && await isFilterApplied('colors', color)) {
            appliedFilters.colors.push(color);
            console.log(`[Content Script] Successfully applied color filter: ${color}`);
          }
        }
      }
    }

    // Apply size filters last, with limited retries
    if (normalizedFilters.sizes.length > 0) {
      console.log("[Content Script] Starting size filter application");
      
      for (const size of normalizedFilters.sizes) {
        // Skip if size is already applied
        if (await isFilterApplied('sizes', size)) {
          console.log(`[Content Script] Size ${size} is already applied, skipping`);
          appliedFilters.sizes.push(size);
          continue;
        }

        console.log(`[Content Script] Looking for size: ${size}`);
        let attempts = 0;
        const maxAttempts = 5;
        let sizeApplied = false;

        while (attempts < maxAttempts && !sizeApplied) {
          const sizeLinks = Array.from(document.querySelectorAll('#filter-p_n_size_browse-vebin .a-link-normal.s-navigation-item'));
          const sizeMatches = sizeLinks.filter(link => {
            const sizeText = link.querySelector('.a-size-base.a-color-base')?.textContent.trim();
            return sizeText && fuzzyMatch(sizeText, size);
          });
          
          if (sizeMatches.length > 0) {
            const sizeLink = sizeMatches[0];
            const sizeText = sizeLink.querySelector('.a-size-base.a-color-base')?.textContent.trim();
            
            const success = await waitAndClick(sizeLink, `size filter: ${sizeText}`);
            if (success && await isFilterApplied('sizes', size)) {
              appliedFilters.sizes.push(size);
              console.log(`[Content Script] Successfully applied size filter: ${size}`);
              sizeApplied = true;
              break;
            }
          }
          
          attempts++;
          if (!sizeApplied) {
            console.log(`[Content Script] Attempt ${attempts}/${maxAttempts} failed for size: ${size}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!sizeApplied) {
          console.warn(`[Content Script] Size ${size} not found after ${maxAttempts} attempts. This size may not be available.`);
        }
      }
    }

    // Calculate success metrics
    const totalRequested = normalizedFilters.brands.length + normalizedFilters.colors.length + normalizedFilters.sizes.length;
    const totalApplied = appliedFilters.brands.length + appliedFilters.colors.length + appliedFilters.sizes.length;
    const isPartialSuccess = totalApplied > 0 && totalApplied < totalRequested;

    console.log("[Content Script] Filter application complete:", {
      requested: {
        brands: normalizedFilters.brands,
        colors: normalizedFilters.colors,
        sizes: normalizedFilters.sizes
      },
      applied: appliedFilters,
      success: totalApplied > 0,
      partialSuccess: isPartialSuccess
    });

    return {
      success: totalApplied > 0,
      appliedFilters,
      partialSuccess: isPartialSuccess
    };
  } catch (error) {
    console.error("[Content Script] Error applying Amazon filters:", error);
    throw error;
  }
}

// Flipkart-specific functions
async function getFlipkartFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  // First check the summary section for applied filters
  const summarySection = document.querySelector('section[class*="pgRLLn"]');
  if (summarySection) {
    const appliedFilters = summarySection.querySelectorAll('.YcSYyC');
    for (const filter of appliedFilters) {
      const filterText = filter.querySelector('._6tw8ju')?.textContent.trim();
      if (filterText) {
        // Try to determine filter type based on the text
        if (filterText.match(/^(XS|S|M|L|XL|XXL|\d+(\.\d+)?)$/i)) {
          filters.sizes.push(filterText);
        } else if (filterText.match(/^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Navy|Maroon|Olive|Teal|Cyan|Magenta|Gold|Silver|Bronze|Multicolor|Printed|Striped|Floral|Geometric|Abstract|Animal Print|Camouflage|Tie & Dye|Ombre|Metallic|Glitter|Holographic|Neon|Pastel|Vintage|Washed|Faded|Distressed|Embellished|Sequined|Beaded|Quilted|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace)$/i)) {
          filters.colors.push(filterText);
        } else {
          // Assume it's a brand if it doesn't match size or color patterns
          filters.brands.push(filterText);
        }
      }
    }
  }

  // If no filters found in summary, check individual sections
  if (filters.brands.length === 0 && filters.sizes.length === 0 && filters.colors.length === 0) {
    // Get selected brands
    const brandSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
      .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Brand'));
    
    if (brandSection) {
      const brandLabels = brandSection.querySelectorAll('.ewzVkT[class*="_3DvUAf"]');
      for (const label of brandLabels) {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
          const brandText = label.querySelector('[class*="_6i1qKy"]')?.textContent.trim();
          if (brandText) {
            filters.brands.push(brandText);
          }
        }
      }
    }

    // Get selected colors
    const colorSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
      .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Color'));
    
    if (colorSection) {
      const colorLabels = colorSection.querySelectorAll('.ewzVkT[class*="_3DvUAf"]');
      for (const label of colorLabels) {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
          const colorText = label.querySelector('[class*="OJHqec"][class*="_6i1qKy"]')?.textContent.trim();
          if (colorText) {
            filters.colors.push(colorText);
          }
        }
      }
    }

    // Get selected sizes
    const sizeSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
      .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Size'));
    
    if (sizeSection) {
      const sizeLabels = sizeSection.querySelectorAll('.ewzVkT[class*="_3DvUAf"]');
      for (const label of sizeLabels) {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
          const sizeText = label.querySelector('[class*="_6i1qKy"]')?.textContent.trim();
          if (sizeText) {
            filters.sizes.push(sizeText);
          }
        }
      }
    }
  }

  console.log("[Content Script] Extracted Flipkart filters:", filters);
  return filters;
}

async function applyFlipkartFilters(filters) {
  console.log("[Content Script] Applying Flipkart filters:", filters);
  
  try {
    // Helper function to simulate a real click event with proper mouse events
    const simulateClick = (element) => {
      const events = [
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
        new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
      ];
      events.forEach(event => element.dispatchEvent(event));
    };

    // Helper function to verify if a specific filter is applied
    const isFilterApplied = async (filterValue, type) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check in the summary section first (most reliable)
      const summarySection = document.querySelector('section[class*="pgRLLn"]');
      if (summarySection) {
        const appliedFilters = summarySection.querySelectorAll('.YcSYyC');
        for (const filter of appliedFilters) {
          const text = filter.querySelector('._6tw8ju')?.textContent.trim();
          if (text && text.toLowerCase() === filterValue.toLowerCase()) {
            console.log(`[Content Script] Filter verified in summary: ${filterValue}`);
            return true;
          }
        }
      }
      
      // If not found in summary, check checkboxes directly
      let filterSection;
      if (type === 'brand') {
        filterSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
          .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Brand'));
      } else if (type === 'color') {
        filterSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
          .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Color'));
      } else if (type === 'size') {
        filterSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
          .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Size'));
      }
      
      if (filterSection) {
        const filterElements = filterSection.querySelectorAll('.ewzVkT[class*="_3DvUAf"]');
        for (const element of filterElements) {
          const text = element.querySelector('[class*="_6i1qKy"]')?.textContent.trim();
          if (text && text.toLowerCase() === filterValue.toLowerCase()) {
            const checkbox = element.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked) {
              console.log(`[Content Script] Filter verified by checkbox: ${filterValue}`);
              return true;
            }
          }
        }
      }
      
      // Filter not found as applied
      return false;
    };

    // Helper function to clear all filters
    const clearAllFilters = async () => {
      const clearAllButton = document.querySelector('.aOfogh span');
      if (clearAllButton) {
        console.log("[Content Script] Clearing all existing filters");
        simulateClick(clearAllButton);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify filters are cleared
        const summarySection = document.querySelector('section[class*="pgRLLn"]');
        if (summarySection) {
          const appliedFilters = summarySection.querySelectorAll('.YcSYyC');
          if (appliedFilters.length > 0) {
            console.log("[Content Script] Some filters still present, trying to clear again");
            simulateClick(clearAllButton);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    };

    // Helper function to expand filter section
    const expandSection = async (section, type) => {
      console.log(`[Content Script] Expanding ${type} section`);
      
      // For size section, handle differently
      if (type === 'size') {
        // First try clicking the size header
        const sizeHeader = section.querySelector('.rgHxCQ');
        if (sizeHeader) {
          console.log("[Content Script] Clicking size header");
          simulateClick(sizeHeader);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Check if section is expanded
        let isExpanded = section.querySelector('.SDsN9S');
        if (!isExpanded) {
          // Try clicking the entire header section
          const header = section.querySelector('.FtQCb2');
          if (header) {
            console.log("[Content Script] Clicking entire header section");
            simulateClick(header);
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          // Check again if expanded
          isExpanded = section.querySelector('.SDsN9S');
          if (!isExpanded) {
            // Try clicking the parent section
            console.log("[Content Script] Clicking parent section");
            simulateClick(section);
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        // Final check for expansion
        isExpanded = section.querySelector('.SDsN9S');
        if (!isExpanded) {
          console.warn("[Content Script] Could not expand size section after multiple attempts");
          return false;
        }

        // Additional wait for size section to fully expand
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
      }

      // For other sections, use the original logic
      const header = section.querySelector('.FtQCb2');
      if (header) {
        const isExpanded = section.querySelector('.SDsN9S');
        if (!isExpanded) {
          simulateClick(header);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      return section.querySelector('.SDsN9S') !== null;
    };

    // Helper function to apply a single filter with retries
    const applySingleFilter = async (section, filterValue, type, maxRetries = 3) => {
      console.log(`[Content Script] Applying ${type} filter: ${filterValue}`);
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[Content Script] Attempt ${attempt}/${maxRetries} for ${type} filter: ${filterValue}`);
        
        // Ensure section is expanded
        const isExpanded = await expandSection(section, type);
        if (!isExpanded) {
          console.warn(`[Content Script] Could not expand ${type} section`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          return false;
        }

        // Find the filter element
        const filterElements = section.querySelectorAll('.ewzVkT[class*="_3DvUAf"]');
        let found = false;
        
        for (const element of filterElements) {
          const text = element.querySelector('[class*="_6i1qKy"]')?.textContent.trim();
          if (text && text.toLowerCase() === filterValue.toLowerCase()) {
            found = true;
            console.log(`[Content Script] Found matching ${type} filter: ${filterValue}`);
            
            // Try multiple interaction methods
            const interactionMethods = [
              // Try clicking the checkbox directly
              async () => {
                const checkbox = element.querySelector('input[type="checkbox"]');
                if (checkbox) {
                  simulateClick(checkbox);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  return await isFilterApplied(filterValue, type);
                }
                return false;
              },
              // Try clicking the label
              async () => {
                const label = element.querySelector('label');
                if (label) {
                  simulateClick(label);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  return await isFilterApplied(filterValue, type);
                }
                return false;
              },
              // Try clicking the entire element
              async () => {
                simulateClick(element);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await isFilterApplied(filterValue, type);
              }
            ];

            // Try each interaction method
            for (const method of interactionMethods) {
              const success = await method();
              if (success) {
                console.log(`[Content Script] Successfully applied ${type} filter: ${filterValue}`);
                return true;
              }
            }
            
            // If all methods failed, try one more time with a longer delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            simulateClick(element);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const success = await isFilterApplied(filterValue, type);
            if (success) {
              return true;
            }
          }
        }
        
        // If filter not found and it's a color or size filter, try clicking "Click More"
        if (!found && (type === 'color' || type === 'size')) {
          const clickMoreButton = section.querySelector('.e\\+xvXX.KvHRYS span');
          if (clickMoreButton) {
            console.log(`[Content Script] ${type} filter not found in visible options, clicking 'Click More'`);
            simulateClick(clickMoreButton);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try finding the filter again after expanding
            const expandedFilterElements = section.querySelectorAll('.ewzVkT[class*="_3DvUAf"]');
            for (const element of expandedFilterElements) {
              const text = element.querySelector('[class*="_6i1qKy"]')?.textContent.trim();
              if (text && text.toLowerCase() === filterValue.toLowerCase()) {
                console.log(`[Content Script] Found matching ${type} filter after expanding: ${filterValue}`);
                
                // Try the same interaction methods
                const interactionMethods = [
                  async () => {
                    const checkbox = element.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                      simulateClick(checkbox);
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      return await isFilterApplied(filterValue, type);
                    }
                    return false;
                  },
                  async () => {
                    const label = element.querySelector('label');
                    if (label) {
                      simulateClick(label);
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      return await isFilterApplied(filterValue, type);
                    }
                    return false;
                  },
                  async () => {
                    simulateClick(element);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await isFilterApplied(filterValue, type);
                  }
                ];

                for (const method of interactionMethods) {
                  const success = await method();
                  if (success) {
                    console.log(`[Content Script] Successfully applied ${type} filter after expanding: ${filterValue}`);
                    return true;
                  }
                }
                
                // If all methods failed, try one more time with a longer delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                simulateClick(element);
                await new Promise(resolve => setTimeout(resolve, 2000));
                const success = await isFilterApplied(filterValue, type);
                if (success) {
                  return true;
                }
              }
            }
          }
        }
        
        if (!found) {
          console.warn(`[Content Script] ${type} filter not found: ${filterValue}`);
        }
        
        // If this attempt failed and we have more retries, wait before trying again
        if (attempt < maxRetries) {
          console.log(`[Content Script] Retrying ${type} filter: ${filterValue}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      return false;
    };

    // Helper function to apply a group of filters
    const applyFilterGroup = async (filters, type, section) => {
      if (filters && filters.length > 0) {
        console.log(`[Content Script] Applying ${type} filters:`, filters);
        
        // First check if any filters are already applied
        const currentFilters = await getFlipkartFilters();
        const currentTypeFilters = currentFilters[type + 's'] || [];
        console.log(`[Content Script] Current ${type} filters:`, currentTypeFilters);
        
        // Filter out already applied values
        const filtersToApply = filters.filter(filter => !currentTypeFilters.includes(filter));
        
        if (filtersToApply.length === 0) {
          console.log(`[Content Script] All ${type} filters already applied, skipping`);
          // Add already applied filters to our tracking
          filters.forEach(filter => {
            if (!appliedFilters[type + 's'].includes(filter)) {
              appliedFilters[type + 's'].push(filter);
            }
          });
          return;
        }
        
        console.log(`[Content Script] Applying ${filtersToApply.length} ${type} filters:`, filtersToApply);
        
        for (const filter of filtersToApply) {
          // Check if this specific filter was already applied (double-check)
          if (currentTypeFilters.includes(filter) || appliedFilters[type + 's'].includes(filter)) {
            console.log(`[Content Script] Filter ${filter} already applied, skipping`);
            if (!appliedFilters[type + 's'].includes(filter)) {
              appliedFilters[type + 's'].push(filter);
            }
            continue;
          }
          
          const success = await applySingleFilter(section, filter, type);
          if (success) {
            appliedFilters[type + 's'].push(filter);
            // Wait between applying filters of the same type
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    };

    // Clear all filters first
    await clearAllFilters();
    
    // Track applied filters
    let appliedFilters = {
      brands: [],
      colors: [],
      sizes: []
    };
    
    // Check for brand filters
    if (filters.brands && filters.brands.length > 0) {
      const brandSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
        .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Brand'));
      if (brandSection) {
        await applyFilterGroup(filters.brands, 'brand', brandSection);
      }
    }

    // Wait before applying next filter type
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for color filters
    if (filters.colors && filters.colors.length > 0) {
      const colorSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
        .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Color'));
      if (colorSection) {
        await applyFilterGroup(filters.colors, 'color', colorSection);
      }
    }

    // Wait before applying next filter type
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for size filters
    if (filters.sizes && filters.sizes.length > 0) {
      const sizeSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
        .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Size'));
      if (sizeSection) {
        // Additional wait for size section
        await new Promise(resolve => setTimeout(resolve, 2000));
        await applyFilterGroup(filters.sizes, 'size', sizeSection);
      }
    }

    // Final verification
    console.log("[Content Script] Applied filters:", appliedFilters);
    
    // Calculate which filters we were unable to apply
    const unappliedFilters = {
      brands: filters.brands.filter(brand => !appliedFilters.brands.includes(brand)),
      colors: filters.colors.filter(color => !appliedFilters.colors.includes(color)),
      sizes: filters.sizes.filter(size => !appliedFilters.sizes.includes(size))
    };
    
    // Check if we have any unapplied filters
    const hasUnappliedFilters = 
      unappliedFilters.brands.length > 0 || 
      unappliedFilters.colors.length > 0 || 
      unappliedFilters.sizes.length > 0;
    
    if (hasUnappliedFilters) {
      console.log("[Content Script] Some filters were not applied:", unappliedFilters);
      
      // Only try once more with very specific values that weren't applied
      // and only if we have something to retry
      let retrySuccessful = false;
      
      if (unappliedFilters.brands.length > 0) {
        const brandSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
          .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Brand'));
        if (brandSection) {
          for (const brand of unappliedFilters.brands) {
            // Skip if somehow it got applied in the meantime
            if (appliedFilters.brands.includes(brand)) continue;
            
            const success = await applySingleFilter(brandSection, brand, 'brand');
            if (success) {
              appliedFilters.brands.push(brand);
              retrySuccessful = true;
            }
          }
        }
      }
      
      if (unappliedFilters.colors.length > 0) {
        const colorSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
          .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Color'));
        if (colorSection) {
          for (const color of unappliedFilters.colors) {
            // Skip if somehow it got applied in the meantime
            if (appliedFilters.colors.includes(color)) continue;
            
            const success = await applySingleFilter(colorSection, color, 'color');
            if (success) {
              appliedFilters.colors.push(color);
              retrySuccessful = true;
            }
          }
        }
      }
      
      if (unappliedFilters.sizes.length > 0) {
        const sizeSection = Array.from(document.querySelectorAll('section[class*="-5qqlC"]'))
          .find(section => section.querySelector('.rgHxCQ')?.textContent.includes('Size'));
        if (sizeSection) {
          for (const size of unappliedFilters.sizes) {
            // Skip if somehow it got applied in the meantime
            if (appliedFilters.sizes.includes(size)) continue;
            
            const success = await applySingleFilter(sizeSection, size, 'size');
            if (success) {
              appliedFilters.sizes.push(size);
              retrySuccessful = true;
            }
          }
        }
      }
      
      // If retry was successful, update our list of unapplied filters
      if (retrySuccessful) {
        console.log("[Content Script] Retry was partially successful, updated applied filters:", appliedFilters);
      }
    }
    
    // Return success even if not all filters were applied
    return { 
      success: true, 
      appliedFilters,
      partialSuccess: hasUnappliedFilters
    };
  } catch (error) {
    console.error("[Content Script] Error applying Flipkart filters:", error);
    throw error;
  }
}

// Snapdeal-specific functions
async function getSnapdealFilters() {
  console.log("[Content Script] Getting Snapdeal filters");
  
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };
  
  try {
    // Wait for the filter sections to be available
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get selected brands
    const brandSection = Array.from(document.querySelectorAll('.filter-section'))
      .find(section => {
        const displayName = section.getAttribute('data-displayname');
        return displayName && displayName.toLowerCase() === 'brand';
      });
    
    if (brandSection) {
      console.log("[Content Script] Found brand section");
      
      // Check both regular checkboxes and checkboxes in modal
      const brandCheckboxes = brandSection.querySelectorAll('.filter-inner .filters-list input[type="checkbox"]:checked, .js-adv-filters .filters-list input[type="checkbox"]:checked');
      
      for (const checkbox of brandCheckboxes) {
        try {
          const brandValue = checkbox.value;
          if (brandValue && !filters.brands.includes(brandValue)) {
            filters.brands.push(brandValue);
            console.log(`[Content Script] Added brand: ${brandValue}`);
          }
        } catch (error) {
          console.error("[Content Script] Error getting brand value:", error);
        }
      }
    }
    
    // Get selected colors
    const colorSection = Array.from(document.querySelectorAll('.filter-section'))
      .find(section => {
        const displayName = section.getAttribute('data-displayname');
        return displayName && displayName.toLowerCase() === 'color';
      });
    
    if (colorSection) {
      console.log("[Content Script] Found color section");
      
      const colorCheckboxes = colorSection.querySelectorAll('.filter-inner .filters-list input[type="checkbox"]:checked, .js-adv-filters .filters-list input[type="checkbox"]:checked');
      
      for (const checkbox of colorCheckboxes) {
        try {
          const colorValue = checkbox.value;
          if (colorValue && !filters.colors.includes(colorValue)) {
            filters.colors.push(colorValue);
            console.log(`[Content Script] Added color: ${colorValue}`);
          }
        } catch (error) {
          console.error("[Content Script] Error getting color value:", error);
        }
      }
    }
    
    // Get selected sizes
    const sizeSection = Array.from(document.querySelectorAll('.filter-section'))
      .find(section => {
        const displayName = section.getAttribute('data-displayname');
        return displayName && displayName.toLowerCase() === 'size';
      });
    
    if (sizeSection) {
      console.log("[Content Script] Found size section");
      
      const sizeCheckboxes = sizeSection.querySelectorAll('.filter-inner .filters-list input[type="checkbox"]:checked, .js-adv-filters .filters-list input[type="checkbox"]:checked');
      
      for (const checkbox of sizeCheckboxes) {
        try {
          const sizeValue = checkbox.value;
          if (sizeValue && !filters.sizes.includes(sizeValue)) {
            filters.sizes.push(sizeValue);
            console.log(`[Content Script] Added size: ${sizeValue}`);
          }
        } catch (error) {
          console.error("[Content Script] Error getting size value:", error);
        }
      }
    }
    
    console.log("[Content Script] Extracted Snapdeal filters:", filters);
  } catch (error) {
    console.error("[Content Script] Error getting Snapdeal filters:", error);
  }
  
  return filters;
}

async function applySnapdealFilters(filters) {
  console.log("[Content Script] Applying Snapdeal filters:", filters);
  
  try {
    // Helper function to wait for element to be available
    const waitForElement = async (selector, maxAttempts = 10, interval = 500) => {
      let attempts = 0;
      while (attempts < maxAttempts) {
        const element = document.querySelector(selector);
        if (element) return element;
        
        await new Promise(resolve => setTimeout(resolve, interval));
        attempts++;
      }
      return null;
    };
    
    // Helper function to click a checkbox for a specific filter
    const applyFilter = async (sectionSelector, filterValue, filterType) => {
      console.log(`[Content Script] Applying ${filterType} filter: ${filterValue}`);
      
      const section = await waitForElement(sectionSelector);
      if (!section) {
        console.warn(`[Content Script] ${filterType} section not found`);
        return false;
      }
      
      // First try to find the filter in the visible filter options
      let checkbox = section.querySelector(`input[id="${filterType}-${filterValue}"]:not(:checked), input[id="${filterType}_s-${filterValue}"]:not(:checked)`);
      
      if (!checkbox) {
        // If not found, try to find "View More" button and click it
        const viewMoreBtn = section.querySelector('.view-more-button, .viewMoreFilter');
        if (viewMoreBtn) {
          console.log(`[Content Script] Clicking View More button for ${filterType}`);
          viewMoreBtn.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Wait for modal to appear
          const modal = await waitForElement('.js-adv-filters.adv-filters');
          if (modal) {
            console.log(`[Content Script] Modal opened, looking for ${filterType} filter: ${filterValue}`);
            
            // Try to find checkbox in modal
            checkbox = modal.querySelector(`input[id="${filterType}-${filterValue}"]:not(:checked), input[id="${filterType}_s-${filterValue}"]:not(:checked), input[value="${filterValue}"]:not(:checked)`);
            
            if (!checkbox) {
              // Try to search for the filter if there's a search box
              const searchBox = modal.querySelector('.js-searchable-box');
              if (searchBox) {
                console.log(`[Content Script] Using search box to find: ${filterValue}`);
                searchBox.value = filterValue;
                searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Try to find checkbox again after search
                checkbox = modal.querySelector(`input[value="${filterValue}"]:not(:checked)`);
              }
            }
            
            if (checkbox) {
              console.log(`[Content Script] Found ${filterType} in modal: ${filterValue}`);
              checkbox.click();
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Click Apply button
              const applyBtn = modal.querySelector('.applyFilters');
              if (applyBtn) {
                console.log("[Content Script] Clicking Apply button");
                applyBtn.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            } else {
              // Close modal if filter not found
              const closeBtn = modal.querySelector('.close-adv');
              if (closeBtn) {
                console.log(`[Content Script] Closing modal - filter not found`);
                closeBtn.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
        }
      } else {
        // If found in main section, just click it
        console.log(`[Content Script] Found ${filterType} in main section: ${filterValue}`);
        checkbox.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      }
      
      console.warn(`[Content Script] Could not find ${filterType}: ${filterValue}`);
      return false;
    };
    
    // Clear all filters first
    const clearAll = async () => {
      const clearButtons = document.querySelectorAll('.filter-clear');
      if (clearButtons.length > 0) {
        console.log(`[Content Script] Clearing existing filters`);
        for (const button of clearButtons) {
          if (button.textContent.trim().toLowerCase() === 'clear') {
            button.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    };
    
    // Clear filters first
    await clearAll();
    
    // Apply filters one by one
    let appliedFilters = {
      brands: [],
      colors: [],
      sizes: []
    };
    
    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      console.log("[Content Script] Applying brand filters on Snapdeal");
      for (const brand of filters.brands) {
        const brandValue = typeof brand === 'string' ? brand : brand.text || brand.value || brand;
        const success = await applyFilter('.filter-section[data-displayname="Brand"]', brandValue, 'Brand');
        if (success) {
          appliedFilters.brands.push(brandValue);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }
    
    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      console.log("[Content Script] Applying color filters on Snapdeal");
      for (const color of filters.colors) {
        const colorValue = typeof color === 'string' ? color : color.text || color.value || color;
        const success = await applyFilter('.filter-section[data-displayname="Color"]', colorValue, 'Color_s');
        if (success) {
          appliedFilters.colors.push(colorValue);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }
    
    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      console.log("[Content Script] Applying size filters on Snapdeal");
      for (const size of filters.sizes) {
        const sizeValue = typeof size === 'string' ? size : size.text || size.value || size;
        const success = await applyFilter('.filter-section[data-displayname="Size"]', sizeValue, 'Size_s');
        if (success) {
          appliedFilters.sizes.push(sizeValue);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }
    
    // Return results
    console.log("[Content Script] Applied Snapdeal filters:", appliedFilters);
    return {
      success: true,
      appliedFilters: appliedFilters
    };
  } catch (error) {
    console.error("[Content Script] Error applying Snapdeal filters:", error);
    throw error;
  }
}

// Nykaa-specific functions
async function getNykaaFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  try {
    console.log("[Content Script] Getting Nykaa filters");

    // Check the applied filters section first
    const appliedFiltersSection = document.querySelector('.css-19j3ean');
    if (appliedFiltersSection) {
      const appliedFilters = appliedFiltersSection.querySelectorAll('.css-3i7s5s');
      for (const filter of appliedFilters) {
        const filterText = filter.querySelector('.filter-value')?.textContent.trim();
        if (filterText) {
          // Try to determine filter type based on the text
          if (filterText.match(/^UK \d+$/i)) {
            filters.sizes.push(filterText);
          } else if (filterText.match(/^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Multi-Color|Gold|Silver|Off White|Cream)$/i)) {
            filters.colors.push(filterText);
          } else {
            // Assume it's a brand if it doesn't match size or color patterns
            filters.brands.push(filterText);
          }
        }
      }
    }

    // If no filters found in applied section, check individual filter sections
    if (filters.brands.length === 0 && filters.sizes.length === 0 && filters.colors.length === 0) {
      // Check brand filters
      const brandSection = document.querySelector('#first-filter');
      if (brandSection) {
        const brandCheckboxes = brandSection.querySelectorAll('input[type="checkbox"]:checked');
        for (const checkbox of brandCheckboxes) {
          const label = checkbox.closest('label')?.querySelector('.title')?.textContent.trim();
          if (label) {
            filters.brands.push(label);
          }
        }
      }

      // Check size filters
      const sizeSection = document.querySelector('div[class="css-w2222k"]:has(span.title:contains("Size"))');
      if (sizeSection) {
        const sizeCheckboxes = sizeSection.querySelectorAll('input[type="checkbox"]:checked');
        for (const checkbox of sizeCheckboxes) {
          const label = checkbox.closest('label')?.querySelector('.title')?.textContent.trim();
          if (label) {
            filters.sizes.push(label);
          }
        }
      }

      // Check color filters
      const colorSection = document.querySelector('div[class="css-w2222k"]:has(span.title:contains("Color"))');
      if (colorSection) {
        const colorCheckboxes = colorSection.querySelectorAll('input[type="checkbox"]:checked');
        for (const checkbox of colorCheckboxes) {
          const label = checkbox.closest('label')?.querySelector('.title')?.textContent.trim();
          if (label) {
            filters.colors.push(label);
          }
        }
      }
    }

    console.log("[Content Script] Extracted Nykaa filters:", filters);
    return filters;
  } catch (error) {
    console.error("[Content Script] Error getting Nykaa filters:", error);
    throw error;
  }
}

async function applyNykaaFilters(filters) {
  console.log("[Content Script] Applying Nykaa filters:", filters);

  try {
    // Helper function to click an element
    const clickElement = async (element) => {
      if (element) {
        element.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    // Helper function to verify if a filter is applied
    const isFilterApplied = (filterValue) => {
      const appliedFiltersSection = document.querySelector('.css-19j3ean');
      if (appliedFiltersSection) {
        const appliedFilters = appliedFiltersSection.querySelectorAll('.css-3i7s5s');
        for (const filter of appliedFilters) {
          const text = filter.querySelector('.filter-value')?.textContent.trim();
          if (text && text.toLowerCase() === filterValue.toLowerCase()) {
            return true;
          }
        }
      }
      return false;
    };

    // Helper function to clear all filters
    const clearAllFilters = async () => {
      const clearAllButton = document.querySelector('button.filter-clear-all');
      if (clearAllButton) {
        await clickElement(clearAllButton);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    };

    // Helper function to apply a single filter
    const applySingleFilter = async (filterSection, filterValue) => {
      // Click to expand the filter section if it's collapsed
      const filterHeader = filterSection.querySelector('.filter-open');
      if (filterHeader) {
        const isExpanded = filterSection.querySelector('ul.css-oryinj');
        if (!isExpanded) {
          await clickElement(filterHeader);
        }
      }

      // Find and click the checkbox for the filter value
      const filterItems = filterSection.querySelectorAll('.control-box');
      for (const item of filterItems) {
        const label = item.querySelector('.title')?.textContent.trim();
        if (label && label.toLowerCase() === filterValue.toLowerCase()) {
          const checkbox = item.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) {
            await clickElement(checkbox);
            
            // Verify the filter was applied
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (isFilterApplied(filterValue)) {
              return true;
            }
          } else if (checkbox && checkbox.checked) {
            // Filter is already applied
            return true;
          }
        }
      }
      return false;
    };

    // Clear existing filters first
    await clearAllFilters();

    // Track successfully applied filters
    const appliedFilters = {
      brands: [],
      colors: [],
      sizes: []
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      const brandSection = document.querySelector('#first-filter');
      if (brandSection) {
        for (const brand of filters.brands) {
          const success = await applySingleFilter(brandSection, brand);
          if (success) {
            appliedFilters.brands.push(brand);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      const sizeSection = document.querySelector('div[class="css-w2222k"]:has(span.title:contains("Size"))');
      if (sizeSection) {
        for (const size of filters.sizes) {
          const success = await applySingleFilter(sizeSection, size);
          if (success) {
            appliedFilters.sizes.push(size);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      const colorSection = document.querySelector('div[class="css-w2222k"]:has(span.title:contains("Color"))');
      if (colorSection) {
        for (const color of filters.colors) {
          const success = await applySingleFilter(colorSection, color);
          if (success) {
            appliedFilters.colors.push(color);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    console.log("[Content Script] Successfully applied Nykaa filters:", appliedFilters);
    return appliedFilters;
  } catch (error) {
    console.error("[Content Script] Error applying Nykaa filters:", error);
    throw error;
  }
}

// Myntra-specific filter application
async function applyMyntraFilters(filters) {
  console.log("[Content Script] Applying Myntra filters:", filters);
  
  try {
    // Clear existing filters first
    await resetMyntraFilters();
    
    let appliedFilters = {
      brands: [],
      sizes: [],
      colors: []
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      const success = await applyBrandFilters(filters.brands, 'myntra');
      if (success) {
        appliedFilters.brands = filters.brands;
      }
    }

    // Wait between filter types
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      const success = await applySizeFilters(filters.sizes, 'myntra');
      if (success) {
        appliedFilters.sizes = filters.sizes;
      }
    }

    // Wait between filter types
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      const success = await applyColorFilters(filters.colors, 'myntra');
      if (success) {
        appliedFilters.colors = filters.colors;
      }
    }

    // Return success even if some filters couldn't be applied
    return {
      success: true,
      appliedFilters: appliedFilters,
      partialSuccess: !areAllFiltersApplied(filters, appliedFilters)
    };
  } catch (error) {
    console.error("[Content Script] Error applying Myntra filters:", error);
    throw error;
  }
}

// Ajio-specific filter application
async function applyAjioFilters(filters) {
  console.log("[Content Script] Applying Ajio filters:", filters);
  
  try {
    // Clear existing filters first
    await resetAjioFilters();
    
    let appliedFilters = {
      brands: [],
      sizes: [],
      colors: []
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      const success = await applyBrandFilters(filters.brands, 'ajio');
      if (success) {
        appliedFilters.brands = filters.brands;
      }
    }

    // Wait between filter types
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      const success = await applySizeFilters(filters.sizes, 'ajio');
      if (success) {
        appliedFilters.sizes = filters.sizes;
      }
    }

    // Wait between filter types
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      const success = await applyColorFilters(filters.colors, 'ajio');
      if (success) {
        appliedFilters.colors = filters.colors;
      }
    }

    // Return success even if some filters couldn't be applied
    return {
      success: true,
      appliedFilters: appliedFilters,
      partialSuccess: !areAllFiltersApplied(filters, appliedFilters)
    };
  } catch (error) {
    console.error("[Content Script] Error applying Ajio filters:", error);
    throw error;
  }
}

// Helper function to check if all filters were applied
function areAllFiltersApplied(requestedFilters, appliedFilters) {
  const checkArrays = (requested, applied) => {
    if (!requested || requested.length === 0) return true;
    if (!applied || applied.length === 0) return false;
    return requested.length === applied.length;
  };

  return checkArrays(requestedFilters.brands, appliedFilters.brands) &&
         checkArrays(requestedFilters.sizes, appliedFilters.sizes) &&
         checkArrays(requestedFilters.colors, appliedFilters.colors);
}