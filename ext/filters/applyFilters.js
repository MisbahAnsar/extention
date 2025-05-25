import { applyAmazonFilters } from "./amazon";
import { applyCrossSiteFilters } from "./crossSite";
import { applyFlipkartFilters } from "./flipkart";
import { applyNykaaFilters } from "./nykaa";
import { applySnapdealFilters } from "./snapdeal";

// Update applyBrandFilters to handle multiple brands better
export async function applyBrandFilters(brands, site) {
  console.log(`[Content Script] Applying brand filters:`, brands);
  let appliedCount = 0;

  for (const brand of brands) {
    let brandName = typeof brand === "string" ? brand : brand.text;
    console.log(
      `[Content Script] Attempting to apply brand filter: ${brandName}`
    );

    try {
      if (site === "myntra") {
        // First try to find the brand in the filter summary
        const filterList = document.querySelector(".filter-summary-filterList");
        if (filterList) {
          const brandFilter = Array.from(
            filterList.querySelectorAll(".filter-summary-filter")
          ).find((filter) => filter.textContent.trim() === brandName);

          if (brandFilter) {
            console.log("[Content Script] Brand already applied:", brandName);
            appliedCount++;
            continue;
          }
        }

        // Find and select the brand in the vertical filters
        const brandOptions = document.querySelectorAll(".brand-list label");
        let brandFound = false;

        for (const option of brandOptions) {
          const optionText = option.textContent.trim().toLowerCase();
          if (optionText.includes(brandName.toLowerCase())) {
            console.log(
              "[Content Script] Found matching brand option, clicking"
            );
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              brandFound = true;
              appliedCount++;
              // Wait for the checkbox to be checked
              await new Promise((resolve) => setTimeout(resolve, 500));
              break;
            }
          }
        }

        if (!brandFound) {
          console.warn(`[Content Script] Brand option not found: ${brandName}`);
        }
      } else if (site === "ajio") {
        // First try to find the brand in the breadcrumb container
        const appliedFilters = document.querySelector(
          ".fnl-plp-appliedFliters"
        );
        if (appliedFilters) {
          const brandFilter = Array.from(
            appliedFilters.querySelectorAll(".fnl-plp-afliter")
          ).find(
            (filter) =>
              filter.querySelector(".pull-left").textContent.trim() ===
              brandName
          );

          if (brandFilter) {
            console.log("[Content Script] Brand already applied:", brandName);
            appliedCount++;
            continue;
          }
        }

        // If not found in breadcrumb, try to apply through facet list
        const brandFacet = document.querySelector(
          '.cat-facets .facet-left-pane-label[aria-label="brands"]'
        );
        if (brandFacet) {
          console.log("[Content Script] Found brand facet, clicking to expand");
          brandFacet.closest(".facet-head").click();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Find and select the brand in the facet list
          const brandOptions = document.querySelectorAll(
            ".facet-linkname-brand"
          );
          let brandFound = false;

          for (const option of brandOptions) {
            const optionText = option.textContent.trim().toLowerCase();
            if (optionText.includes(brandName.toLowerCase())) {
              console.log(
                "[Content Script] Found matching brand option, clicking"
              );
              const checkbox = option
                .closest(".facet-linkfref")
                .querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                brandFound = true;
                appliedCount++;
                // Wait for the checkbox to be checked
                await new Promise((resolve) => setTimeout(resolve, 500));
                break;
              }
            }
          }

          if (!brandFound) {
            console.warn(
              `[Content Script] Brand option not found: ${brandName}`
            );
          }
        } else {
          console.warn("[Content Script] Brand facet not found");
        }
      }
    } catch (error) {
      console.error(
        `[Content Script] Error applying brand filter ${brandName}:`,
        error
      );
      // Continue with next brand instead of breaking
    }
  }

  console.log(
    `[Content Script] Successfully applied ${appliedCount} out of ${brands.length} brand filters`
  );
  return appliedCount > 0;
}

