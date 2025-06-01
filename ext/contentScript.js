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
  else if (request.action === "showToast") {
    console.log("[Content Script] Showing toast:", request.message);
    showWebpageToast(request.message, request.type, request.duration);
    sendResponse({success: true});
    return true;
  }
});

// Toast notification system for webpage
function showWebpageToast(message, type = 'success', duration = 3000) {
  // Remove any existing toast
  const existingToast = document.querySelector('.filter-saver-webpage-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'filter-saver-webpage-toast';
  
  toast.innerHTML = `
    <div class="filter-saver-toast-content">
      <span class="filter-saver-toast-message">${message}</span>
    </div>
  `;
  
  // Add toast styles based on type
  const backgroundColor = type === 'error' ? '#fee2e2' : type === 'delete' ? '#fef3c7' : '#d1fae5';
  const textColor = type === 'error' ? '#dc2626' : type === 'delete' ? '#d97706' : '#065f46';
  const borderColor = type === 'error' ? '#fecaca' : type === 'delete' ? '#fed7aa' : '#a7f3d0';
  const accentColor = type === 'error' ? '#dc2626' : type === 'delete' ? '#d97706' : '#10b981';
  
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${backgroundColor};
    color: ${textColor};
    border: 2px solid ${borderColor};
    border-left: 4px solid ${accentColor};
    border-radius: 8px;
    padding: 16px 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 999999;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 500;
    max-width: 350px;
    word-wrap: break-word;
    animation: filterSaverSlideIn 0.3s ease-out forwards;
    opacity: 0;
    transform: translateX(100%);
  `;
  
  // Add CSS animation keyframes if not already added
  if (!document.querySelector('#filter-saver-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'filter-saver-toast-styles';
    style.textContent = `
      @keyframes filterSaverSlideIn {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes filterSaverSlideOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }
      .filter-saver-toast-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .filter-saver-toast-message {
        flex: 1;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add to document
  document.body.appendChild(toast);
  
  // Remove toast after duration
  setTimeout(() => {
    toast.style.animation = 'filterSaverSlideOut 0.3s ease-in forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, duration);
}

// Amazon.in-specific functions
async function getAmazonFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  console.log("[Content Script] Starting enhanced Amazon filter detection...");

  // Enhanced Brand Filter Detection (Original + New Logic)
  console.log("[Content Script] Detecting Amazon brand filters...");
  
  // Method 1: Original detection logic (checkbox-based)
  const brandLinks = document.querySelectorAll('#filter-p_123 .a-link-normal.s-navigation-item');
  for (const link of brandLinks) {
    const checkbox = link.querySelector('input[type="checkbox"]');
    if (checkbox && checkbox.checked) {
      const brandText = link.querySelector('.a-size-base.a-color-base')?.textContent.trim();
      if (brandText && !filters.brands.includes(brandText)) {
        filters.brands.push(brandText);
        console.log(`[Content Script] Found brand via checkbox method: ${brandText}`);
      }
    }
  }

  // Method 2: Enhanced detection using aria-current="true" for brands
  const selectedBrandLinks = document.querySelectorAll('#filter-p_123 .a-link-normal.s-navigation-item[aria-current="true"]');
  for (const link of selectedBrandLinks) {
    const brandText = link.querySelector('.a-size-base.a-color-base')?.textContent.trim();
    if (brandText && !filters.brands.includes(brandText)) {
      filters.brands.push(brandText);
      console.log(`[Content Script] Found brand via aria-current method: ${brandText}`);
    }
  }

  // Method 3: Enhanced detection using button selection for brands
  const selectedBrandButtons = document.querySelectorAll('#filter-p_123 .a-button-selected');
  for (const button of selectedBrandButtons) {
    const brandText = button.querySelector('.a-size-base')?.textContent.trim();
    if (brandText && !filters.brands.includes(brandText)) {
      filters.brands.push(brandText);
      console.log(`[Content Script] Found brand via button selection method: ${brandText}`);
    }
  }

  // Method 4: Check expanded content for brands
  const expandedBrandContent = document.querySelector('#filter-p_123 .a-expander-content');
  if (expandedBrandContent && !expandedBrandContent.style.display.includes('none')) {
    const expandedBrandLinks = expandedBrandContent.querySelectorAll('.a-link-normal.s-navigation-item[aria-current="true"]');
    for (const link of expandedBrandLinks) {
      const brandText = link.querySelector('.a-size-base.a-color-base')?.textContent.trim();
      if (brandText && !filters.brands.includes(brandText)) {
        filters.brands.push(brandText);
        console.log(`[Content Script] Found brand via expanded content method: ${brandText}`);
      }
    }
  }

  // Enhanced Size Filter Detection (Original + New Logic)
  console.log("[Content Script] Detecting Amazon size filters...");
  
  // Method 1: Original detection logic (aria-current based)
  const sizeLinks = document.querySelectorAll('#filter-p_n_size_browse-vebin .a-link-normal.s-navigation-item');
  for (const link of sizeLinks) {
    if (link.getAttribute('aria-current') === 'true') {
      const sizeText = link.querySelector('.a-size-base.a-color-base')?.textContent.trim();
      if (sizeText && !filters.sizes.includes(sizeText)) {
        filters.sizes.push(sizeText);
        console.log(`[Content Script] Found size via aria-current method: ${sizeText}`);
      }
    }
  }

  // Method 2: Enhanced detection using button selection for sizes
  const selectedSizeButtons = document.querySelectorAll('#filter-p_n_size_browse-vebin .a-button-selected');
  for (const button of selectedSizeButtons) {
    const sizeText = button.querySelector('.a-size-base, .a-button-text')?.textContent.trim();
    if (sizeText && !filters.sizes.includes(sizeText)) {
      filters.sizes.push(sizeText);
      console.log(`[Content Script] Found size via button selection method: ${sizeText}`);
    }
  }

  // Method 3: Check for aria-pressed="true" buttons for sizes
  const pressedSizeButtons = document.querySelectorAll('#filter-p_n_size_browse-vebin button[aria-pressed="true"]');
  for (const button of pressedSizeButtons) {
    const sizeText = button.textContent.trim() || button.getAttribute('aria-label');
    if (sizeText && !filters.sizes.includes(sizeText)) {
      filters.sizes.push(sizeText);
      console.log(`[Content Script] Found size via aria-pressed method: ${sizeText}`);
    }
  }

  // Method 4: Check for selected size containers
  const selectedSizeContainers = document.querySelectorAll('#filter-p_n_size_browse-vebin li .a-list-item a[aria-current="true"]');
  for (const container of selectedSizeContainers) {
    const sizeText = container.querySelector('button')?.textContent.trim() || 
                     container.querySelector('.a-size-base')?.textContent.trim() ||
                     container.getAttribute('aria-label');
    if (sizeText && !filters.sizes.includes(sizeText)) {
      filters.sizes.push(sizeText);
      console.log(`[Content Script] Found size via container selection method: ${sizeText}`);
    }
  }

  // Enhanced Color Filter Detection (Original + New Logic)
  console.log("[Content Script] Detecting Amazon color filters...");
  
  // Method 1: Original detection logic (aria-current and title based)
  const colorLinks = document.querySelectorAll('#filter-p_n_size_two_browse-vebin .a-link-normal.s-navigation-item');
  for (const link of colorLinks) {
    const colorText = link.getAttribute('title');
    if (colorText && link.getAttribute('aria-current') === 'true' && !filters.colors.includes(colorText)) {
      filters.colors.push(colorText);
      console.log(`[Content Script] Found color via title method: ${colorText}`);
    }
  }

  // Method 2: Enhanced detection using aria-label for colors
  const selectedColorLinks = document.querySelectorAll('#filter-p_n_size_two_browse-vebin a[aria-current="true"]');
  for (const link of selectedColorLinks) {
    const colorText = link.getAttribute('title') || link.getAttribute('aria-label');
    if (colorText && !filters.colors.includes(colorText)) {
      // Extract color name from aria-label if needed (e.g., "Remove the filter Black to expand results" -> "Black")
      const colorMatch = colorText.match(/(?:filter|the)\s+([A-Za-z\s]+)\s+to/i);
      const extractedColor = colorMatch ? colorMatch[1].trim() : colorText;
      if (extractedColor && !filters.colors.includes(extractedColor)) {
        filters.colors.push(extractedColor);
        console.log(`[Content Script] Found color via aria-label method: ${extractedColor}`);
      }
    }
  }

  // Method 3: Check for color sprite elements with selection indicators
  const colorSprites = document.querySelectorAll('#filter-p_n_size_two_browse-vebin .colorsprite');
  for (const sprite of colorSprites) {
    const parentLink = sprite.closest('a');
    if (parentLink && parentLink.getAttribute('aria-current') === 'true') {
      const colorText = parentLink.getAttribute('title') || parentLink.getAttribute('aria-label');
      if (colorText && !filters.colors.includes(colorText)) {
        filters.colors.push(colorText);
        console.log(`[Content Script] Found color via sprite method: ${colorText}`);
      }
    }
  }

  // Method 4: Check for color containers with selection state
  const selectedColorContainers = document.querySelectorAll('#filter-p_n_size_two_browse-vebin li .a-list-item a[aria-current="true"]');
  for (const container of selectedColorContainers) {
    const colorText = container.getAttribute('title') || 
                      container.getAttribute('aria-label') ||
                      container.querySelector('.a-size-base')?.textContent.trim();
    if (colorText && !filters.colors.includes(colorText)) {
      // Handle aria-label extraction if needed
      const colorMatch = colorText.match(/(?:filter|the)\s+([A-Za-z\s]+)\s+to/i);
      const extractedColor = colorMatch ? colorMatch[1].trim() : colorText;
      if (extractedColor && !filters.colors.includes(extractedColor)) {
        filters.colors.push(extractedColor);
        console.log(`[Content Script] Found color via container method: ${extractedColor}`);
      }
    }
  }

  // Additional fallback detection methods
  console.log("[Content Script] Running fallback detection methods...");

  // Enhanced helper function to determine if a text is a size
  const isSize = (text) => {
    // Match standard letter sizes (S, M, L, XL, XXL, etc.)
    if (text.match(/^(XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)$/i)) return true;
    // Match numeric sizes (including single and double digits with optional decimal)
    if (text.match(/^(\d{1,2}(\.\d+)?)$/i)) return true;
    // Match special size codes like OS (One Size), FS (Free Size), etc.
    if (text.match(/^(OS|FS|Free Size|One Size)$/i)) return true;
    // Match UK sizes
    if (text.match(/^UK \d+$/i)) return true;
    return false;
  };

  // Enhanced helper function to determine if a text is a color
  const isColor = (text) => {
    return text.match(/^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Navy|Maroon|Olive|Teal|Cyan|Magenta|Gold|Silver|Bronze|Multicolor|Printed|Striped|Floral|Geometric|Abstract|Animal Print|Camouflage|Tie & Dye|Ombre|Metallic|Glitter|Holographic|Neon|Pastel|Vintage|Washed|Faded|Distressed|Embellished|Sequined|Beaded|Quilted|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace)$/i);
  };

  // Fallback: Check for any elements with "Remove the filter" text patterns
  const removeFilterLinks = document.querySelectorAll('a[aria-label*="Remove the filter"]');
  for (const link of removeFilterLinks) {
    const ariaLabel = link.getAttribute('aria-label');
    if (ariaLabel) {
      const filterMatch = ariaLabel.match(/Remove the filter ([A-Za-z0-9\s\.]+) to/i);
      if (filterMatch) {
        const filterValue = filterMatch[1].trim();
        const parentContainer = link.closest('#filter-p_123, #filter-p_n_size_browse-vebin, #filter-p_n_size_two_browse-vebin');
        
        if (parentContainer) {
          const containerId = parentContainer.id;
          
          // Check based on container ID first, then fallback to content analysis
          if (containerId.includes('p_123')) {
            // This is the brand section, but double-check it's not a misplaced size
            if (!isSize(filterValue) && !isColor(filterValue) && !filters.brands.includes(filterValue)) {
              filters.brands.push(filterValue);
              console.log(`[Content Script] Found brand via fallback method: ${filterValue}`);
            } else if (isSize(filterValue) && !filters.sizes.includes(filterValue)) {
              // Size value found in brand section - add to sizes instead
              filters.sizes.push(filterValue);
              console.log(`[Content Script] Found misplaced size in brand section, corrected: ${filterValue}`);
            }
          } else if (containerId.includes('size_browse') && !filters.sizes.includes(filterValue)) {
            filters.sizes.push(filterValue);
            console.log(`[Content Script] Found size via fallback method: ${filterValue}`);
          } else if (containerId.includes('size_two_browse') && !filters.colors.includes(filterValue)) {
            filters.colors.push(filterValue);
            console.log(`[Content Script] Found color via fallback method: ${filterValue}`);
          }
        } else {
          // No parent container found, analyze the content
          if (isSize(filterValue) && !filters.sizes.includes(filterValue)) {
            filters.sizes.push(filterValue);
            console.log(`[Content Script] Found size via content analysis: ${filterValue}`);
          } else if (isColor(filterValue) && !filters.colors.includes(filterValue)) {
            filters.colors.push(filterValue);
            console.log(`[Content Script] Found color via content analysis: ${filterValue}`);
          } else if (!filters.brands.includes(filterValue)) {
            filters.brands.push(filterValue);
            console.log(`[Content Script] Found brand via content analysis: ${filterValue}`);
          }
        }
      }
    }
  }

  console.log("[Content Script] Enhanced Amazon filter detection complete");
  console.log("[Content Script] Final extracted Amazon filters:", {
    brands: filters.brands,
    sizes: filters.sizes,
    colors: filters.colors,
    totalFilters: filters.brands.length + filters.sizes.length + filters.colors.length
  });
  
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
      } else if (hostname === 'luxury.tatacliq.com') {
        filters = await getLuxuryTataCliqFilters();
      } else if (hostname.includes('tatacliq.com')) {
        filters = await getTataCliqFilters();
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
      } else if (hostname === 'luxury.tatacliq.com') {
        filters = await getLuxuryTataCliqFilters();
      } else if (hostname.includes('tatacliq.com')) {
        filters = await getTataCliqFilters();
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

    // Store original requested filters for toast comparison
    const requestedFilters = {
      brands: [...normalizedFilters.brands],
      sizes: [...normalizedFilters.sizes], 
      colors: [...normalizedFilters.colors]
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
    } else if (hostname === 'luxury.tatacliq.com') {
      console.log("[Content Script] Applying filters on Luxury TataCliq");
      result = await applyCrossSiteFilters(normalizedFilters, 'luxury-tatacliq');
    } else if (hostname.includes('tatacliq.com')) {
      console.log("[Content Script] Applying filters on TataCliq");
      result = await applyCrossSiteFilters(normalizedFilters, 'tatacliq');
    }
    
    // Show toast notification for unmatched filters after a short delay
    setTimeout(() => {
      try {
        if (result && result.results) {
          showUnmatchedFiltersToast(requestedFilters, result.results);
        } else {
          console.warn("[Content Script] No results available for toast notification");
        }
      } catch (toastError) {
        console.error("[Content Script] Error showing toast notification:", toastError);
      }
    }, 1000); // Small delay to ensure filter application is fully complete
    
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
    } else if (hostname === 'luxury.tatacliq.com') {
      const luxuryFilterItems = document.querySelectorAll('.plp-filter-module__plpFilerItem');
      const brandFilter = document.querySelector('.plp-filter-module__plpFilerItemHead[aria-label="Brand"]');
      const colorFilter = document.querySelector('.plp-filter-module__plpFilerItemHead[aria-label="Colour"]');
      const sizeFilter = document.querySelector('.plp-filter-module__plpFilerItemHead[aria-label="Size"]');
      
      if (luxuryFilterItems.length > 0 || brandFilter || colorFilter || sizeFilter) {
        console.log("[Content Script] Found Luxury TataCliq filter elements");
        return true;
      }
    } else if (hostname.includes('tatacliq.com')) {
      const brandFilters = document.querySelector('.FilterDesktop__newFilterBlock');
      const colorFilters = document.querySelector('.ColourSelectPLP__base');
      const filterItems = document.querySelector('.FilterSelect__item');
      
      if (brandFilters || colorFilters || filterItems) {
        console.log("[Content Script] Found TataCliq filter elements");
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
    } else if (site === 'luxury-tatacliq') {
      result = await applyLuxuryTataCliqFilters(filters);
    } else if (site === 'tatacliq') {
      result = await applyTataCliqFilters(filters);
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

// Update applyBrandFilters to handle cross-site brand matching better
async function applyBrandFilters(brands, site) {
  console.log(`[Content Script] Applying brand filters:`, brands);
  let appliedCount = 0;
  let successfulBrands = [];
  
  // Enhanced matching function for cross-site compatibility
  const enhancedBrandMatch = (brandName, optionText) => {
    if (!brandName || !optionText) return false;
    
    const brandLower = brandName.toLowerCase().trim();
    const optionLower = optionText.toLowerCase().trim();
    
    // Remove common suffixes and prefixes
    const cleanBrand = brandLower.replace(/\s*(brand|brands|inc|ltd|limited|corp|corporation|co|company)\s*$/g, '').trim();
    const cleanOption = optionLower.replace(/\s*(brand|brands|inc|ltd|limited|corp|corporation|co|company)\s*$/g, '').trim();
    
    // Exact match (highest priority)
    if (cleanBrand === cleanOption) return true;
    
    // Contains match (both directions)
    if (cleanBrand.includes(cleanOption) || cleanOption.includes(cleanBrand)) return true;
    
    // Word-based matching for multi-word brands
    const brandWords = cleanBrand.split(/\s+/).filter(w => w.length > 2);
    const optionWords = cleanOption.split(/\s+/).filter(w => w.length > 2);
    
    // Check if all significant words from shorter brand name are in longer one
    const shorterWords = brandWords.length <= optionWords.length ? brandWords : optionWords;
    const longerWords = brandWords.length > optionWords.length ? brandWords : optionWords;
    
    if (shorterWords.length > 0) {
      const matchCount = shorterWords.filter(word => 
        longerWords.some(lWord => lWord.includes(word) || word.includes(lWord))
      ).length;
      
      // Consider it a match if at least 70% of words match
      return (matchCount / shorterWords.length) >= 0.7;
    }
    
    return false;
  };
  
  for (const brand of brands) {
    let brandName = typeof brand === 'string' ? brand : brand.text;
    console.log(`[Content Script] Attempting to apply brand filter: ${brandName}`);
    
    // Try up to 3 times for each brand
    let brandApplied = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Content Script] Brand "${brandName}" - Attempt ${attempt}/3`);
        
        if (site === 'myntra') {
          // First check if brand is already applied using enhanced matching
          const filterList = document.querySelector('.filter-summary-filterList');
          if (filterList) {
            const existingFilter = Array.from(filterList.querySelectorAll('.filter-summary-filter'))
              .find(filter => {
                const filterText = filter.textContent.trim();
                return enhancedBrandMatch(brandName, filterText);
              });
            
            if (existingFilter) {
              console.log(`[Content Script] Brand already applied: ${brandName}`);
              appliedCount++;
              successfulBrands.push(brandName);
              brandApplied = true;
              break;
            }
          }

          // Find and select the brand in the vertical filters with enhanced matching
          const brandOptions = document.querySelectorAll('.brand-list label');
          let brandFound = false;
          
          for (const option of brandOptions) {
            const optionText = option.textContent.trim();
            // Extract just the brand name (remove count numbers in parentheses)
            const cleanOptionText = optionText.replace(/\s*\(\d+\)\s*$/, '').trim();
            
            // Use enhanced matching for brands
            if (enhancedBrandMatch(brandName, cleanOptionText)) {
              console.log(`[Content Script] Found matching brand option: "${cleanOptionText}" for "${brandName}"`);
              const checkbox = option.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                brandFound = true;
                
                // Wait and verify the checkbox was checked
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                if (checkbox.checked) {
                  console.log(`[Content Script] Successfully checked brand: ${brandName}`);
                  appliedCount++;
                  successfulBrands.push(brandName);
                  brandApplied = true;
                  
                  // Additional wait for filter to be processed
                  await new Promise(resolve => setTimeout(resolve, 1500));
                }
                break;
              } else if (checkbox && checkbox.checked) {
                console.log(`[Content Script] Brand already checked: ${brandName}`);
                appliedCount++;
                successfulBrands.push(brandName);
                brandApplied = true;
                break;
              }
            }
          }
          
          if (!brandFound) {
            console.warn(`[Content Script] Brand option not found in main list: ${brandName}`);
            // Try the "Show More" modal if brand not found in main section
            const moreButton = document.querySelector('.brand-more');
            if (moreButton) {
              console.log(`[Content Script] Clicking .brand-more to open modal for brand: ${brandName}`);
              moreButton.click();
              // Wait for modal to appear, retry up to 5 times
              let modal = null;
              for (let i = 0; i < 5; i++) {
                modal = document.querySelector('.FilterDirectory-panel.FilterDirectory-expanded');
                if (modal) {
                  console.log(`[Content Script] Modal found on attempt ${i + 1}`);
                  break;
                }
                await new Promise(resolve => setTimeout(resolve, 700));
              }
              if (modal) {
                // Find the brand in the modal with enhanced matching
                const modalBrandInputs = modal.querySelectorAll('.FilterDirectory-list input[type="checkbox"]');
                let modalBrandFound = false;
                for (const input of modalBrandInputs) {
                  const label = input.closest('label');
                  const brandText = label?.textContent.trim();
                  
                  if (brandText) {
                    // Extract just the brand name (remove count numbers in parentheses)
                    const cleanBrandText = brandText.replace(/\s*\(\d+\)\s*$/, '').trim();
                    
                    // Use enhanced matching for brands in modal
                    if (enhancedBrandMatch(brandName, cleanBrandText)) {
                      console.log(`[Content Script] Found matching brand in modal: "${cleanBrandText}" for "${brandName}"`);
                      if (!input.checked) {
                        input.click();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        if (input.checked) {
                          console.log(`[Content Script] Successfully checked brand in modal: ${brandName}`);
                          appliedCount++;
                          successfulBrands.push(brandName);
                          brandApplied = true;
                          modalBrandFound = true;
                        }
                      } else {
                        console.log(`[Content Script] Brand already checked in modal: ${brandName}`);
                        appliedCount++;
                        successfulBrands.push(brandName);
                        brandApplied = true;
                        modalBrandFound = true;
                      }
                      break;
                    }
                  }
                }
                if (!modalBrandFound) {
                  console.warn(`[Content Script] Brand not found in modal either: ${brandName}`);
                }
                // Close the modal by clicking the close button
                const closeBtn = modal.querySelector('.FilterDirectory-close');
                if (closeBtn) {
                  closeBtn.click();
                  await new Promise(resolve => setTimeout(resolve, 700));
                }
              } else {
                console.error(`[Content Script] Modal did not open for brand filters`);
              }
            } else {
              console.warn(`[Content Script] .brand-more button not found for brands`);
            }
          }
        } 
        else if (site === 'ajio') {
          // Check existing filters
          const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
          if (appliedFilters) {
            const existingFilter = Array.from(appliedFilters.querySelectorAll('.fnl-plp-afliter'))
              .find(filter => {
                const filterText = filter.querySelector('.pull-left')?.textContent.trim();
                return enhancedBrandMatch(brandName, filterText);
              });
            
            if (existingFilter) {
              console.log(`[Content Script] Brand already applied: ${brandName}`);
              appliedCount++;
              successfulBrands.push(brandName);
              brandApplied = true;
              break;
            }
          }

          // First, find and expand the brand facet section
          console.log(`[Content Script] Looking for brand facet section`);
          const brandFacet = document.querySelector('.cat-facets .facet-left-pane-label[aria-label="brands"]');
          if (brandFacet) {
            console.log(`[Content Script] Found brand facet, expanding for: ${brandName}`);
            
            // Ensure facet is expanded by clicking the header
            const facetHead = brandFacet.closest('.facet-head');
            if (facetHead) {
              // Check if it's already expanded
              const facetBody = facetHead.nextElementSibling;
              if (!facetBody || facetBody.style.display === 'none' || !facetBody.querySelector('.facet-linkfref')) {
                console.log(`[Content Script] Expanding brand facet`);
                facetHead.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
              } else {
                console.log(`[Content Script] Brand facet already expanded`);
              }
            }
            
            // Now look for the brand in the visible options using enhanced matching
            const brandOptions = document.querySelectorAll('.facet-linkname-brand');
            let brandFound = false;
            
            for (const option of brandOptions) {
              const optionText = option.textContent.trim();
              // Extract just the brand name (remove count numbers in parentheses)
              const cleanOptionText = optionText.replace(/\s*\(\d+\)\s*$/, '').trim();
              
              if (enhancedBrandMatch(brandName, cleanOptionText)) {
                console.log(`[Content Script] Found matching brand option: "${cleanOptionText}" for "${brandName}"`);
                const checkbox = option.closest('.facet-linkfref').querySelector('input[type="checkbox"]');
                if (checkbox && !checkbox.checked) {
                  checkbox.click();
                  brandFound = true;
                  
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  
                  if (checkbox.checked) {
                    console.log(`[Content Script] Successfully applied brand: ${brandName}`);
                    appliedCount++;
                    successfulBrands.push(brandName);
                    brandApplied = true;
                    
                    // Additional wait for page update
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                  break;
                } else if (checkbox && checkbox.checked) {
                  console.log(`[Content Script] Brand already checked: ${brandName}`);
                  appliedCount++;
                  successfulBrands.push(brandName);
                  brandApplied = true;
                  break;
                }
              }
            }
            
            if (!brandFound) {
              console.warn(`[Content Script] Brand option not found in main list: ${brandName}`);
              
              // Try the "Show More" modal if brand not found in main section
              console.log(`[Content Script] Looking for MORE button in brand section`);
              
              // Look for the MORE button specifically within the brand facet
              const brandSection = brandFacet.closest('.cat-facets');
              const moreButton = brandSection?.querySelector('.facet-more[aria-label="MORE"]');
              
              if (moreButton) {
                console.log(`[Content Script] Found MORE button, clicking to open modal`);
                moreButton.click();
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for modal
                
                // Wait for modal to appear with multiple selector attempts
                let modal = null;
                for (let i = 0; i < 5; i++) {
                  modal = document.querySelector('.modal-content .more-popup-container') || 
                          document.querySelector('.more-popup-container') ||
                          document.querySelector('[class*="modal"]');
                  if (modal) {
                    console.log(`[Content Script] Modal found on attempt ${i + 1}`);
                    break;
                  }
                  console.log(`[Content Script] Waiting for modal, attempt ${i + 1}`);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                if (modal) {
                  console.log(`[Content Script] Modal opened successfully, searching for brand: ${brandName}`);
                  
                  // Search for the brand in the modal using enhanced matching
                  const modalBrandInputs = modal.querySelectorAll('input[name="brand"]');
                  let modalBrandFound = false;
                  
                  console.log(`[Content Script] Found ${modalBrandInputs.length} brand inputs in modal`);
                  
                  for (const input of modalBrandInputs) {
                    const label = input.closest('label');
                    const brandText = label?.querySelector('.facet-list-title-name')?.textContent.trim();
                    
                    if (brandText && enhancedBrandMatch(brandName, brandText)) {
                      console.log(`[Content Script] Found matching brand in modal: "${brandText}" for "${brandName}"`);
                      
                      if (!input.checked) {
                        console.log(`[Content Script] Clicking brand checkbox in modal`);
                        input.click();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        if (input.checked) {
                          console.log(`[Content Script] Successfully selected brand in modal: ${brandName}`);
                          modalBrandFound = true;
                          
                          // Click the Apply button - use specific selectors for AJIO brand modal
                          const applyButton = modal.querySelector('button.rilrtl-button--apply[aria-label="Apply"]') ||
                                            modal.querySelector('.apply-popup-button.rilrtl-button--filter-footer-action') ||
                                            modal.querySelector('.rilrtl-button.apply-popup-button') ||
                                            modal.querySelector('button[aria-label="Apply"]') ||
                                            modal.querySelector('button[type="submit"]');
                          
                          if (applyButton) {
                            console.log(`[Content Script] Clicking Apply button in modal`);
                            applyButton.click();
                            await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for modal to close and filter to apply
                            
                            appliedCount++;
                            successfulBrands.push(brandName);
                            brandApplied = true;
                            console.log(`[Content Script] Successfully applied brand from modal: ${brandName}`);
                          } else {
                            console.error(`[Content Script] Apply button not found in modal`);
                            // Try to close modal anyway
                            const closeButton = document.querySelector('#closeBtn') || 
                                               modal.querySelector('[aria-label="close icon"]');
                            if (closeButton) {
                              closeButton.click();
                              await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                          }
                        }
                      } else {
                        console.log(`[Content Script] Brand already selected in modal: ${brandName}`);
                        // Click Apply anyway to close modal
                        const applyButton = modal.querySelector('button.rilrtl-button--apply[aria-label="Apply"]') ||
                                          modal.querySelector('.apply-popup-button.rilrtl-button--filter-footer-action') ||
                                          modal.querySelector('.rilrtl-button.apply-popup-button') ||
                                          modal.querySelector('button[aria-label="Apply"]') ||
                                          modal.querySelector('button[type="submit"]');
                        if (applyButton) {
                          applyButton.click();
                          await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        appliedCount++;
                        successfulBrands.push(brandName);
                        brandApplied = true;
                      }
                      break;
                    }
                  }
                  
                  if (!modalBrandFound) {
                    console.warn(`[Content Script] Brand not found in modal either: ${brandName}`);
                    // Close modal by clicking close button
                    const closeButton = document.querySelector('#closeBtn') || 
                                       modal.querySelector('[aria-label="close icon"]') ||
                                       document.querySelector('.ic-close-quickview');
                    if (closeButton) {
                      console.log(`[Content Script] Closing modal - brand not found`);
                      closeButton.click();
                      await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                  }
                } else {
                  console.error(`[Content Script] Modal did not open for brand filters`);
                }
              } else {
                console.warn(`[Content Script] MORE button not found for brands`);
              }
            }
          } else {
            console.error(`[Content Script] Brand facet section not found`);
          }
        }
        
        if (brandApplied) {
          break; // Exit retry loop if successful
        }
        
      } catch (error) {
        console.error(`[Content Script] Error applying brand filter ${brandName} (attempt ${attempt}):`, error);
        if (attempt < 3) {
          console.log(`[Content Script] Retrying brand ${brandName} in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!brandApplied) {
      console.error(`[Content Script] Failed to apply brand filter after 3 attempts: ${brandName}`);
    }
    
    // Wait between different brands to avoid overwhelming the page
    if (brands.indexOf(brand) < brands.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`[Content Script] Brand filter results: ${appliedCount}/${brands.length} applied successfully`);
  console.log(`[Content Script] Successfully applied brands:`, successfulBrands);
  
  return {
    success: appliedCount > 0,
    appliedCount,
    totalCount: brands.length,
    appliedFilters: successfulBrands,
    failedFilters: brands.filter(b => !successfulBrands.includes(typeof b === 'string' ? b : b.text))
  };
}

// Update applyColorFilters with similar improvements
async function applyColorFilters(colors, site) {
  console.log(`[Content Script] Applying color filters:`, colors);
  let appliedCount = 0;
  let successfulColors = [];
  
  for (const color of colors) {
    let colorValue = typeof color === 'string' ? color : color.text;
    console.log(`[Content Script] Attempting to apply color filter: ${colorValue}`);
    
    let colorApplied = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Content Script] Color "${colorValue}" - Attempt ${attempt}/3`);
        
        if (site === 'myntra') {
          // Check if color is already applied first
          const filterList = document.querySelector('.filter-summary-filterList');
          if (filterList) {
            const existingFilter = Array.from(filterList.querySelectorAll('.filter-summary-filter'))
              .find(filter => filter.textContent.trim().toLowerCase() === colorValue.toLowerCase());
            
            if (existingFilter) {
              console.log(`[Content Script] Color already applied: ${colorValue}`);
              appliedCount++;
              successfulColors.push(colorValue);
              colorApplied = true;
              break;
            }
          }

          // First try to find color in the main visible list
          const colorOptions = document.querySelectorAll('.colour-listItem label');
          let colorFound = false;
          
          for (const option of colorOptions) {
            const optionText = option.textContent.trim().toLowerCase();
            const colorNameLower = colorValue.toLowerCase();
            
            // Extract just the color name (remove count numbers in parentheses)
            const cleanOptionText = optionText.replace(/\s*\(\d+\)\s*$/, '').trim();
            
            // Use exact matching for colors
            if (cleanOptionText === colorNameLower) {
              console.log(`[Content Script] Found exact match for color: ${colorValue}`);
              const checkbox = option.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log(`[Content Script] Applied color: ${colorValue}`);
                  appliedCount++;
                  successfulColors.push(colorValue);
                  colorApplied = true;
                colorFound = true;
                break;
              }
            }
          }
          
          // If not found in main list, try the "Show More" functionality
          if (!colorFound) {
            console.log(`[Content Script] Color not found in main list, trying Show More: ${colorValue}`);
            const moreButton = document.querySelector('.colour-more');
            if (moreButton) {
              console.log(`[Content Script] Clicking Show More button for colors`);
              moreButton.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Now search in the expanded list
              const expandedColorOptions = document.querySelectorAll('.colour-listItem label');
              console.log(`[Content Script] Found ${expandedColorOptions.length} color options after expanding`);
              
              for (const option of expandedColorOptions) {
                const optionText = option.textContent.trim().toLowerCase();
                const colorNameLower = colorValue.toLowerCase();
                
                // Extract just the color name (remove count numbers in parentheses)
                const cleanOptionText = optionText.replace(/\s*\(\d+\)\s*$/, '').trim();
                
                // Use exact matching for colors
                if (cleanOptionText === colorNameLower) {
                  console.log(`[Content Script] Found exact match for color in expanded list: ${colorValue}`);
                  const checkbox = option.querySelector('input[type="checkbox"]');
                  if (checkbox && !checkbox.checked) {
                    checkbox.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    console.log(`[Content Script] Applied color from expanded list: ${colorValue}`);
                appliedCount++;
                successfulColors.push(colorValue);
                colorApplied = true;
                    colorFound = true;
                break;
                  }
                }
              }
            }
          }
          
          if (!colorFound) {
            console.warn(`[Content Script] Color option not found: ${colorValue}`);
            failedColors.push(colorValue);
          }
        }
        else if (site === 'ajio') {
          // Check existing filters
          const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
          if (appliedFilters) {
            const existingFilter = Array.from(appliedFilters.querySelectorAll('.fnl-plp-afliter'))
              .find(filter => filter.querySelector('.pull-left').textContent.trim() === colorValue);
            
            if (existingFilter) {
              console.log(`[Content Script] Color already applied: ${colorValue}`);
              appliedCount++;
              successfulColors.push(colorValue);
              colorApplied = true;
              break;
            }
          }

          // Apply color filter
          const colorFacet = document.querySelector('.cat-facets .facet-left-pane-label[aria-label="colors"]');
          if (colorFacet) {
            console.log(`[Content Script] Expanding color facet for: ${colorValue}`);
            colorFacet.closest('.facet-head').click();
            await new Promise(resolve => setTimeout(resolve, 1500));

            // First try to find color in the main visible list
            const colorOptions = document.querySelectorAll('.facet-linkname-verticalcolorfamily');
            let colorFound = false;
            
            for (const option of colorOptions) {
              const optionText = option.textContent.trim();
              // Extract just the color name (remove count numbers in parentheses)
              const cleanOptionText = optionText.replace(/\s*\(\d+\)\s*$/, '').trim();
              
              // Use exact matching for colors
              if (cleanOptionText.toLowerCase() === colorValue.toLowerCase()) {
                console.log(`[Content Script] Found exact match for color: ${colorValue}`);
                const checkbox = option.closest('.facet-linkfref').querySelector('input[type="checkbox"]');
                if (checkbox) {
                  if (!checkbox.checked) {
                    // Color not selected, click to select it
                    checkbox.click();
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    console.log(`[Content Script] Applied color: ${colorValue}`);
                    appliedCount++;
                    successfulColors.push(colorValue);
                    colorApplied = true;
                    colorFound = true;
                    break;
                  } else {
                    // Color already selected
                    console.log(`[Content Script] Color already applied: ${colorValue}`);
                    appliedCount++;
                    successfulColors.push(colorValue);
                    colorApplied = true;
                    colorFound = true;
                    break;
                  }
                }
              }
            }
            
            // If not found in main list, try the "Show More" modal
            if (!colorFound) {
              console.log(`[Content Script] Color not found in main list, trying Show More: ${colorValue}`);
              const moreButton = document.querySelector('#verticalsizegroupformat-verticalcolorfamily.facet-more');
              if (moreButton) {
                console.log(`[Content Script] Clicking Show More button for colors`);
                moreButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Wait for modal to appear
            const colorModal = document.querySelector('.more-popup-container');
            if (colorModal) {
                  console.log(`[Content Script] Color modal opened, searching for: ${colorValue}`);
                  
                  // Find the color in the modal
                  const modalColorInputs = colorModal.querySelectorAll('input[name="verticalcolorfamily"]');
                  let modalColorFound = false;
                  
                  for (const input of modalColorInputs) {
                  const label = input.closest('label');
                    const colorName = label?.querySelector('.facet-list-title-name')?.textContent.trim();
                    
                    if (colorName) {
                      // Use exact matching for colors
                      if (colorName.toLowerCase() === colorValue.toLowerCase()) {
                        console.log(`[Content Script] Found exact match for color in modal: ${colorValue}`);
                        
                        if (!input.checked) {
                          input.click();
                await new Promise(resolve => setTimeout(resolve, 500));
                
                          // Click the Apply button - use specific selectors for AJIO color modal
                          const applyButton = colorModal.querySelector('button.rilrtl-button--apply[aria-label="Apply"]') ||
                                            colorModal.querySelector('.apply-popup-button.rilrtl-button--filter-footer-action') ||
                                            colorModal.querySelector('.rilrtl-button.apply-popup-button') ||
                                            colorModal.querySelector('button[aria-label="Apply"]') ||
                                            colorModal.querySelector('button[type="submit"]');
                          
                if (applyButton) {
                            console.log(`[Content Script] Clicking Apply button in color modal`);
                  applyButton.click();
                            await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for modal to close and filter to apply
                            
                  appliedCount++;
                  successfulColors.push(colorValue);
                  colorApplied = true;
                            modalColorFound = true;
                            break;
              }
            } else {
                          console.log(`[Content Script] Color already selected in modal: ${colorValue}`);
                          // Click Apply anyway to close modal
                          const applyButton = colorModal.querySelector('button.rilrtl-button--apply[aria-label="Apply"]') ||
                                            colorModal.querySelector('.apply-popup-button.rilrtl-button--filter-footer-action') ||
                                            colorModal.querySelector('.rilrtl-button.apply-popup-button') ||
                                            colorModal.querySelector('button[aria-label="Apply"]') ||
                                            colorModal.querySelector('button[type="submit"]');
                          if (applyButton) {
                            applyButton.click();
                            await new Promise(resolve => setTimeout(resolve, 2000));
                          }
                    appliedCount++;
                    successfulColors.push(colorValue);
                    colorApplied = true;
                          modalColorFound = true;
                    break;
                  }
                }
                    }
                  }
                  
                  if (!modalColorFound) {
                    console.warn(`[Content Script] Color not found in modal: ${colorValue}`);
                    // Close modal if color not found
                    const closeButton = colorModal.querySelector('#closeBtn, .ic-close-quickview');
                    if (closeButton) {
                      closeButton.click();
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                  }
                } else {
                  console.warn(`[Content Script] Color modal did not open for: ${colorValue}`);
                }
              } else {
                console.warn(`[Content Script] Show More button not found for colors`);
              }
            }
          }
        }
        
        if (colorApplied) {
          break;
        }
        
      } catch (error) {
        console.error(`[Content Script] Error applying color filter ${colorValue} (attempt ${attempt}):`, error);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!colorApplied) {
      console.error(`[Content Script] Failed to apply color filter after 3 attempts: ${colorValue}`);
    }
    
    if (colors.indexOf(color) < colors.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`[Content Script] Color filter results: ${appliedCount}/${colors.length} applied successfully`);
  console.log(`[Content Script] Successfully applied colors:`, successfulColors);
  
  return {
    success: appliedCount > 0,
    appliedCount,
    totalCount: colors.length,
    appliedFilters: successfulColors,
    failedFilters: colors.filter(c => !successfulColors.includes(typeof c === 'string' ? c : c.text))
  };
}

// Update applySizeFilters with similar improvements
async function applySizeFilters(sizes, site) {
  console.log(`[Content Script] Applying size filters:`, sizes);
  let appliedCount = 0;
  let successfulSizes = [];
  
  for (const size of sizes) {
    let sizeValue = typeof size === 'string' ? size : size.text;
    console.log(`[Content Script] Attempting to apply size filter: ${sizeValue}`);
    
    let sizeApplied = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Content Script] Size "${sizeValue}" - Attempt ${attempt}/3`);
        
        if (site === 'myntra') {
          // Check existing size filters
          const filterList = document.querySelector('.filter-summary-filterList');
          if (filterList) {
            const existingFilter = Array.from(filterList.querySelectorAll('.filter-summary-filter'))
              .find(filter => {
                const filterInput = filter.querySelector('input[type="checkbox"]');
                return filterInput?.dataset.group === 'size_facet' && 
                       filter.textContent.trim().includes(sizeValue);
              });
            
            if (existingFilter) {
              console.log(`[Content Script] Size already applied: ${sizeValue}`);
              appliedCount++;
              successfulSizes.push(sizeValue);
              sizeApplied = true;
              break;
            }
          }

          // Apply size filter through horizontal filters
          const sizeFilter = document.querySelector('.atsa-filters li label input[value="size_facet"]');
          if (sizeFilter) {
            console.log(`[Content Script] Expanding size filter for: ${sizeValue}`);
            sizeFilter.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const sizeOptions = document.querySelectorAll('.atsa-values label');
            let sizeFound = false;
            
            for (const option of sizeOptions) {
              const optionText = option.textContent.trim().toLowerCase();
              if (optionText === sizeValue.toLowerCase()) {
                console.log(`[Content Script] Found matching size option: ${optionText}`);
                const checkbox = option.querySelector('input[type="checkbox"]');
                if (checkbox && !checkbox.checked) {
                  checkbox.click();
                  sizeFound = true;
                  
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  if (checkbox.checked) {
                    console.log(`[Content Script] Successfully applied size: ${sizeValue}`);
                    appliedCount++;
                    successfulSizes.push(sizeValue);
                    sizeApplied = true;
                    await new Promise(resolve => setTimeout(resolve, 1500));
                  }
                  break;
                } else if (checkbox && checkbox.checked) {
                  appliedCount++;
                  successfulSizes.push(sizeValue);
                  sizeApplied = true;
                  break;
                }
              }
            }
            
            if (!sizeFound) {
              console.warn(`[Content Script] Size option not found: ${sizeValue}`);
            }
          }
        }
        else if (site === 'ajio') {
          // Similar logic for AJIO sizes
          const appliedFilters = document.querySelector('.fnl-plp-appliedFliters');
          if (appliedFilters) {
            const existingFilter = Array.from(appliedFilters.querySelectorAll('.fnl-plp-afliter'))
              .find(filter => filter.querySelector('.pull-left').textContent.trim() === sizeValue);
            
            if (existingFilter) {
              console.log(`[Content Script] Size already applied: ${sizeValue}`);
              appliedCount++;
              successfulSizes.push(sizeValue);
              sizeApplied = true;
              break;
            }
          }

          const sizeFacet = document.querySelector('.cat-facets .facet-left-pane-label[aria-label="size & fit"]');
          if (sizeFacet) {
            console.log(`[Content Script] Expanding size facet for: ${sizeValue}`);
            sizeFacet.closest('.facet-head').click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const sizeOptions = document.querySelectorAll('.facet-linkname-verticalsizegroupformat');
            for (const option of sizeOptions) {
              const optionText = option.textContent.trim();
              // Extract just the size value (remove count numbers in parentheses)
              const cleanOptionText = optionText.replace(/\s*\(\d+\)\s*$/, '').trim();
              
              // Use exact matching for sizes to prevent "L" from matching "XL"
              if (cleanOptionText === sizeValue) {
                console.log(`[Content Script] Found exact match for size: ${sizeValue}`);
                const checkbox = option.closest('.facet-linkfref').querySelector('input[type="checkbox"]');
                if (checkbox && !checkbox.checked) {
                  checkbox.click();
                  appliedCount++;
                  successfulSizes.push(sizeValue);
                  sizeApplied = true;
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  break;
                }
              }
            }
          }
        }
        
        if (sizeApplied) {
          break;
        }
        
      } catch (error) {
        console.error(`[Content Script] Error applying size filter ${sizeValue} (attempt ${attempt}):`, error);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!sizeApplied) {
      console.error(`[Content Script] Failed to apply size filter after 3 attempts: ${sizeValue}`);
    }
    
    if (sizes.indexOf(size) < sizes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`[Content Script] Size filter results: ${appliedCount}/${sizes.length} applied successfully`);
  console.log(`[Content Script] Successfully applied sizes:`, successfulSizes);
  
  return {
    success: appliedCount > 0,
    appliedCount,
    totalCount: sizes.length,
    appliedFilters: successfulSizes,
    failedFilters: sizes.filter(s => !successfulSizes.includes(typeof s === 'string' ? s : s.text))
  };
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
        // For brand filters, get the text content more precisely
        // Try to get the brand name from the label or span, excluding the remove button
        let brandText = '';
        
        // Method 1: Try to get from the label text
        const label = item.querySelector('label');
        if (label) {
          // Get text nodes only, excluding child elements like the remove button
          const textNodes = Array.from(label.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent.trim())
            .join(' ')
            .trim();
          if (textNodes) {
            brandText = textNodes;
          }
        }
        
        // Method 2: If no label, try to get from span or direct text
        if (!brandText) {
          const span = item.querySelector('span:not(.filter-summary-close)');
          if (span) {
            brandText = span.textContent.trim();
          }
        }
        
        // Method 3: Fallback to full text content but clean it
        if (!brandText) {
          brandText = item.textContent.trim()
            .replace(/×/g, '') // Remove close button
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        }
        
        if (brandText && !filters.brands.includes(brandText)) {
          filters.brands.push(brandText);
          console.log(`[Content Script] Added brand from filter summary: ${brandText}`);
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

  // Also check for brand filters in the vertical filters (as backup)
  const brandCheckboxes = document.querySelectorAll('.brand-list input[type="checkbox"]:checked');
  for (const checkbox of brandCheckboxes) {
    const brandText = checkbox.value;
    if (brandText && !filters.brands.includes(brandText)) {
      filters.brands.push(brandText);
      console.log(`[Content Script] Added brand from checkbox: ${brandText}`);
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

    // Enhanced helper function to determine if a text is a size
    const isSize = (text) => {
      // Match UK sizes
      if (text.match(/^UK \d+$/i)) return true;
      // Match standard letter sizes (S, M, L, XL, XXL, etc.)
      if (text.match(/^(XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)$/i)) return true;
      // Match numeric sizes (including single and double digits)
      if (text.match(/^(\d{1,2}|one size)$/i)) return true;
      // Match special size codes like OS (One Size), FS (Free Size), etc.
      if (text.match(/^(OS|FS|Free Size|One Size)$/i)) return true;
      return false;
    };

    // Enhanced helper function to determine if a text is a color
    const isColor = (text) => {
      return text.match(/^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Navy|Maroon|Olive|Teal|Cyan|Magenta|Gold|Silver|Bronze|Multicolor|Printed|Striped|Floral|Geometric|Abstract|Animal Print|Camouflage|Tie & Dye|Ombre|Metallic|Glitter|Holographic|Neon|Pastel|Vintage|Washed|Faded|Distressed|Embellished|Sequined|Beaded|Quilted|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace)$/i);
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
            // Fallback to text-based detection with improved logic
            if (isSize(filterText)) {
              if (!filters.sizes.includes(filterText)) {
                filters.sizes.push(filterText);
                console.log(`[Content Script] Added size (by pattern): ${filterText}`);
              }
            } else if (isColor(filterText)) {
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
      
      // Check for brands - first ensure brand facet is expanded
      const brandFacet = document.querySelector('.cat-facets .facet-left-pane-label[aria-label="brands"]');
      if (brandFacet) {
        console.log("[Content Script] Found brand facet, ensuring it's expanded");
        const facetHead = brandFacet.closest('.facet-head');
        if (facetHead) {
          // Check if it's already expanded
          const facetBody = facetHead.nextElementSibling;
          if (!facetBody || facetBody.style.display === 'none' || !facetBody.querySelector('.facet-linkfref')) {
            console.log("[Content Script] Expanding brand facet for filter detection");
            facetHead.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      // Now check for brands
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
      
      // Also check for brands in the modal if it's open
      const modal = document.querySelector('.modal-content .more-popup-container');
      if (modal) {
        console.log("[Content Script] Modal is open, checking for selected brands in modal");
        const modalBrandInputs = modal.querySelectorAll('input[name="brand"]:checked');
        for (const input of modalBrandInputs) {
          try {
            const label = input.closest('label');
            const brandText = label?.querySelector('.facet-list-title-name')?.textContent.trim();
            if (brandText && !filters.brands.includes(brandText)) {
              filters.brands.push(brandText);
              console.log(`[Content Script] Added brand from modal: ${brandText}`);
            }
          } catch (error) {
            console.error("[Content Script] Error getting brand from modal checkbox:", error);
          }
        }
      }
      
      // Check for sizes - specifically look for UK sizes and other size formats
      const sizeCheckboxes = document.querySelectorAll('input[name="verticalsizegroupformat"]:checked');
      for (const checkbox of sizeCheckboxes) {
        try {
          const label = checkbox.closest('.facet-linkfref')?.querySelector('.facet-linkname-verticalsizegroupformat')?.textContent.trim();
          if (label) {
            // Extract just the size value (e.g., "UK 2 (61)" -> "UK 2", "6 (45)" -> "6")
            const sizeMatch = label.match(/^(UK \d+|\d+|OS|FS|Free Size|One Size)/i);
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
  
  // Also reset any filters in modal if it's open
  const modal = document.querySelector('.modal-content .more-popup-container');
  if (modal) {
    console.log("[Content Script] Modal is open, resetting modal filters");
    const modalCheckboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
    for (const checkbox of modalCheckboxes) {
      try {
        if (checkbox.checked) {
          checkbox.click();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error("[Content Script] Error resetting modal filter:", error);
      }
    }
    
    // Close the modal
    const closeButton = modal.closest('.modal-content').querySelector('#closeBtn');
    if (closeButton) {
      console.log("[Content Script] Closing modal after reset");
      closeButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log("[Content Script] Reset complete");
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Myntra-specific filter application
async function applyMyntraFilters(filters) {
  console.log("[Content Script] Applying Myntra filters:", filters);
  
  try {
    // Clear existing filters first
    await resetMyntraFilters();
    
    let results = {
      brands: { success: false, appliedCount: 0, totalCount: 0, appliedFilters: [], failedFilters: [] },
      sizes: { success: false, appliedCount: 0, totalCount: 0, appliedFilters: [], failedFilters: [] },
      colors: { success: false, appliedCount: 0, totalCount: 0, appliedFilters: [], failedFilters: [] }
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      console.log("[Content Script] Starting brand filters application for Myntra");
      results.brands = await applyBrandFilters(filters.brands, 'myntra');
      
      // Wait between filter types
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      console.log("[Content Script] Starting size filters application for Myntra");
      results.sizes = await applySizeFilters(filters.sizes, 'myntra');
      
      // Wait between filter types
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      console.log("[Content Script] Starting color filters application for Myntra");
      results.colors = await applyColorFilters(filters.colors, 'myntra');
      
      // Wait for final processing
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Calculate overall results
    const totalRequested = results.brands.totalCount + results.sizes.totalCount + results.colors.totalCount;
    const totalApplied = results.brands.appliedCount + results.sizes.appliedCount + results.colors.appliedCount;
    const overallSuccess = totalApplied > 0;
    const partialSuccess = totalApplied < totalRequested && totalApplied > 0;

    console.log("[Content Script] Myntra filter application complete:", {
      totalRequested,
      totalApplied,
      brands: results.brands,
      sizes: results.sizes,
      colors: results.colors
    });

    return {
      success: overallSuccess,
      partialSuccess: partialSuccess,
      results: results,
      summary: {
        totalRequested,
        totalApplied,
        appliedFilters: {
          brands: results.brands.appliedFilters,
          sizes: results.sizes.appliedFilters,
          colors: results.colors.appliedFilters
        },
        failedFilters: {
          brands: results.brands.failedFilters,
          sizes: results.sizes.failedFilters,
          colors: results.colors.failedFilters
        }
      }
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
    
    let results = {
      brands: { success: false, appliedCount: 0, totalCount: 0, appliedFilters: [], failedFilters: [] },
      sizes: { success: false, appliedCount: 0, totalCount: 0, appliedFilters: [], failedFilters: [] },
      colors: { success: false, appliedCount: 0, totalCount: 0, appliedFilters: [], failedFilters: [] }
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      console.log("[Content Script] Starting brand filters application for Ajio");
      results.brands = await applyBrandFilters(filters.brands, 'ajio');
      
      // Wait between filter types
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      console.log("[Content Script] Starting size filters application for Ajio");
      results.sizes = await applySizeFilters(filters.sizes, 'ajio');
      
      // Wait between filter types
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      console.log("[Content Script] Starting color filters application for Ajio");
      results.colors = await applyColorFilters(filters.colors, 'ajio');
      
      // Wait for final processing
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Calculate overall results
    const totalRequested = results.brands.totalCount + results.sizes.totalCount + results.colors.totalCount;
    const totalApplied = results.brands.appliedCount + results.sizes.appliedCount + results.colors.appliedCount;
    const overallSuccess = totalApplied > 0;
    const partialSuccess = totalApplied < totalRequested && totalApplied > 0;

    console.log("[Content Script] Ajio filter application complete:", {
      totalRequested,
      totalApplied,
      brands: results.brands,
      sizes: results.sizes,
      colors: results.colors
    });

    return {
      success: overallSuccess,
      partialSuccess: partialSuccess,
      results: results,
      summary: {
        totalRequested,
        totalApplied,
        appliedFilters: {
          brands: results.brands.appliedFilters,
          sizes: results.sizes.appliedFilters,
          colors: results.colors.appliedFilters
        },
        failedFilters: {
          brands: results.brands.failedFilters,
          sizes: results.sizes.failedFilters,
          colors: results.colors.failedFilters
        }
      }
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

// Amazon-specific filter application
async function applyAmazonFilters(filters) {
  console.log("[Content Script] Applying Amazon filters:", filters);
  
  try {
    // Normalize filter values - handle both string and object formats
    const normalizedFilters = {
      brands: (filters.brands || []).map(b => typeof b === 'string' ? b : b.text || b.value || b),
      sizes: (filters.sizes || []).map(s => typeof s === 'string' ? s : s.text || s.value || s),
      colors: (filters.colors || []).map(c => typeof c === 'string' ? c : c.text || c.value || c)
    };
    
    console.log("[Content Script] Normalized Amazon filters:", normalizedFilters);
    
    // Store original requested filters for toast comparison
    const requestedFilters = {
      brands: [...normalizedFilters.brands],
      sizes: [...normalizedFilters.sizes], 
      colors: [...normalizedFilters.colors]
    };
    
    let results = {
      brands: { success: false, appliedCount: 0, totalCount: normalizedFilters.brands.length, appliedFilters: [], failedFilters: [] },
      sizes: { success: false, appliedCount: 0, totalCount: normalizedFilters.sizes.length, appliedFilters: [], failedFilters: [] },
      colors: { success: false, appliedCount: 0, totalCount: normalizedFilters.colors.length, appliedFilters: [], failedFilters: [] }
    };

    // Enhanced helper function to wait for element and click with retries
    const waitAndClick = async (element, description, maxRetries = 2) => {
      if (!element) {
        console.warn(`[Content Script] ${description} not found`);
        return false;
      }
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
          console.log(`[Content Script] Attempting to click ${description} (attempt ${attempt}/${maxRetries})`);
          
          // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Check if element is clickable
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            console.warn(`[Content Script] Element not visible: ${description}`);
            if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            return false;
          }
          
          // Click the element
        element.click();
          console.log(`[Content Script] Successfully clicked ${description}`);
          
          // Wait for page to update
          await new Promise(resolve => setTimeout(resolve, 2500));
        return true;
          
      } catch (error) {
          console.error(`[Content Script] Error clicking ${description} (attempt ${attempt}):`, error);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
      
      console.error(`[Content Script] Failed to click ${description} after ${maxRetries} attempts`);
      return false;
    };

    // Enhanced matching function with multiple matching strategies
    const enhancedMatch = (value, candidate) => {
      if (!value || !candidate) return { match: false, score: 0 };
      
      const valueNormalized = value.toLowerCase().trim();
      const candidateNormalized = candidate.toLowerCase().trim();
      
      // Exact match (highest priority)
      if (valueNormalized === candidateNormalized) {
        return { match: true, score: 100 };
      }
      
      // Exact match ignoring case and extra spaces
      if (valueNormalized.replace(/\s+/g, ' ') === candidateNormalized.replace(/\s+/g, ' ')) {
        return { match: true, score: 95 };
      }
      
      // Contains match (both directions)
      if (valueNormalized.includes(candidateNormalized) || candidateNormalized.includes(valueNormalized)) {
        return { match: true, score: 80 };
      }
      
      // Word-based matching (for multi-word brands/values)
      const valueWords = valueNormalized.split(/\s+/);
      const candidateWords = candidateNormalized.split(/\s+/);
      
      const matchingWords = valueWords.filter(word => 
        word.length > 2 && candidateWords.some(cWord => 
          cWord.includes(word) || word.includes(cWord)
        )
      );
      
      if (matchingWords.length > 0) {
        const score = (matchingWords.length / Math.max(valueWords.length, candidateWords.length)) * 70;
        return { match: score > 35, score: Math.round(score) };
      }
      
      return { match: false, score: 0 };
    };

    // Generic filter application function with enhanced logic
    const applyFilterType = async (filterValues, filterType, selectorConfig) => {
      if (!filterValues || filterValues.length === 0) return;
      
      console.log(`[Content Script] Starting Amazon ${filterType} filter application for values:`, filterValues);
      
      // Wait for filter section to be available
      let filterSection = document.querySelector(selectorConfig.containerSelector);
      let attempts = 0;
      while (!filterSection && attempts < 5) {
        console.log(`[Content Script] Waiting for ${filterType} filter section (attempt ${attempts + 1}/5)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        filterSection = document.querySelector(selectorConfig.containerSelector);
        attempts++;
      }
      
      if (!filterSection) {
        console.warn(`[Content Script] ${filterType} filter section not found on Amazon`);
        results[filterType].failedFilters.push(...filterValues);
        return;
      }
      
      for (const filterValue of filterValues) {
        console.log(`[Content Script] Processing Amazon ${filterType} filter: ${filterValue}`);
        
        let appliedSuccessfully = false;
        
        // Check if filter is already applied
        const appliedFilter = document.querySelector(`${selectorConfig.containerSelector} [aria-current="true"]`);
        if (appliedFilter) {
          const appliedText = selectorConfig.textExtractor(appliedFilter);
          if (appliedText && enhancedMatch(filterValue, appliedText).match) {
            console.log(`[Content Script] ${filterType} filter already applied: ${filterValue}`);
            results[filterType].appliedFilters.push(filterValue);
            results[filterType].appliedCount++;
            appliedSuccessfully = true;
            continue;
          }
        }
        
        // Get all available filter options
        const filterElements = Array.from(document.querySelectorAll(selectorConfig.itemSelector));
        console.log(`[Content Script] Found ${filterElements.length} ${filterType} filter options`);
        
        if (filterElements.length === 0) {
          console.warn(`[Content Script] No ${filterType} filter options found`);
          results[filterType].failedFilters.push(filterValue);
          continue;
        }
        
        // Find matching filters with scoring
        const matches = filterElements.map(element => {
          const text = selectorConfig.textExtractor(element);
          const matchResult = enhancedMatch(filterValue, text);
          return { element, text, ...matchResult };
        }).filter(item => item.match).sort((a, b) => b.score - a.score);
        
        console.log(`[Content Script] Found ${matches.length} potential matches for ${filterValue}:`, 
                   matches.slice(0, 3).map(m => `"${m.text}" (score: ${m.score})`));
        
        if (matches.length > 0) {
          const bestMatch = matches[0];
          console.log(`[Content Script] Best match for ${filterValue}: "${bestMatch.text}" (score: ${bestMatch.score})`);
          
          const success = await waitAndClick(bestMatch.element, `${filterType} filter: ${bestMatch.text}`);
          
          if (success) {
            results[filterType].appliedFilters.push(filterValue);
            results[filterType].appliedCount++;
            appliedSuccessfully = true;
            console.log(`[Content Script] Successfully applied Amazon ${filterType} filter: ${filterValue}`);
            
            // Wait between filter applications to avoid overwhelming the page
            await new Promise(resolve => setTimeout(resolve, 1500));
          } else {
            console.error(`[Content Script] Failed to apply ${filterType} filter: ${filterValue}`);
            results[filterType].failedFilters.push(filterValue);
          }
        } else {
          console.warn(`[Content Script] No matching ${filterType} filter found for: ${filterValue}`);
          results[filterType].failedFilters.push(filterValue);
        }
        
        // Small delay between different filter values
        if (!appliedSuccessfully) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      results[filterType].success = results[filterType].appliedCount > 0;
      console.log(`[Content Script] ${filterType} filter application complete: ${results[filterType].appliedCount}/${results[filterType].totalCount} applied`);
    };

    // Configuration for different filter types with enhanced selectors
    const filterConfigs = {
      brands: {
        containerSelector: '#filter-p_123, #brandsRefinements',
        itemSelector: '#filter-p_123 .a-link-normal.s-navigation-item, #filter-p_123 .a-button-selected, #filter-p_123 a[aria-current="true"]',
        textExtractor: (element) => {
          // Try multiple extraction methods for brands
          return element.querySelector('.a-size-base.a-color-base')?.textContent.trim() ||
                 element.querySelector('.a-size-base')?.textContent.trim() ||
                 element.querySelector('.a-button-text')?.textContent.trim() ||
                 element.textContent.trim() ||
                 element.getAttribute('aria-label') ||
                 '';
        }
      },
      colors: {
        containerSelector: '#filter-p_n_size_two_browse-vebin, #p_n_size_two_browse-vebin/2022042031',
        itemSelector: '#filter-p_n_size_two_browse-vebin .a-link-normal.s-navigation-item, #filter-p_n_size_two_browse-vebin a[aria-current="true"], #filter-p_n_size_two_browse-vebin .colorsprite',
        textExtractor: (element) => {
          // Try multiple extraction methods for colors
          const parentLink = element.closest('a') || element;
          const title = parentLink.getAttribute('title');
          const ariaLabel = parentLink.getAttribute('aria-label');
          const textContent = element.querySelector('.a-size-base.a-color-base')?.textContent.trim();
          
          // Handle aria-label extraction for "Remove the filter X to expand results" format
          if (ariaLabel && ariaLabel.includes('filter')) {
            const colorMatch = ariaLabel.match(/(?:filter|the)\s+([A-Za-z\s]+)\s+to/i);
            if (colorMatch) {
              return colorMatch[1].trim();
            }
          }
          
          return title || textContent || ariaLabel || '';
        }
      },
      sizes: {
        containerSelector: '#filter-p_n_size_browse-vebin, #sizeRefinements',
        itemSelector: '#filter-p_n_size_browse-vebin .a-link-normal.s-navigation-item, #filter-p_n_size_browse-vebin .a-button-selected, #filter-p_n_size_browse-vebin button[aria-pressed="true"], #filter-p_n_size_browse-vebin a[aria-current="true"]',
        textExtractor: (element) => {
          // Try multiple extraction methods for sizes
          const button = element.querySelector('button');
          const sizeFromButton = button?.textContent.trim() || button?.getAttribute('aria-label');
          const sizeFromSpan = element.querySelector('.a-size-base.a-color-base, .a-size-base, .a-button-text')?.textContent.trim();
          const sizeFromAria = element.getAttribute('aria-label');
          
          // Handle aria-label extraction for "Remove the filter X to expand results" format
          if (sizeFromAria && sizeFromAria.includes('filter')) {
            const sizeMatch = sizeFromAria.match(/(?:filter|the)\s+([A-Za-z0-9\.\s]+)\s+to/i);
            if (sizeMatch) {
              return sizeMatch[1].trim();
            }
          }
          
          return sizeFromButton || sizeFromSpan || sizeFromAria || element.textContent.trim() || '';
        }
      }
    };

    // Apply filters in order: brands first, then colors, then sizes
    await applyFilterType(normalizedFilters.brands, 'brands', filterConfigs.brands);
    await applyFilterType(normalizedFilters.colors, 'colors', filterConfigs.colors);
    await applyFilterType(normalizedFilters.sizes, 'sizes', filterConfigs.sizes);

    // Calculate overall results
    const totalRequested = results.brands.totalCount + results.sizes.totalCount + results.colors.totalCount;
    const totalApplied = results.brands.appliedCount + results.sizes.appliedCount + results.colors.appliedCount;
    const overallSuccess = totalApplied > 0;
    const partialSuccess = totalApplied < totalRequested && totalApplied > 0;

    console.log("[Content Script] Amazon filter application complete:", {
      totalRequested,
      totalApplied,
      brands: results.brands,
      sizes: results.sizes,
      colors: results.colors
    });

    // Show toast notification for unmatched filters after a short delay
    setTimeout(() => {
      try {
        showUnmatchedFiltersToast(requestedFilters, results);
      } catch (toastError) {
        console.error("[Content Script] Error showing Amazon toast notification:", toastError);
      }
    }, 1000);

    return {
      success: overallSuccess,
      partialSuccess: partialSuccess,
      results: results,
      summary: {
        totalRequested,
        totalApplied,
        appliedFilters: {
          brands: results.brands.appliedFilters,
          sizes: results.sizes.appliedFilters,
          colors: results.colors.appliedFilters
        },
        failedFilters: {
          brands: results.brands.failedFilters,
          sizes: results.sizes.failedFilters,
          colors: results.colors.failedFilters
        }
      }
    };
  } catch (error) {
    console.error("[Content Script] Error applying Amazon filters:", error);
    throw error;
  }
}

// Flipkart-specific functions (get filters function is already implemented above)
async function getFlipkartFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  // Enhanced helper function to determine if a text is a size
  const isSize = (text) => {
    // Match standard letter sizes (S, M, L, XL, XXL, etc.)
    if (text.match(/^(XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)$/i)) return true;
    // Match numeric sizes (including single and double digits with optional decimal)
    if (text.match(/^(\d{1,2}(\.\d+)?)$/i)) return true;
    // Match special size codes like OS (One Size), FS (Free Size), etc.
    if (text.match(/^(OS|FS|Free Size|One Size)$/i)) return true;
    return false;
  };

  // Enhanced helper function to determine if a text is a color
  const isColor = (text) => {
    return text.match(/^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Navy|Maroon|Olive|Teal|Cyan|Magenta|Gold|Silver|Bronze|Multicolor|Printed|Striped|Floral|Geometric|Abstract|Animal Print|Camouflage|Tie & Dye|Ombre|Metallic|Glitter|Holographic|Neon|Pastel|Vintage|Washed|Faded|Distressed|Embellished|Sequined|Beaded|Quilted|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace)$/i);
  };

  // First check the summary section for applied filters
  const summarySection = document.querySelector('section[class*="pgRLLn"]');
  if (summarySection) {
    const appliedFilters = summarySection.querySelectorAll('.YcSYyC');
    for (const filter of appliedFilters) {
      const filterText = filter.querySelector('._6tw8ju')?.textContent.trim();
      if (filterText) {
        // Use enhanced pattern matching to determine filter type
        if (isSize(filterText)) {
          filters.sizes.push(filterText);
          console.log(`[Content Script] Added Flipkart size: ${filterText}`);
        } else if (isColor(filterText)) {
          filters.colors.push(filterText);
          console.log(`[Content Script] Added Flipkart color: ${filterText}`);
        } else {
          // Assume it's a brand if it doesn't match size or color patterns
          filters.brands.push(filterText);
          console.log(`[Content Script] Added Flipkart brand: ${filterText}`);
        }
      }
    }
  }

  console.log("[Content Script] Extracted Flipkart filters:", filters);
  return filters;
}

// Flipkart-specific filter application
async function applyFlipkartFilters(filters) {
  console.log("[Content Script] Applying Flipkart filters:", filters);
  
  try {
    // Store original requested filters for toast comparison
    const requestedFilters = {
      brands: Array.isArray(filters.brands) ? [...filters.brands] : [],
      sizes: Array.isArray(filters.sizes) ? [...filters.sizes] : [],
      colors: Array.isArray(filters.colors) ? [...filters.colors] : []
    };
    
    let results = {
      brands: { success: false, appliedCount: 0, totalCount: (filters.brands || []).length, appliedFilters: [], failedFilters: [] },
      sizes: { success: false, appliedCount: 0, totalCount: (filters.sizes || []).length, appliedFilters: [], failedFilters: [] },
      colors: { success: false, appliedCount: 0, totalCount: (filters.colors || []).length, appliedFilters: [], failedFilters: [] }
    };

    // Helper function to simulate clicks
    const simulateClick = (element) => {
      const events = [
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
        new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
      ];
      events.forEach(event => element.dispatchEvent(event));
    };

    // Clear all filters first
    const clearAllButton = document.querySelector('.aOfogh span');
    if (clearAllButton) {
      console.log("[Content Script] Clearing existing Flipkart filters");
      simulateClick(clearAllButton);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Helper function to apply filter with retries
    const applyFilterWithRetries = async (filterValue, type, maxRetries = 3) => {
      // Enhanced matching function for cross-site compatibility (same as in applyBrandFilters)
      const enhancedBrandMatch = (brandName, optionText) => {
        if (!brandName || !optionText) return false;
        
        const brandLower = brandName.toLowerCase().trim();
        const optionLower = optionText.toLowerCase().trim();
        
        // Remove common suffixes and prefixes
        const cleanBrand = brandLower.replace(/\s*(brand|brands|inc|ltd|limited|corp|corporation|co|company)\s*$/g, '').trim();
        const cleanOption = optionLower.replace(/\s*(brand|brands|inc|ltd|limited|corp|corporation|co|company)\s*$/g, '').trim();
        
        // Exact match (highest priority)
        if (cleanBrand === cleanOption) return true;
        
        // Contains match (both directions)
        if (cleanBrand.includes(cleanOption) || cleanOption.includes(cleanBrand)) return true;
        
        // Word-based matching for multi-word brands
        const brandWords = cleanBrand.split(/\s+/).filter(w => w.length > 2);
        const optionWords = cleanOption.split(/\s+/).filter(w => w.length > 2);
        
        // Check if all significant words from shorter brand name are in longer one
        const shorterWords = brandWords.length <= optionWords.length ? brandWords : optionWords;
        const longerWords = brandWords.length > optionWords.length ? brandWords : optionWords;
        
        if (shorterWords.length > 0) {
          const matchCount = shorterWords.filter(word => 
            longerWords.some(lWord => lWord.includes(word) || word.includes(lWord))
          ).length;
          
          // Consider it a match if at least 70% of words match
          return (matchCount / shorterWords.length) >= 0.7;
        }
        
        return false;
      };

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Content Script] Applying Flipkart ${type} filter: ${filterValue} (attempt ${attempt})`);
          
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

          if (!filterSection) {
            console.warn(`[Content Script] ${type} filter section not found for Flipkart`);
            return false;
          }

          // Expand section if needed
          const header = filterSection.querySelector('.FtQCb2');
          if (header) {
            const isExpanded = filterSection.querySelector('.SDsN9S');
            if (!isExpanded) {
              simulateClick(header);
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }

          // Find and click the filter - use enhanced matching for brands
          const filterElements = filterSection.querySelectorAll('.ewzVkT[class*="_3DvUAf"]');
          for (const element of filterElements) {
            const text = element.querySelector('[class*="_6i1qKy"]')?.textContent.trim();
            if (text) {
              const isMatch = type === 'brand' ? 
                enhancedBrandMatch(filterValue, text) : 
                text.toLowerCase() === filterValue.toLowerCase();
              
              if (isMatch) {
                console.log(`[Content Script] Found matching ${type}: "${text}" for "${filterValue}"`);
                const checkbox = element.querySelector('input[type="checkbox"]');
                if (checkbox) {
                  if (!checkbox.checked) {
                    simulateClick(checkbox);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    if (checkbox.checked) {
                      console.log(`[Content Script] Successfully applied Flipkart ${type} filter: ${filterValue}`);
                      return true;
                    }
                  } else {
                    console.log(`[Content Script] Flipkart ${type} filter already applied: ${filterValue}`);
                    return true;
                  }
                }
              }
            }
          }

          // Try "Click More" if not found
          const clickMoreButton = filterSection.querySelector('.e\\+xvXX.KvHRYS span');
          if (clickMoreButton) {
            console.log(`[Content Script] Clicking "More" for ${type} filters`);
            simulateClick(clickMoreButton);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if modal opened for brand filters
            if (type === 'brand') {
              // Try multiple selectors for the modal
              let modal = document.querySelector('.YyuWF2') || 
                         document.querySelector('[class*="modal"]') ||
                         document.querySelector('.nt6sNV'); // Alternative Flipkart modal class
              
              // Wait a bit more if modal not found immediately
              if (!modal) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                modal = document.querySelector('.YyuWF2') || 
                       document.querySelector('[class*="modal"]') ||
                       document.querySelector('.nt6sNV');
              }
              
              if (modal) {
                console.log(`[Content Script] Brand modal opened, searching for: ${filterValue}`);
                
                // Find the brand in the modal with enhanced matching
                const modalBrandElements = modal.querySelectorAll('.ewzVkT, ._3DvUAf, [class*="ewzVkT"]');
                let modalBrandFound = false;
                
                console.log(`[Content Script] Found ${modalBrandElements.length} brand elements in modal`);
                
                for (const element of modalBrandElements) {
                  const brandText = element.querySelector('._6i1qKy, [class*="_6i1qKy"], .facet-list-title-name')?.textContent.trim() ||
                                   element.querySelector('span')?.textContent.trim() ||
                                   element.textContent.trim();
                  
                  if (brandText && enhancedBrandMatch(filterValue, brandText)) {
                    console.log(`[Content Script] Found matching brand in modal: "${brandText}" for "${filterValue}"`);
                    const checkbox = element.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                      if (!checkbox.checked) {
                        // Brand not selected, click to select it
                        console.log(`[Content Script] Selecting brand in modal: ${filterValue}`);
                        simulateClick(checkbox);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        if (checkbox.checked) {
                          console.log(`[Content Script] Successfully selected brand in modal: ${filterValue}`);
                          modalBrandFound = true;
                        }
                      } else {
                        console.log(`[Content Script] Brand already selected in modal: ${filterValue}`);
                        modalBrandFound = true;
                      }
                      
                      if (modalBrandFound) {
                        // Click Apply Filters button with multiple selectors
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        const applyButton = modal.querySelector('.q58xaq.M8zy8w span') ||
                                          modal.querySelector('button[type="submit"] span') ||
                                          modal.querySelector('.apply-button span') ||
                                          modal.querySelector('[class*="apply"] span') ||
                                          modal.querySelector('button span');
                        
                        if (applyButton) {
                          console.log(`[Content Script] Clicking Apply Filters button in modal`);
                          simulateClick(applyButton.parentElement || applyButton);
                          await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for modal to close and filter to apply
                          
                          // Verify the filter was applied by checking if modal closed
                          const modalStillOpen = document.querySelector('.YyuWF2') || 
                                               document.querySelector('[class*="modal"]') ||
                                               document.querySelector('.nt6sNV');
                          
                          if (!modalStillOpen) {
                            console.log(`[Content Script] Modal closed successfully, filter applied: ${filterValue}`);
                            return true;
                          } else {
                            console.warn(`[Content Script] Modal still open after applying filter`);
                            // Try to close it manually
                            const closeButton = modal.querySelector('.KlcTWG') ||
                                               modal.querySelector('[aria-label="close"]') ||
                                               modal.querySelector('.close-button');
                            if (closeButton) {
                              simulateClick(closeButton);
                              await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                          }
                        } else {
                          console.error(`[Content Script] Apply Filters button not found in modal`);
                          // Try different approach - look for any button that might apply
                          const allButtons = modal.querySelectorAll('button');
                          for (const btn of allButtons) {
                            const btnText = btn.textContent.toLowerCase();
                            if (btnText.includes('apply') || btnText.includes('done') || btnText.includes('save')) {
                              console.log(`[Content Script] Trying alternative apply button: "${btnText}"`);
                              simulateClick(btn);
                              await new Promise(resolve => setTimeout(resolve, 3000));
                              break;
                            }
                          }
                        }
                      }
                      break;
                    } else {
                      // Handle case where there's no checkbox (might be disabled brand)
                      const disabledElement = element.querySelector('.tJjCVx.TXuYBI');
                      if (disabledElement) {
                        console.log(`[Content Script] Brand is disabled in modal: ${filterValue}`);
                      } else {
                        console.warn(`[Content Script] No checkbox found for brand in modal: ${filterValue}`);
                      }
                    }
                  }
                }
                
                if (!modalBrandFound) {
                  console.warn(`[Content Script] Brand not found in modal: ${filterValue}`);
                  // Close modal if brand not found
                  const closeButton = modal.querySelector('.KlcTWG') ||
                                     modal.querySelector('[aria-label="close"]') ||
                                     modal.querySelector('.close-button');
                  if (closeButton) {
                    simulateClick(closeButton);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              } else {
                console.warn(`[Content Script] Brand modal did not open for: ${filterValue}`);
              }
            } else {
              // For non-brand filters, try the original expanded logic
              const expandedFilterElements = filterSection.querySelectorAll('.ewzVkT[class*="_3DvUAf"]');
              for (const element of expandedFilterElements) {
                const text = element.querySelector('[class*="_6i1qKy"]')?.textContent.trim();
                if (text && text.toLowerCase() === filterValue.toLowerCase()) {
                  const checkbox = element.querySelector('input[type="checkbox"]');
                  if (checkbox && !checkbox.checked) {
                    simulateClick(checkbox);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    if (checkbox.checked) {
                      console.log(`[Content Script] Successfully applied Flipkart ${type} filter after expanding: ${filterValue}`);
                      return true;
                    }
                  }
                }
              }
            }
          }

          if (attempt < maxRetries) {
            console.log(`[Content Script] Retrying Flipkart ${type} filter: ${filterValue}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`[Content Script] Error applying Flipkart ${type} filter ${filterValue} (attempt ${attempt}):`, error);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      console.warn(`[Content Script] Failed to apply Flipkart ${type} filter after ${maxRetries} attempts: ${filterValue}`);
      return false;
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      console.log("[Content Script] Starting Flipkart brand filter application");
      for (const brand of filters.brands) {
        const brandValue = typeof brand === 'string' ? brand : brand.text;
        const success = await applyFilterWithRetries(brandValue, 'brand');
        if (success) {
          results.brands.appliedFilters.push(brandValue);
          results.brands.appliedCount++;
        } else {
          results.brands.failedFilters.push(brandValue);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      results.brands.success = results.brands.appliedCount > 0;
    }

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      console.log("[Content Script] Starting Flipkart color filter application");
      for (const color of filters.colors) {
        const colorValue = typeof color === 'string' ? color : color.text;
        const success = await applyFilterWithRetries(colorValue, 'color');
        if (success) {
          results.colors.appliedFilters.push(colorValue);
          results.colors.appliedCount++;
        } else {
          results.colors.failedFilters.push(colorValue);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      results.colors.success = results.colors.appliedCount > 0;
    }

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      console.log("[Content Script] Starting Flipkart size filter application");
      for (const size of filters.sizes) {
        const sizeValue = typeof size === 'string' ? size : size.text;
        const success = await applyFilterWithRetries(sizeValue, 'size');
        if (success) {
          results.sizes.appliedFilters.push(sizeValue);
          results.sizes.appliedCount++;
        } else {
          results.sizes.failedFilters.push(sizeValue);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      results.sizes.success = results.sizes.appliedCount > 0;
    }

    // Calculate overall results
    const totalRequested = results.brands.totalCount + results.sizes.totalCount + results.colors.totalCount;
    const totalApplied = results.brands.appliedCount + results.sizes.appliedCount + results.colors.appliedCount;
    const overallSuccess = totalApplied > 0;
    const partialSuccess = totalApplied < totalRequested && totalApplied > 0;

    console.log("[Content Script] Flipkart filter application complete:", {
      totalRequested,
      totalApplied,
      brands: results.brands,
      sizes: results.sizes,
      colors: results.colors
    });

    // Show toast notification for unmatched filters after a short delay
    setTimeout(() => {
      try {
        showUnmatchedFiltersToast(requestedFilters, results);
      } catch (toastError) {
        console.error("[Content Script] Error showing Flipkart toast notification:", toastError);
      }
    }, 1000);

    return {
      success: overallSuccess,
      partialSuccess: partialSuccess,
      results: results,
      summary: {
        totalRequested,
        totalApplied,
        appliedFilters: {
          brands: results.brands.appliedFilters,
          sizes: results.sizes.appliedFilters,
          colors: results.colors.appliedFilters
        },
        failedFilters: {
          brands: results.brands.failedFilters,
          sizes: results.sizes.failedFilters,
          colors: results.colors.failedFilters
        }
      }
    };
  } catch (error) {
    console.error("[Content Script] Error applying Flipkart filters:", error);
    throw error;
  }
}

// Snapdeal-specific functions
async function getSnapdealFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  console.log("[Content Script] Extracting Snapdeal filters...");

  try {
    // Extract brand filters
    const brandSection = document.querySelector('[data-filtername="Brand"]');
    if (brandSection) {
      const brandFilters = brandSection.querySelectorAll('.filters-list.sdCheckbox .filter-value:checked');
      brandFilters.forEach(filter => {
        if (filter.value && filter.value.trim()) {
          filters.brands.push(filter.value.trim());
        }
      });
    }

    // Extract color filters
    const colorSection = document.querySelector('[data-filtername="Color_s"]');
    if (colorSection) {
      const colorFilters = colorSection.querySelectorAll('.filters-list.sdCheckbox .filter-value:checked');
      colorFilters.forEach(filter => {
        if (filter.value && filter.value.trim()) {
          filters.colors.push(filter.value.trim());
        }
      });
    }

    // Extract size filters
    const sizeSection = document.querySelector('[data-filtername="Size_s"]');
    if (sizeSection) {
      const sizeFilters = sizeSection.querySelectorAll('.filters-list.sdCheckbox .filter-value:checked');
      sizeFilters.forEach(filter => {
        if (filter.value && filter.value.trim()) {
          filters.sizes.push(filter.value.trim());
        }
      });
    }

    console.log("[Content Script] Extracted Snapdeal filters:", filters);
  } catch (error) {
    console.error("[Content Script] Error extracting Snapdeal filters:", error);
  }

  return filters;
}

async function applySnapdealFilters(filters) {
  console.log("[Content Script] Applying Snapdeal filters:", filters);
  
  let results = {
    brands: { success: false, appliedCount: 0, totalCount: (filters.brands || []).length, appliedFilters: [], failedFilters: [] },
    sizes: { success: false, appliedCount: 0, totalCount: (filters.sizes || []).length, appliedFilters: [], failedFilters: [] },
    colors: { success: false, appliedCount: 0, totalCount: (filters.colors || []).length, appliedFilters: [], failedFilters: [] }
  };

  try {
    // Clear existing filters first
    await resetSnapdealFilters();
    
    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      const brandResult = await applySnapdealBrandFilters(filters.brands);
      results.brands = brandResult;
    }

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      const colorResult = await applySnapdealColorFilters(filters.colors);
      results.colors = colorResult;
    }

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      const sizeResult = await applySnapdealSizeFilters(filters.sizes);
      results.sizes = sizeResult;
    }

    const totalSuccess = results.brands.success && results.colors.success && results.sizes.success;
    const partialSuccess = results.brands.appliedCount > 0 || results.colors.appliedCount > 0 || results.sizes.appliedCount > 0;

    console.log("[Content Script] Snapdeal filter application completed:", results);

    return {
      success: totalSuccess,
      partialSuccess: partialSuccess && !totalSuccess,
      results: results
    };

  } catch (error) {
    console.error("[Content Script] Error applying Snapdeal filters:", error);
    return {
      success: false,
      partialSuccess: false,
      results: results
    };
  }
}

async function applySnapdealBrandFilters(brands) {
  const result = {
    success: false,
    appliedCount: 0,
    totalCount: brands.length,
    appliedFilters: [],
    failedFilters: []
  };

  console.log("[Content Script] Applying Snapdeal brand filters:", brands);

  try {
    const brandSection = document.querySelector('[data-filtername="Brand"]');
    if (!brandSection) {
      console.log("[Content Script] Brand section not found");
      result.failedFilters = [...brands];
      return result;
    }

    for (const brand of brands) {
      let applied = false;
      
      // First check visible filters
      const visibleFilters = brandSection.querySelectorAll('.filters-list.sdCheckbox .filter-value');
      for (const filter of visibleFilters) {
        if (filter.value && filter.value.toLowerCase().trim() === brand.toLowerCase().trim()) {
          if (!filter.checked) {
            filter.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          result.appliedFilters.push(brand);
          result.appliedCount++;
          applied = true;
          break;
        }
      }

      // If not found in visible filters, try View More
      if (!applied) {
        const viewMoreButton = brandSection.querySelector('.view-more-button');
        if (viewMoreButton) {
          viewMoreButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Check in advanced filters modal
          const advModal = document.querySelector('.js-adv-filters');
          if (advModal) {
            const brandFilters = advModal.querySelectorAll('[data-filtername="Brand"] .filter-value');
            for (const filter of brandFilters) {
              if (filter.value && filter.value.toLowerCase().trim() === brand.toLowerCase().trim()) {
                if (!filter.checked) {
                  filter.click();
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
                result.appliedFilters.push(brand);
                result.appliedCount++;
                applied = true;
                break;
              }
            }

            // Click apply button in modal
            const applyButton = advModal.querySelector('.applyFilters');
            if (applyButton) {
              applyButton.click();
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      }

      if (!applied) {
        result.failedFilters.push(brand);
      }
    }

    result.success = result.appliedCount === brands.length;
    console.log("[Content Script] Brand filter application result:", result);

  } catch (error) {
    console.error("[Content Script] Error applying Snapdeal brand filters:", error);
    result.failedFilters = [...brands];
  }

  return result;
}

async function applySnapdealColorFilters(colors) {
  const result = {
    success: false,
    appliedCount: 0,
    totalCount: colors.length,
    appliedFilters: [],
    failedFilters: []
  };

  console.log("[Content Script] Applying Snapdeal color filters:", colors);

  try {
    const colorSection = document.querySelector('[data-filtername="Color_s"]');
    if (!colorSection) {
      console.log("[Content Script] Color section not found");
      result.failedFilters = [...colors];
      return result;
    }

    for (const color of colors) {
      let applied = false;
      
      // Check visible filters first
      const visibleFilters = colorSection.querySelectorAll('.filters-list.sdCheckbox .filter-value');
      for (const filter of visibleFilters) {
        if (filter.value && filter.value.toLowerCase().trim() === color.toLowerCase().trim()) {
          if (!filter.checked) {
            filter.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          result.appliedFilters.push(color);
          result.appliedCount++;
          applied = true;
          break;
        }
      }

      // If not found, try View More button
      if (!applied) {
        const viewMoreButton = colorSection.querySelector('.view-more-button, .viewMoreFilter');
        if (viewMoreButton) {
          viewMoreButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check in expanded view
          const expandedFilters = colorSection.querySelectorAll('.filters-list.sdCheckbox .filter-value');
          for (const filter of expandedFilters) {
            if (filter.value && filter.value.toLowerCase().trim() === color.toLowerCase().trim()) {
              if (!filter.checked) {
                filter.click();
                await new Promise(resolve => setTimeout(resolve, 300));
              }
              result.appliedFilters.push(color);
              result.appliedCount++;
              applied = true;
              break;
            }
          }
        }
      }

      if (!applied) {
        result.failedFilters.push(color);
      }
    }

    result.success = result.appliedCount === colors.length;
    console.log("[Content Script] Color filter application result:", result);

  } catch (error) {
    console.error("[Content Script] Error applying Snapdeal color filters:", error);
    result.failedFilters = [...colors];
  }

  return result;
}

async function applySnapdealSizeFilters(sizes) {
  const result = {
    success: false,
    appliedCount: 0,
    totalCount: sizes.length,
    appliedFilters: [],
    failedFilters: []
  };

  console.log("[Content Script] Applying Snapdeal size filters:", sizes);

  try {
    const sizeSection = document.querySelector('[data-filtername="Size_s"]');
    if (!sizeSection) {
      console.log("[Content Script] Size section not found");
      result.failedFilters = [...sizes];
      return result;
    }

    for (const size of sizes) {
      let applied = false;
      
      // Check visible filters first
      const visibleFilters = sizeSection.querySelectorAll('.filters-list.sdCheckbox .filter-value');
      for (const filter of visibleFilters) {
        if (filter.value && filter.value.toLowerCase().trim() === size.toLowerCase().trim()) {
          if (!filter.checked) {
            filter.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          result.appliedFilters.push(size);
          result.appliedCount++;
          applied = true;
          break;
        }
      }

      // If not found, try View More button
      if (!applied) {
        const viewMoreButton = sizeSection.querySelector('.view-more-button, .viewMoreFilter');
        if (viewMoreButton) {
          viewMoreButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check in expanded view
          const expandedFilters = sizeSection.querySelectorAll('.filters-list.sdCheckbox .filter-value');
          for (const filter of expandedFilters) {
            if (filter.value && filter.value.toLowerCase().trim() === size.toLowerCase().trim()) {
              if (!filter.checked) {
                filter.click();
                await new Promise(resolve => setTimeout(resolve, 300));
              }
              result.appliedFilters.push(size);
              result.appliedCount++;
              applied = true;
              break;
            }
          }
        }
      }

      if (!applied) {
        result.failedFilters.push(size);
      }
    }

    result.success = result.appliedCount === sizes.length;
    console.log("[Content Script] Size filter application result:", result);

  } catch (error) {
    console.error("[Content Script] Error applying Snapdeal size filters:", error);
    result.failedFilters = [...sizes];
  }

  return result;
}

async function resetSnapdealFilters() {
  console.log("[Content Script] Resetting Snapdeal filters...");
  
  try {
    // Reset brand filters
    const brandSection = document.querySelector('[data-filtername="Brand"]');
    if (brandSection) {
      const clearButton = brandSection.querySelector('.filter-clear');
      if (clearButton) {
        clearButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Reset color filters  
    const colorSection = document.querySelector('[data-filtername="Color_s"]');
    if (colorSection) {
      const clearButton = colorSection.querySelector('.filter-clear');
      if (clearButton) {
        clearButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Reset size filters
    const sizeSection = document.querySelector('[data-filtername="Size_s"]');
    if (sizeSection) {
      const clearButton = sizeSection.querySelector('.filter-clear');
      if (clearButton) {
        clearButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log("[Content Script] Snapdeal filters reset completed");
    return true;

  } catch (error) {
    console.error("[Content Script] Error resetting Snapdeal filters:", error);
    return false;
  }
}

// Toast notification system for showing unmatched filters
function createToastNotification(unmatchedFilters) {
  // Remove any existing toast
  const existingToast = document.getElementById('filter-saver-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast container
  const toast = document.createElement('div');
  toast.id = 'filter-saver-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #ffffff;
    color: #000000;
    padding: 16px 20px;
    border-radius: 12px;
    border-bottom: 3px solid #7C3AED;
    border-right: 3px solid #7C3AED;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-family: 'Courier New', Consolas, Monaco, monospace;
    font-size: 13px;
    line-height: 1.4;
    max-width: 350px;
    animation: slideInFromBottom 0.3s ease-out;
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInFromBottom {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    @keyframes slideOutToBottom {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Check if any filters were unmatched
  const hasUnmatchedBrands = unmatchedFilters.brands && unmatchedFilters.brands.length > 0;
  const hasUnmatchedSizes = unmatchedFilters.sizes && unmatchedFilters.sizes.length > 0;
  const hasUnmatchedColors = unmatchedFilters.colors && unmatchedFilters.colors.length > 0;
  const hasAnyUnmatched = hasUnmatchedBrands || hasUnmatchedSizes || hasUnmatchedColors;

  if (!hasAnyUnmatched) {
    // No unmatched filters, don't show toast
    return;
  }

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    font-weight: bold;
    margin-bottom: 12px;
    color: #7C3AED;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  `;
  header.innerHTML = `
    <span style="font-size: 16px;">❌</span>
    Filters not found on this site
  `;

  // Create content
  const content = document.createElement('div');
  content.style.cssText = `
    font-size: 12px;
    line-height: 1.6;
    color: #000000;
  `;

  const unmatchedItems = [];

  if (hasUnmatchedBrands) {
    unmatchedItems.push(`<div style="margin: 6px 0;"><span style="color: #7C3AED; font-weight: bold;">Brands:</span> ${unmatchedFilters.brands.join(', ')}</div>`);
  }

  if (hasUnmatchedSizes) {
    unmatchedItems.push(`<div style="margin: 6px 0;"><span style="color: #7C3AED; font-weight: bold;">Sizes:</span> ${unmatchedFilters.sizes.join(', ')}</div>`);
  }

  if (hasUnmatchedColors) {
    unmatchedItems.push(`<div style="margin: 6px 0;"><span style="color: #7C3AED; font-weight: bold;">Colors:</span> ${unmatchedFilters.colors.join(', ')}</div>`);
  }

  content.innerHTML = unmatchedItems.join('');

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: #666666;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    font-family: 'Courier New', Consolas, Monaco, monospace;
  `;
  closeButton.onmouseover = () => {
    closeButton.style.backgroundColor = '#f0f0f0';
    closeButton.style.color = '#000000';
  };
  closeButton.onmouseout = () => {
    closeButton.style.backgroundColor = 'transparent';
    closeButton.style.color = '#666666';
  };

  const removeToast = () => {
    toast.style.animation = 'slideOutToBottom 0.3s ease-in forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
      if (style.parentNode) {
        style.remove();
      }
    }, 300);
  };

  closeButton.onclick = removeToast;

  // Assemble toast
  toast.appendChild(header);
  toast.appendChild(content);
  toast.appendChild(closeButton);

  // Add to page
  document.body.appendChild(toast);

  // Auto-remove after 8 seconds
  setTimeout(removeToast, 8000);
}

function createNoMatchesToast() {
  // Remove any existing toast
  const existingToast = document.getElementById('filter-saver-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast container for "no matches found"
  const toast = document.createElement('div');
  toast.id = 'filter-saver-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #ffffff;
    color: #000000;
    padding: 16px 20px;
    border-radius: 12px;
    border-bottom: 3px solid #7C3AED;
    border-right: 3px solid #7C3AED;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-family: 'Courier New', Consolas, Monaco, monospace;
    font-size: 13px;
    line-height: 1.4;
    max-width: 350px;
    animation: slideInFromBottom 0.3s ease-out;
  `;

  // Add animation keyframes if not already added
  if (!document.querySelector('style[data-filter-saver-toast]')) {
    const style = document.createElement('style');
    style.setAttribute('data-filter-saver-toast', 'true');
    style.textContent = `
      @keyframes slideInFromBottom {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideOutToBottom {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Create content
  const content = document.createElement('div');
  content.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: bold;
    color: #000000;
  `;
  content.innerHTML = `
    <span style="font-size: 18px;">❌</span>
    No matching items or values found.
  `;

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: #666666;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    font-family: 'Courier New', Consolas, Monaco, monospace;
  `;
  closeButton.onmouseover = () => {
    closeButton.style.backgroundColor = '#f0f0f0';
    closeButton.style.color = '#000000';
  };
  closeButton.onmouseout = () => {
    closeButton.style.backgroundColor = 'transparent';
    closeButton.style.color = '#666666';
  };

  const removeToast = () => {
    toast.style.animation = 'slideOutToBottom 0.3s ease-in forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  };

  closeButton.onclick = removeToast;

  // Assemble toast
  toast.appendChild(content);
  toast.appendChild(closeButton);

  // Add to page
  document.body.appendChild(toast);

  // Auto-remove after 6 seconds
  setTimeout(removeToast, 6000);
}

// Helper function to show unmatched filters toast
function showUnmatchedFiltersToast(requestedFilters, appliedResults) {
  console.log("[Content Script] Checking for unmatched filters...");
  console.log("[Content Script] Requested filters:", requestedFilters);
  console.log("[Content Script] Applied results:", appliedResults);

  // Normalize requested filters to arrays of strings
  const normalizeFilters = (filters) => {
    if (!filters || !Array.isArray(filters)) return [];
    return filters.map(f => typeof f === 'string' ? f : (f.text || f.value || f.id || String(f)));
  };

  const requestedBrands = normalizeFilters(requestedFilters.brands);
  const requestedSizes = normalizeFilters(requestedFilters.sizes);
  const requestedColors = normalizeFilters(requestedFilters.colors);

  // Get applied filters from results
  const appliedBrands = normalizeFilters(appliedResults?.brands?.appliedFilters || []);
  const appliedSizes = normalizeFilters(appliedResults?.sizes?.appliedFilters || []);
  const appliedColors = normalizeFilters(appliedResults?.colors?.appliedFilters || []);

  // Calculate unmatched filters
  const unmatchedBrands = requestedBrands.filter(brand => 
    !appliedBrands.some(applied => applied.toLowerCase().trim() === brand.toLowerCase().trim())
  );
  const unmatchedSizes = requestedSizes.filter(size => 
    !appliedSizes.some(applied => applied.toLowerCase().trim() === size.toLowerCase().trim())
  );
  const unmatchedColors = requestedColors.filter(color => 
    !appliedColors.some(applied => applied.toLowerCase().trim() === color.toLowerCase().trim())
  );

  const totalRequested = requestedBrands.length + requestedSizes.length + requestedColors.length;
  const totalApplied = appliedBrands.length + appliedSizes.length + appliedColors.length;

  console.log("[Content Script] Unmatched analysis:", {
    totalRequested,
    totalApplied,
    unmatchedBrands,
    unmatchedSizes,
    unmatchedColors
  });

  // Show appropriate toast
  if (totalApplied === 0 && totalRequested > 0) {
    // No filters were applied at all
    console.log("[Content Script] No filters applied, showing no matches toast");
    createNoMatchesToast();
  } else if (unmatchedBrands.length > 0 || unmatchedSizes.length > 0 || unmatchedColors.length > 0) {
    // Some filters were not applied
    console.log("[Content Script] Some filters unmatched, showing unmatched filters toast");
    createToastNotification({
      brands: unmatchedBrands,
      sizes: unmatchedSizes,
      colors: unmatchedColors
    });
  } else {
    console.log("[Content Script] All requested filters were applied successfully");
  }
}

// TataCliq-specific functions
async function getTataCliqFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  console.log("[Content Script] Extracting TataCliq filters...");

  try {
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get brand filters - check for selected brands
    // Look for FilterSelect__contentSelected which indicates selected state
    const selectedBrandFilters = document.querySelectorAll('.FilterSelect__item .FilterSelect__contentSelected');
    for (const brandFilter of selectedBrandFilters) {
      const brandName = brandFilter.querySelector('.FilterSelect__data')?.textContent.trim();
      if (brandName && !filters.brands.includes(brandName)) {
        // Check if this is actually a brand (not a size) by checking parent context
        const parentSection = brandFilter.closest('.FilterDesktop__newFilterBlock');
        const sectionHeader = parentSection?.querySelector('.Accordion__headText')?.textContent.trim();
        
        if (sectionHeader && sectionHeader.toLowerCase().includes('brand')) {
          filters.brands.push(brandName);
          console.log(`[Content Script] Found TataCliq brand: ${brandName}`);
        } else if (sectionHeader && sectionHeader.toLowerCase().includes('size')) {
          // This is actually a size filter
          if (brandName && (brandName.includes('UK/IND') || brandName.includes('EURO') || /^\d+(\.\d+)?$/.test(brandName))) {
            if (!filters.sizes.includes(brandName)) {
              filters.sizes.push(brandName);
              console.log(`[Content Script] Found TataCliq size: ${brandName}`);
            }
          }
        }
      }
    }

    // Also check in brand modal if open for additional brand filters
    const brandModalItems = document.querySelectorAll('.ShowBrandModal__brandNameHolder');
    for (const modalItem of brandModalItems) {
      const checkbox = modalItem.querySelector('.CheckBox__checked');
      if (checkbox) {
        const brandName = modalItem.textContent.replace(/checkbox/g, '').trim();
        if (brandName && !filters.brands.includes(brandName)) {
          filters.brands.push(brandName);
          console.log(`[Content Script] Found TataCliq brand from modal: ${brandName}`);
        }
      }
    }

    // Get color filters - check for selected colors with ColourSelectPLP__textHolderActive
    const colorFilters = document.querySelectorAll('.ColourSelectPLP__base');
    for (const colorFilter of colorFilters) {
      const isSelected = colorFilter.querySelector('.ColourSelectPLP__textHolderActive');
      if (isSelected) {
        const colorId = colorFilter.id;
        if (colorId && colorId.startsWith('filter-color-')) {
          const colorName = colorId.replace('filter-color-', '');
          if (colorName && !filters.colors.includes(colorName)) {
            filters.colors.push(colorName);
            console.log(`[Content Script] Found TataCliq color: ${colorName}`);
          }
        }
      }
    }

    console.log("[Content Script] TataCliq filters extracted:", filters);
  } catch (error) {
    console.error("[Content Script] Error extracting TataCliq filters:", error);
  }

  return filters;
}

async function applyTataCliqFilters(filters) {
  console.log("[Content Script] Applying TataCliq filters:", filters);
  
  try {
    let results = {
      brands: { success: false, appliedCount: 0, totalCount: (filters.brands || []).length, appliedFilters: [], failedFilters: [] },
      sizes: { success: false, appliedCount: 0, totalCount: (filters.sizes || []).length, appliedFilters: [], failedFilters: [] },
      colors: { success: false, appliedCount: 0, totalCount: (filters.colors || []).length, appliedFilters: [], failedFilters: [] }
    };

    // Helper function to click on a filter with retries
    const clickFilterWithRetries = async (element, filterName, maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Content Script] Clicking TataCliq filter ${filterName} (attempt ${attempt})`);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 500));
          element.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          return true;
        } catch (error) {
          console.error(`[Content Script] Error clicking filter ${filterName} (attempt ${attempt}):`, error);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      return false;
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      console.log("[Content Script] Starting TataCliq brand filter application");
      
      for (const brand of filters.brands) {
        const brandValue = typeof brand === 'string' ? brand : brand.text;
        let applied = false;

        // Find the brand section first
        const brandSections = document.querySelectorAll('.FilterDesktop__newFilterBlock');
        let brandSection = null;
        
        for (const section of brandSections) {
          const sectionHeader = section.querySelector('.Accordion__headText')?.textContent.trim();
          if (sectionHeader && sectionHeader.toLowerCase().includes('brand')) {
            brandSection = section;
            break;
          }
        }

        if (brandSection) {
          // First, try to find the brand in the visible list within the brand section
          const visibleBrandItems = brandSection.querySelectorAll('.FilterSelect__item');
          for (const item of visibleBrandItems) {
            const brandText = item.querySelector('.FilterSelect__data')?.textContent.trim();
            if (brandText && brandText.toLowerCase() === brandValue.toLowerCase()) {
              const checkbox = item.querySelector('.FilterSelect__check .CheckBox__base');
              if (checkbox && !item.querySelector('.FilterSelect__contentSelected')) {
                const success = await clickFilterWithRetries(checkbox, brandValue);
                if (success) {
                  results.brands.appliedFilters.push(brandValue);
                  results.brands.appliedCount++;
                  applied = true;
                  break;
                }
              }
            }
          }

          // If not found in visible list, try to click "more" button within the brand section
          if (!applied) {
            const moreButton = brandSection.querySelector('#filter-brand-view-more');
            if (moreButton) {
              await clickFilterWithRetries(moreButton, 'brand more button');
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Search in modal
              const modalItems = document.querySelectorAll('.ShowBrandModal__brandNameHolder');
              for (const modalItem of modalItems) {
                const brandText = modalItem.textContent.replace(/checkbox/g, '').trim();
                if (brandText && brandText.toLowerCase() === brandValue.toLowerCase()) {
                  const checkbox = modalItem.querySelector('.CheckBox__square');
                  if (checkbox && !modalItem.querySelector('.CheckBox__checked')) {
                    const success = await clickFilterWithRetries(checkbox, brandValue);
                    if (success) {
                      results.brands.appliedFilters.push(brandValue);
                      results.brands.appliedCount++;
                      applied = true;
                      break;
                    }
                  }
                }
              }

              // Close modal if it's open
              const modalCloseButton = document.querySelector('.ShowBrandModal__footerElement .Button__base');
              if (modalCloseButton) {
                await clickFilterWithRetries(modalCloseButton, 'close modal');
              }
            }
          }
        }

        if (!applied) {
          results.brands.failedFilters.push(brandValue);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
      results.brands.success = results.brands.appliedCount > 0;
    }

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      console.log("[Content Script] Starting TataCliq color filter application");
      
      for (const color of filters.colors) {
        const colorValue = typeof color === 'string' ? color : color.text;
        let applied = false;

        // Check if we need to expand color section first
        const moreColorButton = document.querySelector('#color-filter-accordion');
        if (moreColorButton && moreColorButton.textContent.includes('More')) {
          await clickFilterWithRetries(moreColorButton, 'color more button');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Find and click the color filter
        const colorElement = document.querySelector(`#filter-color-${colorValue}`);
        if (colorElement && !colorElement.querySelector('.ColourSelectPLP__textHolderActive')) {
          const success = await clickFilterWithRetries(colorElement, colorValue);
          if (success) {
            results.colors.appliedFilters.push(colorValue);
            results.colors.appliedCount++;
            applied = true;
          }
        }

        if (!applied) {
          results.colors.failedFilters.push(colorValue);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
      results.colors.success = results.colors.appliedCount > 0;
    }

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      console.log("[Content Script] Starting TataCliq size filter application");
      
      for (const size of filters.sizes) {
        const sizeValue = typeof size === 'string' ? size : size.text;
        let applied = false;

        // Find size in the filter list
        const sizeItems = document.querySelectorAll('.FilterSelect__item');
        for (const item of sizeItems) {
          const sizeText = item.querySelector('.FilterSelect__data')?.textContent.trim();
          if (sizeText && sizeText === sizeValue) {
            const checkbox = item.querySelector('.FilterSelect__check .CheckBox__base');
            if (checkbox && !item.querySelector('.FilterSelect__contentSelected')) {
              const success = await clickFilterWithRetries(checkbox, sizeValue);
              if (success) {
                results.sizes.appliedFilters.push(sizeValue);
                results.sizes.appliedCount++;
                applied = true;
                break;
              }
            }
          }
        }

        if (!applied) {
          results.sizes.failedFilters.push(sizeValue);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
      results.sizes.success = results.sizes.appliedCount > 0;
    }

    // Calculate overall results
    const totalRequested = results.brands.totalCount + results.sizes.totalCount + results.colors.totalCount;
    const totalApplied = results.brands.appliedCount + results.sizes.appliedCount + results.colors.appliedCount;
    const overallSuccess = totalApplied > 0;
    const partialSuccess = totalApplied < totalRequested && totalApplied > 0;

    console.log("[Content Script] TataCliq filter application complete:", {
      totalRequested,
      totalApplied,
      brands: results.brands,
      sizes: results.sizes,
      colors: results.colors
    });

    return {
      success: overallSuccess,
      partialSuccess: partialSuccess,
      results: results,
      summary: {
        totalRequested,
        totalApplied,
        appliedFilters: {
          brands: results.brands.appliedFilters,
          sizes: results.sizes.appliedFilters,
          colors: results.colors.appliedFilters
        },
        failedFilters: {
          brands: results.brands.failedFilters,
          sizes: results.sizes.failedFilters,
          colors: results.colors.failedFilters
        }
      }
    };
  } catch (error) {
    console.error("[Content Script] Error applying TataCliq filters:", error);
    throw error;
  }
}

// Luxury TataCliq-specific functions
async function getLuxuryTataCliqFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: []
  };

  console.log("[Content Script] Extracting Luxury TataCliq filters...");

  try {
    // Wait longer for page to fully settle, especially after user interactions
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Debug: Check what filter elements exist
    const allFilterItems = document.querySelectorAll('.plp-filter-module__plpFilerItem');
    console.log(`[Content Script] Found ${allFilterItems.length} filter items on luxury TataCliq`);
    
    allFilterItems.forEach((item, index) => {
      const header = item.querySelector('.plp-filter-module__plpFilerItemHead');
      const ariaLabel = header?.getAttribute('aria-label');
      const isExpanded = header?.getAttribute('aria-expanded');
      console.log(`[Content Script] Filter item ${index}: ${ariaLabel} (expanded: ${isExpanded})`);
    });

    // Enhanced function to get checked filters from a section with multiple detection methods
    const getCheckedFiltersFromSection = async (filterItem, filterType) => {
      const foundFilters = [];
      
      console.log(`[Content Script] Analyzing ${filterType} section...`);
      
      // First ensure the section is expanded to see all filters
      const header = filterItem.querySelector('.plp-filter-module__plpFilerItemHead');
      if (header && header.getAttribute('aria-expanded') !== 'true') {
        console.log(`[Content Script] Expanding ${filterType} section to detect filters`);
        header.click();
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for expansion
      }
      
      // Method 1: Look for checkboxes with checked property
      const checkboxes = filterItem.querySelectorAll('input[type="checkbox"]');
      console.log(`[Content Script] Found ${checkboxes.length} checkboxes in ${filterType} section`);
      
      for (const checkbox of checkboxes) {
        if (checkbox.checked) {
          let filterText = '';
          const label = checkbox.closest('label');
          
          // Multiple extraction methods for filter text
          if (filterType === 'brand') {
            // For brands, try multiple selectors
            filterText = label?.querySelector('.plp-filter-module__controlTxt')?.textContent.trim() ||
                        label?.querySelector('span:not(.plp-filter-module__control__indicator)')?.textContent.trim() ||
                        label?.textContent.trim().replace(/checkbox/g, '').replace(/\s+/g, ' ').trim();
          } else if (filterType === 'color') {
            // For colors, try multiple extraction methods
            filterText = label?.querySelector('.plp-filter-module__controlTxt')?.textContent.trim() ||
                        label?.textContent.trim().replace(/checkbox/g, '').replace(/\s+/g, ' ').trim();
            
            // Clean up color text (remove numbers and extra whitespace)
            if (filterText) {
              filterText = filterText.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
            }
          } else {
            // For sizes
            filterText = label?.querySelector('.plp-filter-module__controlTxt')?.textContent.trim() ||
                        label?.textContent.trim().replace(/checkbox/g, '').replace(/\s+/g, ' ').trim();
          }
          
          // Clean up the filter text
          if (filterText) {
            filterText = filterText.replace(/^\s*checkbox\s*/i, '').trim();
            
            if (filterText.length > 0 && !foundFilters.includes(filterText)) {
              foundFilters.push(filterText);
              console.log(`[Content Script] Found selected ${filterType}: "${filterText}"`);
            }
          }
        }
      }
      
      // Method 2: Look for elements with specific classes that indicate selection
      if (foundFilters.length === 0) {
        console.log(`[Content Script] No checked checkboxes found, trying alternative methods for ${filterType}`);
        
        // Look for filter value items that might have selection indicators
        const filterValueItems = filterItem.querySelectorAll('.plp-filter-module__plpFilerValueItem');
        for (const item of filterValueItems) {
          const checkbox = item.querySelector('input[type="checkbox"]');
          if (checkbox && checkbox.checked) {
            const textSpan = item.querySelector('.plp-filter-module__controlTxt');
            if (textSpan) {
              const filterText = textSpan.textContent.trim();
              if (filterText && !foundFilters.includes(filterText)) {
                foundFilters.push(filterText);
                console.log(`[Content Script] Found selected ${filterType} via value item: "${filterText}"`);
              }
            }
          }
        }
      }
      
      // Method 3: Look for any elements that have checked checkboxes within the filter section
      if (foundFilters.length === 0) {
        console.log(`[Content Script] Trying direct checkbox scan for ${filterType}`);
        
        const allCheckboxesInSection = filterItem.querySelectorAll('input[type="checkbox"]:checked');
        for (const checkbox of allCheckboxesInSection) {
          const parentLabel = checkbox.closest('label');
          if (parentLabel) {
            // Try to extract text from various possible elements
            const possibleTexts = [
              parentLabel.querySelector('.plp-filter-module__controlTxt')?.textContent?.trim(),
              parentLabel.querySelector('span:last-child')?.textContent?.trim(),
              parentLabel.textContent?.trim()
            ].filter(text => text && text !== 'checkbox' && text.length > 0);
            
            if (possibleTexts.length > 0) {
              let filterText = possibleTexts[0].replace(/checkbox/g, '').trim();
              if (filterType === 'color') {
                filterText = filterText.replace(/\d+/g, '').trim();
              }
              
              if (filterText && !foundFilters.includes(filterText)) {
                foundFilters.push(filterText);
                console.log(`[Content Script] Found selected ${filterType} via direct scan: "${filterText}"`);
              }
            }
          }
        }
      }
      
      return foundFilters;
    };

    // Get brand filters with special handling
    for (const filterItem of allFilterItems) {
      const filterHeader = filterItem.querySelector('.plp-filter-module__plpFilerItemHead[aria-label="Brand"]');
      if (filterHeader) {
        console.log("[Content Script] Processing brand filter section");
        const brandFilters = await getCheckedFiltersFromSection(filterItem, 'brand');
        filters.brands.push(...brandFilters);
      }
    }

    // Get color filters
    for (const filterItem of allFilterItems) {
      const filterHeader = filterItem.querySelector('.plp-filter-module__plpFilerItemHead[aria-label="Colour"]');
      if (filterHeader) {
        console.log("[Content Script] Processing color filter section");
        const colorFilters = await getCheckedFiltersFromSection(filterItem, 'color');
        filters.colors.push(...colorFilters);
      }
    }

    // Get size filters
    for (const filterItem of allFilterItems) {
      const filterHeader = filterItem.querySelector('.plp-filter-module__plpFilerItemHead[aria-label="Size"]');
      if (filterHeader) {
        console.log("[Content Script] Processing size filter section");
        const sizeFilters = await getCheckedFiltersFromSection(filterItem, 'size');
        filters.sizes.push(...sizeFilters);
      }
    }

    // Enhanced debugging: Deep dive into any missed filters
    const allCheckboxes = document.querySelectorAll('.plp-filter-module__plpFilerItem input[type="checkbox"]');
    const checkedBoxes = Array.from(allCheckboxes).filter(cb => cb.checked);
    console.log(`[Content Script] Total checkboxes: ${allCheckboxes.length}, Checked: ${checkedBoxes.length}`);
    
    if (checkedBoxes.length > 0) {
      console.log("[Content Script] Detailed analysis of all checked checkboxes:");
      checkedBoxes.forEach((checkbox, index) => {
        const label = checkbox.closest('label');
        const parent = checkbox.closest('.plp-filter-module__plpFilerItem');
        const sectionHeader = parent?.querySelector('.plp-filter-module__plpFilerItemHead')?.getAttribute('aria-label');
        const valueItem = checkbox.closest('.plp-filter-module__plpFilerValueItem');
        
        console.log(`[Content Script] Checked checkbox ${index} in section "${sectionHeader}":`, {
          labelText: label?.textContent?.trim(),
          controlTxt: label?.querySelector('.plp-filter-module__controlTxt')?.textContent?.trim(),
          valueItemText: valueItem?.textContent?.trim(),
          innerHTML: label?.innerHTML
        });
      });
    }

    // Final verification: If we still have no filters but there are checked boxes, try a global search
    if (filters.brands.length === 0 && filters.colors.length === 0 && filters.sizes.length === 0 && checkedBoxes.length > 0) {
      console.warn("[Content Script] No filters detected despite checked boxes - performing emergency extraction");
      
      checkedBoxes.forEach(checkbox => {
        const label = checkbox.closest('label');
        const parent = checkbox.closest('.plp-filter-module__plpFilerItem');
        const sectionType = parent?.querySelector('.plp-filter-module__plpFilerItemHead')?.getAttribute('aria-label')?.toLowerCase();
        
        // Extract any possible text
        const textContent = label?.textContent?.trim() || '';
        const cleanText = textContent.replace(/checkbox/gi, '').replace(/\s+/g, ' ').trim();
        
        if (cleanText && cleanText.length > 1) {
          if (sectionType?.includes('brand') && !filters.brands.includes(cleanText)) {
            filters.brands.push(cleanText);
            console.log(`[Content Script] Emergency extraction - Brand: "${cleanText}"`);
          } else if (sectionType?.includes('colour') && !filters.colors.includes(cleanText)) {
            const cleanColor = cleanText.replace(/\d+/g, '').trim();
            if (cleanColor) {
              filters.colors.push(cleanColor);
              console.log(`[Content Script] Emergency extraction - Color: "${cleanColor}"`);
            }
          } else if (sectionType?.includes('size') && !filters.sizes.includes(cleanText)) {
            filters.sizes.push(cleanText);
            console.log(`[Content Script] Emergency extraction - Size: "${cleanText}"`);
          }
        }
      });
    }

    console.log("[Content Script] Final Luxury TataCliq filters extracted:", {
      brands: filters.brands,
      colors: filters.colors,
      sizes: filters.sizes,
      totalFilters: filters.brands.length + filters.colors.length + filters.sizes.length
    });
    
  } catch (error) {
    console.error("[Content Script] Error extracting Luxury TataCliq filters:", error);
  }

  return filters;
}

async function applyLuxuryTataCliqFilters(filters) {
  console.log("[Content Script] Applying Luxury TataCliq filters:", filters);
  
  try {
    // Store original requested filters for toast comparison
    const requestedFilters = {
      brands: Array.isArray(filters.brands) ? [...filters.brands] : [],
      sizes: Array.isArray(filters.sizes) ? [...filters.sizes] : [],
      colors: Array.isArray(filters.colors) ? [...filters.colors] : []
    };
    
    let results = {
      brands: { success: false, appliedCount: 0, totalCount: (filters.brands || []).length, appliedFilters: [], failedFilters: [] },
      sizes: { success: false, appliedCount: 0, totalCount: (filters.sizes || []).length, appliedFilters: [], failedFilters: [] },
      colors: { success: false, appliedCount: 0, totalCount: (filters.colors || []).length, appliedFilters: [], failedFilters: [] }
    };

    // Helper function to find and expand filter section
    const expandFilterSection = async (ariaLabel) => {
      const filterItems = document.querySelectorAll('.plp-filter-module__plpFilerItem');
      for (const filterItem of filterItems) {
        const filterHeader = filterItem.querySelector(`.plp-filter-module__plpFilerItemHead[aria-label="${ariaLabel}"]`);
        if (filterHeader) {
          const isExpanded = filterHeader.getAttribute('aria-expanded') === 'true';
          if (!isExpanded) {
            console.log(`[Content Script] Expanding ${ariaLabel} filter section`);
            filterHeader.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          return filterItem;
        }
      }
      return null;
    };

    // Helper function to apply filter with retries
    const applyFilterWithRetries = async (filterValue, type, maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Content Script] Applying Luxury TataCliq ${type} filter: ${filterValue} (attempt ${attempt})`);
          
          const filterSection = await expandFilterSection(type === 'brand' ? 'Brand' : (type === 'color' ? 'Colour' : 'Size'));
          if (!filterSection) {
            console.warn(`[Content Script] ${type} filter section not found`);
            return false;
          }

          // Find the specific filter checkbox
          const checkboxes = filterSection.querySelectorAll('input[type="checkbox"]');
          for (const checkbox of checkboxes) {
            const label = checkbox.closest('label');
            let labelText = '';
            
            if (type === 'color') {
              // For colors, get the text content from the label
              labelText = label?.textContent.trim().replace(/\s+/g, ' ').replace(/\d+/g, '').trim() || '';
            } else {
              // For brands and sizes, get from the controlTxt span
              labelText = label?.querySelector('.plp-filter-module__controlTxt')?.textContent.trim() || '';
            }

            if (labelText && labelText.toLowerCase() === filterValue.toLowerCase()) {
              if (!checkbox.checked) {
                console.log(`[Content Script] Clicking ${type} filter: ${filterValue}`);
                checkbox.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                if (checkbox.checked) {
                  console.log(`[Content Script] Successfully applied ${type} filter: ${filterValue}`);
                  return true;
                }
              } else {
                console.log(`[Content Script] ${type} filter already applied: ${filterValue}`);
                return true;
              }
            }
          }

          if (attempt < maxRetries) {
            console.log(`[Content Script] Retrying ${type} filter: ${filterValue}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`[Content Script] Error applying ${type} filter ${filterValue} (attempt ${attempt}):`, error);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      console.warn(`[Content Script] Failed to apply ${type} filter after ${maxRetries} attempts: ${filterValue}`);
      return false;
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      console.log("[Content Script] Starting Luxury TataCliq brand filter application");
      for (const brand of filters.brands) {
        const brandValue = typeof brand === 'string' ? brand : brand.text;
        const success = await applyFilterWithRetries(brandValue, 'brand');
        if (success) {
          results.brands.appliedFilters.push(brandValue);
          results.brands.appliedCount++;
        } else {
          results.brands.failedFilters.push(brandValue);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      results.brands.success = results.brands.appliedCount > 0;
    }

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      console.log("[Content Script] Starting Luxury TataCliq color filter application");
      for (const color of filters.colors) {
        const colorValue = typeof color === 'string' ? color : color.text;
        const success = await applyFilterWithRetries(colorValue, 'color');
        if (success) {
          results.colors.appliedFilters.push(colorValue);
          results.colors.appliedCount++;
        } else {
          results.colors.failedFilters.push(colorValue);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      results.colors.success = results.colors.appliedCount > 0;
    }

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      console.log("[Content Script] Starting Luxury TataCliq size filter application");
      for (const size of filters.sizes) {
        const sizeValue = typeof size === 'string' ? size : size.text;
        const success = await applyFilterWithRetries(sizeValue, 'size');
        if (success) {
          results.sizes.appliedFilters.push(sizeValue);
          results.sizes.appliedCount++;
        } else {
          results.sizes.failedFilters.push(sizeValue);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      results.sizes.success = results.sizes.appliedCount > 0;
    }

    // Calculate overall results
    const totalRequested = results.brands.totalCount + results.sizes.totalCount + results.colors.totalCount;
    const totalApplied = results.brands.appliedCount + results.sizes.appliedCount + results.colors.appliedCount;
    const overallSuccess = totalApplied > 0;
    const partialSuccess = totalApplied < totalRequested && totalApplied > 0;

    console.log("[Content Script] Luxury TataCliq filter application complete:", {
      totalRequested,
      totalApplied,
      brands: results.brands,
      sizes: results.sizes,
      colors: results.colors
    });

    // Show toast notification for unmatched filters after a short delay
    setTimeout(() => {
      try {
        showUnmatchedFiltersToast(requestedFilters, results);
      } catch (toastError) {
        console.error("[Content Script] Error showing Luxury TataCliq toast notification:", toastError);
      }
    }, 1000);

    return {
      success: overallSuccess,
      partialSuccess: partialSuccess,
      results: results,
      summary: {
        totalRequested,
        totalApplied,
        appliedFilters: {
          brands: results.brands.appliedFilters,
          sizes: results.sizes.appliedFilters,
          colors: results.colors.appliedFilters
        },
        failedFilters: {
          brands: results.brands.failedFilters,
          sizes: results.sizes.failedFilters,
          colors: results.colors.failedFilters
        }
      }
    };
  } catch (error) {
    console.error("[Content Script] Error applying Luxury TataCliq filters:", error);
    throw error;
  }
}