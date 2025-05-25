import {
  applyBrandFilters,
  applyColorFilters,
  applySizeFilters,
} from "./applyFilters";
import { areAllFiltersApplied } from "./helpers";

// Myntra-specific functions
export async function getMyntraFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: [],
  };

  // Get selected filters from the filter summary container
  const filterList = document.querySelector(".filter-summary-filterList");
  if (filterList) {
    const filterItems = filterList.querySelectorAll(".filter-summary-filter");
    for (const item of filterItems) {
      const filterInput = item.querySelector('input[type="checkbox"]');
      const filterType = filterInput?.dataset.group;

      if (filterType === "Brand") {
        // For brand filters, get the text content
        const brandText = item.textContent.trim();
        if (brandText) {
          filters.brands.push(brandText);
        }
      } else if (filterType === "Color") {
        // For color filters, get the text after the color box
        const colorText = item
          .querySelector("span:not(.filter-summary-colourBox)")
          ?.textContent.trim();
        if (colorText) {
          filters.colors.push(colorText);
        }
      } else if (filterType === "size_facet") {
        // For size filters, get the text content excluding the remove icon
        const sizeText = Array.from(item.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent.trim())
          .join("")
          .trim();
        if (sizeText) {
          filters.sizes.push(sizeText);
        }
      }
    }
  }

  // Also check for brand filters in the vertical filters
  const brandCheckboxes = document.querySelectorAll(
    '.brand-list input[type="checkbox"]:checked'
  );
  for (const checkbox of brandCheckboxes) {
    const brandText = checkbox.value;
    if (brandText && !filters.brands.includes(brandText)) {
      filters.brands.push(brandText);
    }
  }

  // Also check for size filters in the horizontal filters
  const sizeFilter = document.querySelector(
    '.atsa-filters li label input[value="size_facet"]'
  );
  if (sizeFilter) {
    sizeFilter.click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const sizeOptions = document.querySelectorAll(
      '.atsa-values label input[type="checkbox"]:checked'
    );
    for (const option of sizeOptions) {
      const sizeText = option.closest("label")?.textContent.trim();
      if (sizeText && !filters.sizes.includes(sizeText)) {
        filters.sizes.push(sizeText);
      }
    }
  }

  console.log("[Content Script] Extracted Myntra filters:", filters);
  return filters;
}

export async function resetMyntraFilters() {
  console.log("[Content Script] Resetting Myntra filters...");

  // Reset brands
  const brandCheckboxes = document.querySelectorAll(
    '.brand-list input[type="checkbox"]:checked'
  );
  for (const checkbox of brandCheckboxes) {
    if (checkbox.checked) {
      checkbox.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Reset sizes (if exists)
  const sizeCheckboxes = document.querySelectorAll(
    '.size-list input[type="checkbox"]:checked'
  );
  for (const checkbox of sizeCheckboxes) {
    if (checkbox.checked) {
      checkbox.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Reset colors
  const colorCheckboxes = document.querySelectorAll(
    '.colour-listItem input[type="checkbox"]:checked'
  );
  for (const checkbox of colorCheckboxes) {
    if (checkbox.checked) {
      checkbox.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
}

// Myntra-specific filter application
export async function applyMyntraFilters(filters) {
  console.log("[Content Script] Applying Myntra filters:", filters);

  try {
    // Clear existing filters first
    await resetMyntraFilters();

    let appliedFilters = {
      brands: [],
      sizes: [],
      colors: [],
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      const success = await applyBrandFilters(filters.brands, "myntra");
      if (success) {
        appliedFilters.brands = filters.brands;
      }
    }

    // Wait between filter types
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      const success = await applySizeFilters(filters.sizes, "myntra");
      if (success) {
        appliedFilters.sizes = filters.sizes;
      }
    }

    // Wait between filter types
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      const success = await applyColorFilters(filters.colors, "myntra");
      if (success) {
        appliedFilters.colors = filters.colors;
      }
    }

    // Return success even if some filters couldn't be applied
    return {
      success: true,
      appliedFilters: appliedFilters,
      partialSuccess: !areAllFiltersApplied(filters, appliedFilters),
    };
  } catch (error) {
    console.error("[Content Script] Error applying Myntra filters:", error);
    throw error;
  }
}