// Update applyColorFilters to handle multiple colors better
export async function applyColorFilters(colors, site) {
  console.log(`[Content Script] Applying color filters:`, colors);
  let appliedCount = 0;

  for (const color of colors) {
    let colorValue = typeof color === "string" ? color : color.text;
    console.log(
      `[Content Script] Attempting to apply color filter: ${colorValue}`
    );

    try {
      if (site === "myntra") {
        // Find and click the color filter in the vertical filters
        const colorFilter = document.querySelector(
          ".vertical-filters-filters .vertical-filters-header"
        );
        if (colorFilter) {
          console.log("[Content Script] Found color filter");

          // Find and select the color in the filter options
          const colorOptions = document.querySelectorAll(
            ".colour-listItem label"
          );
          let colorFound = false;

          for (const option of colorOptions) {
            const optionText = option.textContent.trim().toLowerCase();
            if (optionText.includes(colorValue.toLowerCase())) {
              console.log(
                "[Content Script] Found matching color option, clicking"
              );
              const checkbox = option.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                colorFound = true;
                appliedCount++;
                await new Promise((resolve) => setTimeout(resolve, 500));
                break;
              }
            }
          }

          if (!colorFound) {
            console.warn(
              `[Content Script] Color option not found: ${colorValue}`
            );
          }
        } else {
          console.warn(
            "[Content Script] Color filter not found in vertical filters"
          );
        }
      } else if (site === "ajio") {
        // First try to find the color in the breadcrumb container
        const appliedFilters = document.querySelector(
          ".fnl-plp-appliedFliters"
        );
        if (appliedFilters) {
          const colorFilter = Array.from(
            appliedFilters.querySelectorAll(".fnl-plp-afliter")
          ).find(
            (filter) =>
              filter.querySelector(".pull-left").textContent.trim() ===
              colorValue
          );

          if (colorFilter) {
            console.log("[Content Script] Color already applied:", colorValue);
            appliedCount++;
            continue;
          }
        }

        // Try to find and click the color facet to open the modal
        const colorFacet = document.querySelector(
          '.cat-facets .facet-left-pane-label[aria-label="colors"]'
        );
        if (colorFacet) {
          console.log("[Content Script] Found color facet, clicking to expand");
          colorFacet.closest(".facet-head").click();
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Look for the color in the modal
          const colorModal = document.querySelector(".more-popup-container");
          if (colorModal) {
            console.log("[Content Script] Found color modal");

            // Find the color checkbox in the modal
            const colorCheckbox = Array.from(
              colorModal.querySelectorAll('input[name="verticalcolorfamily"]')
            ).find((input) => {
              const label = input.closest("label");
              const colorName = label
                .querySelector(".facet-list-title-name")
                ?.textContent.trim();
              return (
                colorName &&
                colorName.toLowerCase() === colorValue.toLowerCase()
              );
            });

            if (colorCheckbox) {
              console.log(
                `[Content Script] Found color checkbox for: ${colorValue}`
              );

              // Click the checkbox if not already checked
              if (!colorCheckbox.checked) {
                colorCheckbox.click();
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Click the Apply button in the modal
                const applyButton = colorModal.querySelector(
                  ".apply-popup-button"
                );
                if (applyButton) {
                  console.log(
                    "[Content Script] Clicking Apply button in color modal"
                  );
                  applyButton.click();
                  appliedCount++;
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                }
              } else {
                console.log(
                  `[Content Script] Color ${colorValue} already checked`
                );
                appliedCount++;
              }
            } else {
              console.warn(
                `[Content Script] Color option not found in modal: ${colorValue}`
              );
            }
          } else {
            // If modal not found, try the regular color options
            const colorOptions = document.querySelectorAll(
              ".facet-linkname-verticalcolorfamily"
            );
            let colorFound = false;

            for (const option of colorOptions) {
              const optionText = option.textContent.trim().toLowerCase();
              if (optionText.includes(colorValue.toLowerCase())) {
                console.log(
                  "[Content Script] Found matching color option, clicking"
                );
                const checkbox = option
                  .closest(".facet-linkfref")
                  .querySelector('input[type="checkbox"]');
                if (checkbox && !checkbox.checked) {
                  checkbox.click();
                  colorFound = true;
                  appliedCount++;
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  break;
                }
              }
            }

            if (!colorFound) {
              console.warn(
                `[Content Script] Color option not found: ${colorValue}`
              );
            }
          }
        } else {
          console.warn("[Content Script] Color facet not found");
        }
      }
    } catch (error) {
      console.error(
        `[Content Script] Error applying color filter ${colorValue}:`,
        error
      );
      // Continue with next color instead of breaking
    }
  }

  console.log(
    `[Content Script] Successfully applied ${appliedCount} out of ${colors.length} color filters`
  );
  return appliedCount > 0;
}

