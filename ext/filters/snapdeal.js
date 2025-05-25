// Snapdeal-specific functions
export async function getSnapdealFilters() {
  console.log("[Content Script] Getting Snapdeal filters");

  const filters = {
    brands: [],
    sizes: [],
    colors: [],
  };

  try {
    // Wait for the filter sections to be available
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get selected brands
    const brandSection = Array.from(
      document.querySelectorAll(".filter-section")
    ).find((section) => {
      const displayName = section.getAttribute("data-displayname");
      return displayName && displayName.toLowerCase() === "brand";
    });

    if (brandSection) {
      console.log("[Content Script] Found brand section");

      // Check both regular checkboxes and checkboxes in modal
      const brandCheckboxes = brandSection.querySelectorAll(
        '.filter-inner .filters-list input[type="checkbox"]:checked, .js-adv-filters .filters-list input[type="checkbox"]:checked'
      );

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
    const colorSection = Array.from(
      document.querySelectorAll(".filter-section")
    ).find((section) => {
      const displayName = section.getAttribute("data-displayname");
      return displayName && displayName.toLowerCase() === "color";
    });

    if (colorSection) {
      console.log("[Content Script] Found color section");

      const colorCheckboxes = colorSection.querySelectorAll(
        '.filter-inner .filters-list input[type="checkbox"]:checked, .js-adv-filters .filters-list input[type="checkbox"]:checked'
      );

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
    const sizeSection = Array.from(
      document.querySelectorAll(".filter-section")
    ).find((section) => {
      const displayName = section.getAttribute("data-displayname");
      return displayName && displayName.toLowerCase() === "size";
    });

    if (sizeSection) {
      console.log("[Content Script] Found size section");

      const sizeCheckboxes = sizeSection.querySelectorAll(
        '.filter-inner .filters-list input[type="checkbox"]:checked, .js-adv-filters .filters-list input[type="checkbox"]:checked'
      );

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

export async function applySnapdealFilters(filters) {
  console.log("[Content Script] Applying Snapdeal filters:", filters);

  try {
    // Helper function to wait for element to be available
    const waitForElement = async (
      selector,
      maxAttempts = 10,
      interval = 500
    ) => {
      let attempts = 0;
      while (attempts < maxAttempts) {
        const element = document.querySelector(selector);
        if (element) return element;

        await new Promise((resolve) => setTimeout(resolve, interval));
        attempts++;
      }
      return null;
    };

    // Helper function to click a checkbox for a specific filter
    const applyFilter = async (sectionSelector, filterValue, filterType) => {
      console.log(
        `[Content Script] Applying ${filterType} filter: ${filterValue}`
      );

      const section = await waitForElement(sectionSelector);
      if (!section) {
        console.warn(`[Content Script] ${filterType} section not found`);
        return false;
      }

      // First try to find the filter in the visible filter options
      let checkbox = section.querySelector(
        `input[id="${filterType}-${filterValue}"]:not(:checked), input[id="${filterType}_s-${filterValue}"]:not(:checked)`
      );

      if (!checkbox) {
        // If not found, try to find "View More" button and click it
        const viewMoreBtn = section.querySelector(
          ".view-more-button, .viewMoreFilter"
        );
        if (viewMoreBtn) {
          console.log(
            `[Content Script] Clicking View More button for ${filterType}`
          );
          viewMoreBtn.click();
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Wait for modal to appear
          const modal = await waitForElement(".js-adv-filters.adv-filters");
          if (modal) {
            console.log(
              `[Content Script] Modal opened, looking for ${filterType} filter: ${filterValue}`
            );

            // Try to find checkbox in modal
            checkbox = modal.querySelector(
              `input[id="${filterType}-${filterValue}"]:not(:checked), input[id="${filterType}_s-${filterValue}"]:not(:checked), input[value="${filterValue}"]:not(:checked)`
            );

            if (!checkbox) {
              // Try to search for the filter if there's a search box
              const searchBox = modal.querySelector(".js-searchable-box");
              if (searchBox) {
                console.log(
                  `[Content Script] Using search box to find: ${filterValue}`
                );
                searchBox.value = filterValue;
                searchBox.dispatchEvent(new Event("input", { bubbles: true }));
                await new Promise((resolve) => setTimeout(resolve, 1000));

                // Try to find checkbox again after search
                checkbox = modal.querySelector(
                  `input[value="${filterValue}"]:not(:checked)`
                );
              }
            }

            if (checkbox) {
              console.log(
                `[Content Script] Found ${filterType} in modal: ${filterValue}`
              );
              checkbox.click();
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Click Apply button
              const applyBtn = modal.querySelector(".applyFilters");
              if (applyBtn) {
                console.log("[Content Script] Clicking Apply button");
                applyBtn.click();
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            } else {
              // Close modal if filter not found
              const closeBtn = modal.querySelector(".close-adv");
              if (closeBtn) {
                console.log(
                  `[Content Script] Closing modal - filter not found`
                );
                closeBtn.click();
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          }
        }
      } else {
        // If found in main section, just click it
        console.log(
          `[Content Script] Found ${filterType} in main section: ${filterValue}`
        );
        checkbox.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return true;
      }

      console.warn(
        `[Content Script] Could not find ${filterType}: ${filterValue}`
      );
      return false;
    };

    // Clear all filters first
    const clearAll = async () => {
      const clearButtons = document.querySelectorAll(".filter-clear");
      if (clearButtons.length > 0) {
        console.log(`[Content Script] Clearing existing filters`);
        for (const button of clearButtons) {
          if (button.textContent.trim().toLowerCase() === "clear") {
            button.click();
            await new Promise((resolve) => setTimeout(resolve, 1000));
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
      sizes: [],
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      console.log("[Content Script] Applying brand filters on Snapdeal");
      for (const brand of filters.brands) {
        const brandValue =
          typeof brand === "string"
            ? brand
            : brand.text || brand.value || brand;
        const success = await applyFilter(
          '.filter-section[data-displayname="Brand"]',
          brandValue,
          "Brand"
        );
        if (success) {
          appliedFilters.brands.push(brandValue);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      console.log("[Content Script] Applying color filters on Snapdeal");
      for (const color of filters.colors) {
        const colorValue =
          typeof color === "string"
            ? color
            : color.text || color.value || color;
        const success = await applyFilter(
          '.filter-section[data-displayname="Color"]',
          colorValue,
          "Color_s"
        );
        if (success) {
          appliedFilters.colors.push(colorValue);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      console.log("[Content Script] Applying size filters on Snapdeal");
      for (const size of filters.sizes) {
        const sizeValue =
          typeof size === "string" ? size : size.text || size.value || size;
        const success = await applyFilter(
          '.filter-section[data-displayname="Size"]',
          sizeValue,
          "Size_s"
        );
        if (success) {
          appliedFilters.sizes.push(sizeValue);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    // Return results
    console.log("[Content Script] Applied Snapdeal filters:", appliedFilters);
    return {
      success: true,
      appliedFilters: appliedFilters,
    };
  } catch (error) {
    console.error("[Content Script] Error applying Snapdeal filters:", error);
    throw error;
  }
}
