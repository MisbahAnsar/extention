// Nykaa-specific functions
export async function getNykaaFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: [],
  };

  try {
    console.log("[Content Script] Getting Nykaa filters");

    // Check the applied filters section first
    const appliedFiltersSection = document.querySelector(".css-19j3ean");
    if (appliedFiltersSection) {
      const appliedFilters =
        appliedFiltersSection.querySelectorAll(".css-3i7s5s");
      for (const filter of appliedFilters) {
        const filterText = filter
          .querySelector(".filter-value")
          ?.textContent.trim();
        if (filterText) {
          // Try to determine filter type based on the text
          if (filterText.match(/^UK \d+$/i)) {
            filters.sizes.push(filterText);
          } else if (
            filterText.match(
              /^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Multi-Color|Gold|Silver|Off White|Cream)$/i
            )
          ) {
            filters.colors.push(filterText);
          } else {
            // Assume it's a brand if it doesn't match size or color patterns
            filters.brands.push(filterText);
          }
        }
      }
    }

    // If no filters found in applied section, check individual filter sections
    if (
      filters.brands.length === 0 &&
      filters.sizes.length === 0 &&
      filters.colors.length === 0
    ) {
      // Check brand filters
      const brandSection = document.querySelector("#first-filter");
      if (brandSection) {
        const brandCheckboxes = brandSection.querySelectorAll(
          'input[type="checkbox"]:checked'
        );
        for (const checkbox of brandCheckboxes) {
          const label = checkbox
            .closest("label")
            ?.querySelector(".title")
            ?.textContent.trim();
          if (label) {
            filters.brands.push(label);
          }
        }
      }

      // Check size filters
      const sizeSection = document.querySelector(
        'div[class="css-w2222k"]:has(span.title:contains("Size"))'
      );
      if (sizeSection) {
        const sizeCheckboxes = sizeSection.querySelectorAll(
          'input[type="checkbox"]:checked'
        );
        for (const checkbox of sizeCheckboxes) {
          const label = checkbox
            .closest("label")
            ?.querySelector(".title")
            ?.textContent.trim();
          if (label) {
            filters.sizes.push(label);
          }
        }
      }

      // Check color filters
      const colorSection = document.querySelector(
        'div[class="css-w2222k"]:has(span.title:contains("Color"))'
      );
      if (colorSection) {
        const colorCheckboxes = colorSection.querySelectorAll(
          'input[type="checkbox"]:checked'
        );
        for (const checkbox of colorCheckboxes) {
          const label = checkbox
            .closest("label")
            ?.querySelector(".title")
            ?.textContent.trim();
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

export async function applyNykaaFilters(filters) {
  console.log("[Content Script] Applying Nykaa filters:", filters);

  try {
    // Helper function to click an element
    const clickElement = async (element) => {
      if (element) {
        element.click();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };

    // Helper function to verify if a filter is applied
    const isFilterApplied = (filterValue) => {
      const appliedFiltersSection = document.querySelector(".css-19j3ean");
      if (appliedFiltersSection) {
        const appliedFilters =
          appliedFiltersSection.querySelectorAll(".css-3i7s5s");
        for (const filter of appliedFilters) {
          const text = filter
            .querySelector(".filter-value")
            ?.textContent.trim();
          if (text && text.toLowerCase() === filterValue.toLowerCase()) {
            return true;
          }
        }
      }
      return false;
    };

    // Helper function to clear all filters
    const clearAllFilters = async () => {
      const clearAllButton = document.querySelector("button.filter-clear-all");
      if (clearAllButton) {
        await clickElement(clearAllButton);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    };

    // Helper function to apply a single filter
    const applySingleFilter = async (filterSection, filterValue) => {
      // Click to expand the filter section if it's collapsed
      const filterHeader = filterSection.querySelector(".filter-open");
      if (filterHeader) {
        const isExpanded = filterSection.querySelector("ul.css-oryinj");
        if (!isExpanded) {
          await clickElement(filterHeader);
        }
      }

      // Find and click the checkbox for the filter value
      const filterItems = filterSection.querySelectorAll(".control-box");
      for (const item of filterItems) {
        const label = item.querySelector(".title")?.textContent.trim();
        if (label && label.toLowerCase() === filterValue.toLowerCase()) {
          const checkbox = item.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) {
            await clickElement(checkbox);

            // Verify the filter was applied
            await new Promise((resolve) => setTimeout(resolve, 1000));
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
      sizes: [],
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      const brandSection = document.querySelector("#first-filter");
      if (brandSection) {
        for (const brand of filters.brands) {
          const success = await applySingleFilter(brandSection, brand);
          if (success) {
            appliedFilters.brands.push(brand);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      const sizeSection = document.querySelector(
        'div[class="css-w2222k"]:has(span.title:contains("Size"))'
      );
      if (sizeSection) {
        for (const size of filters.sizes) {
          const success = await applySingleFilter(sizeSection, size);
          if (success) {
            appliedFilters.sizes.push(size);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      const colorSection = document.querySelector(
        'div[class="css-w2222k"]:has(span.title:contains("Color"))'
      );
      if (colorSection) {
        for (const color of filters.colors) {
          const success = await applySingleFilter(colorSection, color);
          if (success) {
            appliedFilters.colors.push(color);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    console.log(
      "[Content Script] Successfully applied Nykaa filters:",
      appliedFilters
    );
    return appliedFilters;
  } catch (error) {
    console.error("[Content Script] Error applying Nykaa filters:", error);
    throw error;
  }
}