// Update applySizeFilters to handle multiple sizes better
export async function applySizeFilters(sizes, site) {
  console.log(`[Content Script] Applying size filters:`, sizes);
  let appliedCount = 0;

  for (const size of sizes) {
    let sizeValue = typeof size === "string" ? size : size.text;
    console.log(
      `[Content Script] Attempting to apply size filter: ${sizeValue}`
    );

    try {
      if (site === "myntra") {
        // Find and click the size filter in the horizontal filters
        const sizeFilter = document.querySelector(
          '.atsa-filters li label input[value="size_facet"]'
        );
        if (sizeFilter) {
          console.log("[Content Script] Found size filter, clicking to expand");
          sizeFilter.click();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Find and select the size in the filter options
          const sizeOptions = document.querySelectorAll(".atsa-values label");
          let sizeFound = false;

          for (const option of sizeOptions) {
            const optionText = option.textContent.trim().toLowerCase();
            if (optionText === sizeValue.toLowerCase()) {
              console.log(
                "[Content Script] Found matching size option, clicking"
              );
              const checkbox = option.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                sizeFound = true;
                appliedCount++;
                await new Promise((resolve) => setTimeout(resolve, 500));
                break;
              }
            }
          }

          if (!sizeFound) {
            console.warn(
              `[Content Script] Size option not found: ${sizeValue}`
            );
          }
        } else {
          console.warn(
            "[Content Script] Size filter not found in horizontal filters"
          );
        }
      } else if (site === "ajio") {
        // First try to find the size in the breadcrumb container
        const appliedFilters = document.querySelector(
          ".fnl-plp-appliedFliters"
        );
        if (appliedFilters) {
          const sizeFilter = Array.from(
            appliedFilters.querySelectorAll(".fnl-plp-afliter")
          ).find(
            (filter) =>
              filter.querySelector(".pull-left").textContent.trim() ===
              sizeValue
          );

          if (sizeFilter) {
            console.log("[Content Script] Size already applied:", sizeValue);
            appliedCount++;
            continue;
          }
        }

        // If not found in breadcrumb, try to apply through facet list
        const sizeFacet = document.querySelector(
          '.cat-facets .facet-left-pane-label[aria-label="size & fit"]'
        );
        if (sizeFacet) {
          console.log("[Content Script] Found size facet, clicking to expand");
          sizeFacet.closest(".facet-head").click();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Find and select the size in the facet list
          const sizeOptions = document.querySelectorAll(
            ".facet-linkname-verticalsizegroupformat"
          );
          let sizeFound = false;

          for (const option of sizeOptions) {
            const optionText = option.textContent.trim().toLowerCase();
            if (optionText.includes(sizeValue.toLowerCase())) {
              console.log(
                "[Content Script] Found matching size option, clicking"
              );
              const checkbox = option
                .closest(".facet-linkfref")
                .querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                sizeFound = true;
                appliedCount++;
                await new Promise((resolve) => setTimeout(resolve, 500));
                break;
              }
            }
          }

          if (!sizeFound) {
            console.warn(
              `[Content Script] Size option not found: ${sizeValue}`
            );
          }
        } else {
          console.warn("[Content Script] Size facet not found");
        }
      }
    } catch (error) {
      console.error(
        `[Content Script] Error applying size filter ${sizeValue}:`,
        error
      );
      // Continue with next size instead of breaking
    }
  }

  console.log(
    `[Content Script] Successfully applied ${appliedCount} out of ${sizes.length} size filters`
  );
  return appliedCount > 0;
}
// Apply filters to the page
export async function applyFilters(filters) {
  const hostname = window.location.hostname;

  try {
    console.log("[Content Script] Starting to apply filters:", filters);

    // Wait for the page to be fully loaded
    if (document.readyState !== "complete") {
      console.log("[Content Script] Waiting for page to load...");
      await new Promise((resolve) => {
        window.addEventListener("load", resolve);
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
      originSite: filters.originSite || null,
    };

    let result;
    if (hostname.includes("myntra.com")) {
      console.log("[Content Script] Applying filters on Myntra");
      result = await applyCrossSiteFilters(normalizedFilters, "myntra");
    } else if (hostname.includes("ajio.com")) {
      console.log("[Content Script] Applying filters on Ajio");
      result = await applyCrossSiteFilters(normalizedFilters, "ajio");
    } else if (hostname.includes("amazon.in")) {
      console.log("[Content Script] Applying filters on Amazon");
      result = await applyAmazonFilters(normalizedFilters);
    } else if (hostname.includes("flipkart.com")) {
      console.log("[Content Script] Applying filters on Flipkart");
      result = await applyFlipkartFilters(normalizedFilters);
    } else if (hostname.includes("snapdeal.com")) {
      console.log("[Content Script] Applying filters on Snapdeal");
      result = await applySnapdealFilters(normalizedFilters);
    } else if (hostname.includes("nykaa.com")) {
      console.log("[Content Script] Applying filters on Nykaa");
      result = await applyNykaaFilters(normalizedFilters);
    }

    // Return success even if some filters couldn't be applied
    return {
      success: true,
      result: result,
      partialSuccess: result?.partialSuccess || false,
    };
  } catch (error) {
    console.error("[Content Script] Error in applyFilters:", error);
    // Return a more informative error response
    return {
      success: false,
      error: error.message,
      partialSuccess: false,
    };
  }
}
