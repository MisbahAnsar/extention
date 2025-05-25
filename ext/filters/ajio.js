import {
  applyBrandFilters,
  applyColorFilters,
  applySizeFilters,
} from "./applyFilters";
import { areAllFiltersApplied } from "./helpers";

// Ajio-specific functions
export async function getAjioFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: [],
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
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get selected filters from the applied filters container
    const appliedFilters = document.querySelector(".fnl-plp-appliedFliters");
    if (appliedFilters) {
      console.log("[Content Script] Found applied filters container");
      const filterItems = appliedFilters.querySelectorAll(".fnl-plp-afliter");

      for (const item of filterItems) {
        try {
          const filterText = item
            .querySelector(".pull-left")
            ?.textContent.trim();
          const filterType = item
            .querySelector(".fnl-plp-afliter-type")
            ?.textContent.trim()
            .toLowerCase();

          if (!filterText) continue;

          // Use the filter type if available, otherwise try to determine from text
          if (filterType) {
            if (filterType.includes("brand")) {
              if (!filters.brands.includes(filterText)) {
                filters.brands.push(filterText);
                console.log(`[Content Script] Added brand: ${filterText}`);
              }
            } else if (
              filterType.includes("color") ||
              filterType.includes("colour")
            ) {
              if (!filters.colors.includes(filterText)) {
                filters.colors.push(filterText);
                console.log(`[Content Script] Added color: ${filterText}`);
              }
            } else if (filterType.includes("size")) {
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
                console.log(
                  `[Content Script] Added size (by pattern): ${filterText}`
                );
              }
            } else if (
              filterText.match(
                /^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Navy|Maroon|Olive|Teal|Cyan|Magenta|Gold|Silver|Bronze|Multicolor|Printed|Striped|Floral|Geometric|Abstract|Animal Print|Camouflage|Tie & Dye|Ombre|Metallic|Glitter|Holographic|Neon|Pastel|Vintage|Washed|Faded|Distressed|Embellished|Sequined|Beaded|Quilted|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace)$/i
              )
            ) {
              if (!filters.colors.includes(filterText)) {
                filters.colors.push(filterText);
                console.log(
                  `[Content Script] Added color (by pattern): ${filterText}`
                );
              }
            } else {
              // Only add as brand if it doesn't match size or color patterns
              if (!filters.brands.includes(filterText)) {
                filters.brands.push(filterText);
                console.log(
                  `[Content Script] Added brand (by default): ${filterText}`
                );
              }
            }
          }
        } catch (error) {
          console.error(
            "[Content Script] Error processing filter item:",
            error
          );
        }
      }
    }

    // If no filters found in applied filters, check the facet menu directly
    if (
      filters.brands.length === 0 &&
      filters.sizes.length === 0 &&
      filters.colors.length === 0
    ) {
      console.log(
        "[Content Script] No filters found in applied filters, checking facets"
      );

      // Check for brands
      const brandCheckboxes = document.querySelectorAll(
        'input[name="brand"]:checked'
      );
      for (const checkbox of brandCheckboxes) {
        try {
          const label = checkbox
            .closest(".facet-linkfref")
            ?.querySelector(".facet-linkname-brand")
            ?.textContent.trim();
          if (label && !filters.brands.includes(label)) {
            filters.brands.push(label);
            console.log(`[Content Script] Added brand from facet: ${label}`);
          }
        } catch (error) {
          console.error(
            "[Content Script] Error getting brand from checkbox:",
            error
          );
        }
      }

      // Check for sizes - specifically look for UK sizes
      const sizeCheckboxes = document.querySelectorAll(
        'input[name="verticalsizegroupformat"]:checked'
      );
      for (const checkbox of sizeCheckboxes) {
        try {
          const label = checkbox
            .closest(".facet-linkfref")
            ?.querySelector(".facet-linkname-verticalsizegroupformat")
            ?.textContent.trim();
          if (label) {
            // Extract just the size value (e.g., "UK 2 (61)" -> "UK 2")
            const sizeMatch = label.match(/^(UK \d+)/i);
            if (sizeMatch && !filters.sizes.includes(sizeMatch[1])) {
              filters.sizes.push(sizeMatch[1]);
              console.log(
                `[Content Script] Added size from facet: ${sizeMatch[1]}`
              );
            }
          }
        } catch (error) {
          console.error(
            "[Content Script] Error getting size from checkbox:",
            error
          );
        }
      }

      // Check for colors
      const colorCheckboxes = document.querySelectorAll(
        'input[name="verticalcolorfamily"]:checked'
      );
      for (const checkbox of colorCheckboxes) {
        try {
          const label = checkbox
            .closest(".facet-linkfref")
            ?.querySelector(
              ".facet-linkname-verticalcolorfamily, .facet-list-title-name"
            )
            ?.textContent.trim();
          if (label && !filters.colors.includes(label)) {
            filters.colors.push(label);
            console.log(`[Content Script] Added color from facet: ${label}`);
          }
        } catch (error) {
          console.error(
            "[Content Script] Error getting color from checkbox:",
            error
          );
        }
      }
    }

    console.log("[Content Script] Final Ajio filters:", filters);
  } catch (error) {
    console.error("[Content Script] Error getting Ajio filters:", error);
  }

  return filters;
}

export async function resetAjioFilters() {
  console.log("[Content Script] Resetting Ajio filters...");

  const resetFilterType = async (selector) => {
    const checkboxes = document.querySelectorAll(`${selector}:checked`);
    console.log(
      `[Content Script] Resetting ${checkboxes.length} ${selector} filters`
    );

    for (const checkbox of checkboxes) {
      try {
        if (checkbox.checked) {
          checkbox.click();
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Verify it was unchecked
          if (checkbox.checked) {
            console.log("[Content Script] Filter still checked, trying again");
            checkbox.click();
            await new Promise((resolve) => setTimeout(resolve, 300));
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
  await new Promise((resolve) => setTimeout(resolve, 500));
}

// Ajio-specific filter application
export async function applyAjioFilters(filters) {
  console.log("[Content Script] Applying Ajio filters:", filters);

  try {
    // Clear existing filters first
    await resetAjioFilters();

    let appliedFilters = {
      brands: [],
      sizes: [],
      colors: [],
    };

    // Apply brand filters
    if (filters.brands && filters.brands.length > 0) {
      const success = await applyBrandFilters(filters.brands, "ajio");
      if (success) {
        appliedFilters.brands = filters.brands;
      }
    }

    // Wait between filter types
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Apply size filters
    if (filters.sizes && filters.sizes.length > 0) {
      const success = await applySizeFilters(filters.sizes, "ajio");
      if (success) {
        appliedFilters.sizes = filters.sizes;
      }
    }

    // Wait between filter types
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Apply color filters
    if (filters.colors && filters.colors.length > 0) {
      const success = await applyColorFilters(filters.colors, "ajio");
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
    console.error("[Content Script] Error applying Ajio filters:", error);
    throw error;
  }
}
