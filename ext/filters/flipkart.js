// Flipkart-specific functions
export async function getFlipkartFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: [],
  };

  // First check the summary section for applied filters
  const summarySection = document.querySelector('section[class*="pgRLLn"]');
  if (summarySection) {
    const appliedFilters = summarySection.querySelectorAll(".YcSYyC");
    for (const filter of appliedFilters) {
      const filterText = filter.querySelector("._6tw8ju")?.textContent.trim();
      if (filterText) {
        // Try to determine filter type based on the text
        if (filterText.match(/^(XS|S|M|L|XL|XXL|\d+(\.\d+)?)$/i)) {
          filters.sizes.push(filterText);
        } else if (
          filterText.match(
            /^(Black|White|Red|Blue|Green|Yellow|Beige|Brown|Grey|Pink|Purple|Orange|Navy|Maroon|Olive|Teal|Cyan|Magenta|Gold|Silver|Bronze|Multicolor|Printed|Striped|Floral|Geometric|Abstract|Animal Print|Camouflage|Tie & Dye|Ombre|Metallic|Glitter|Holographic|Neon|Pastel|Vintage|Washed|Faded|Distressed|Embellished|Sequined|Beaded|Quilted|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace|Crochet|Knit|Woven|Denim|Leather|Suede|Velvet|Satin|Silk|Cotton|Linen|Wool|Polyester|Nylon|Spandex|Rayon|Viscose|Acrylic|Fleece|Fur|Faux Fur|Mesh|Net|Lace)$/i
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

  // If no filters found in summary, check individual sections
  if (
    filters.brands.length === 0 &&
    filters.sizes.length === 0 &&
    filters.colors.length === 0
  ) {
    // Get selected brands
    const brandSection = Array.from(
      document.querySelectorAll('section[class*="-5qqlC"]')
    ).find((section) =>
      section.querySelector(".rgHxCQ")?.textContent.includes("Brand")
    );

    if (brandSection) {
      const brandLabels = brandSection.querySelectorAll(
        '.ewzVkT[class*="_3DvUAf"]'
      );
      for (const label of brandLabels) {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
          const brandText = label
            .querySelector('[class*="_6i1qKy"]')
            ?.textContent.trim();
          if (brandText) {
            filters.brands.push(brandText);
          }
        }
      }
    }

    // Get selected colors
    const colorSection = Array.from(
      document.querySelectorAll('section[class*="-5qqlC"]')
    ).find((section) =>
      section.querySelector(".rgHxCQ")?.textContent.includes("Color")
    );

    if (colorSection) {
      const colorLabels = colorSection.querySelectorAll(
        '.ewzVkT[class*="_3DvUAf"]'
      );
      for (const label of colorLabels) {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
          const colorText = label
            .querySelector('[class*="OJHqec"][class*="_6i1qKy"]')
            ?.textContent.trim();
          if (colorText) {
            filters.colors.push(colorText);
          }
        }
      }
    }

    // Get selected sizes
    const sizeSection = Array.from(
      document.querySelectorAll('section[class*="-5qqlC"]')
    ).find((section) =>
      section.querySelector(".rgHxCQ")?.textContent.includes("Size")
    );

    if (sizeSection) {
      const sizeLabels = sizeSection.querySelectorAll(
        '.ewzVkT[class*="_3DvUAf"]'
      );
      for (const label of sizeLabels) {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
          const sizeText = label
            .querySelector('[class*="_6i1qKy"]')
            ?.textContent.trim();
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

export async function applyFlipkartFilters(filters) {
  console.log("[Content Script] Applying Flipkart filters:", filters);

  try {
    // Helper function to simulate a real click event with proper mouse events
    const simulateClick = (element) => {
      const events = [
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      ];
      events.forEach((event) => element.dispatchEvent(event));
    };

    // Helper function to verify if a specific filter is applied
    const isFilterApplied = async (filterValue, type) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check in the summary section first (most reliable)
      const summarySection = document.querySelector('section[class*="pgRLLn"]');
      if (summarySection) {
        const appliedFilters = summarySection.querySelectorAll(".YcSYyC");
        for (const filter of appliedFilters) {
          const text = filter.querySelector("._6tw8ju")?.textContent.trim();
          if (text && text.toLowerCase() === filterValue.toLowerCase()) {
            console.log(
              `[Content Script] Filter verified in summary: ${filterValue}`
            );
            return true;
          }
        }
      }

      // If not found in summary, check checkboxes directly
      let filterSection;
      if (type === "brand") {
        filterSection = Array.from(
          document.querySelectorAll('section[class*="-5qqlC"]')
        ).find((section) =>
          section.querySelector(".rgHxCQ")?.textContent.includes("Brand")
        );
      } else if (type === "color") {
        filterSection = Array.from(
          document.querySelectorAll('section[class*="-5qqlC"]')
        ).find((section) =>
          section.querySelector(".rgHxCQ")?.textContent.includes("Color")
        );
      } else if (type === "size") {
        filterSection = Array.from(
          document.querySelectorAll('section[class*="-5qqlC"]')
        ).find((section) =>
          section.querySelector(".rgHxCQ")?.textContent.includes("Size")
        );
      }

      if (filterSection) {
        const filterElements = filterSection.querySelectorAll(
          '.ewzVkT[class*="_3DvUAf"]'
        );
        for (const element of filterElements) {
          const text = element
            .querySelector('[class*="_6i1qKy"]')
            ?.textContent.trim();
          if (text && text.toLowerCase() === filterValue.toLowerCase()) {
            const checkbox = element.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked) {
              console.log(
                `[Content Script] Filter verified by checkbox: ${filterValue}`
              );
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
      const clearAllButton = document.querySelector(".aOfogh span");
      if (clearAllButton) {
        console.log("[Content Script] Clearing all existing filters");
        simulateClick(clearAllButton);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify filters are cleared
        const summarySection = document.querySelector(
          'section[class*="pgRLLn"]'
        );
        if (summarySection) {
          const appliedFilters = summarySection.querySelectorAll(".YcSYyC");
          if (appliedFilters.length > 0) {
            console.log(
              "[Content Script] Some filters still present, trying to clear again"
            );
            simulateClick(clearAllButton);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }
    };

    // Helper function to expand filter section
    const expandSection = async (section, type) => {
      console.log(`[Content Script] Expanding ${type} section`);

      // For size section, handle differently
      if (type === "size") {
        // First try clicking the size header
        const sizeHeader = section.querySelector(".rgHxCQ");
        if (sizeHeader) {
          console.log("[Content Script] Clicking size header");
          simulateClick(sizeHeader);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        // Check if section is expanded
        let isExpanded = section.querySelector(".SDsN9S");
        if (!isExpanded) {
          // Try clicking the entire header section
          const header = section.querySelector(".FtQCb2");
          if (header) {
            console.log("[Content Script] Clicking entire header section");
            simulateClick(header);
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }

          // Check again if expanded
          isExpanded = section.querySelector(".SDsN9S");
          if (!isExpanded) {
            // Try clicking the parent section
            console.log("[Content Script] Clicking parent section");
            simulateClick(section);
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        // Final check for expansion
        isExpanded = section.querySelector(".SDsN9S");
        if (!isExpanded) {
          console.warn(
            "[Content Script] Could not expand size section after multiple attempts"
          );
          return false;
        }

        // Additional wait for size section to fully expand
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return true;
      }

      // For other sections, use the original logic
      const header = section.querySelector(".FtQCb2");
      if (header) {
        const isExpanded = section.querySelector(".SDsN9S");
        if (!isExpanded) {
          simulateClick(header);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      return section.querySelector(".SDsN9S") !== null;
    };

    // Helper function to apply a single filter with retries
    const applySingleFilter = async (
      section,
      filterValue,
      type,
      maxRetries = 3
    ) => {
      console.log(`[Content Script] Applying ${type} filter: ${filterValue}`);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(
          `[Content Script] Attempt ${attempt}/${maxRetries} for ${type} filter: ${filterValue}`
        );

        // Ensure section is expanded
        const isExpanded = await expandSection(section, type);
        if (!isExpanded) {
          console.warn(`[Content Script] Could not expand ${type} section`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
          return false;
        }

        // Find the filter element
        const filterElements = section.querySelectorAll(
          '.ewzVkT[class*="_3DvUAf"]'
        );
        let found = false;

        for (const element of filterElements) {
          const text = element
            .querySelector('[class*="_6i1qKy"]')
            ?.textContent.trim();
          if (text && text.toLowerCase() === filterValue.toLowerCase()) {
            found = true;
            console.log(
              `[Content Script] Found matching ${type} filter: ${filterValue}`
            );

            // Try multiple interaction methods
            const interactionMethods = [
              // Try clicking the checkbox directly
              async () => {
                const checkbox = element.querySelector(
                  'input[type="checkbox"]'
                );
                if (checkbox) {
                  simulateClick(checkbox);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  return await isFilterApplied(filterValue, type);
                }
                return false;
              },
              // Try clicking the label
              async () => {
                const label = element.querySelector("label");
                if (label) {
                  simulateClick(label);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  return await isFilterApplied(filterValue, type);
                }
                return false;
              },
              // Try clicking the entire element
              async () => {
                simulateClick(element);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                return await isFilterApplied(filterValue, type);
              },
            ];

            // Try each interaction method
            for (const method of interactionMethods) {
              const success = await method();
              if (success) {
                console.log(
                  `[Content Script] Successfully applied ${type} filter: ${filterValue}`
                );
                return true;
              }
            }

            // If all methods failed, try one more time with a longer delay
            await new Promise((resolve) => setTimeout(resolve, 2000));
            simulateClick(element);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const success = await isFilterApplied(filterValue, type);
            if (success) {
              return true;
            }
          }
        }

        // If filter not found and it's a color or size filter, try clicking "Click More"
        if (!found && (type === "color" || type === "size")) {
          const clickMoreButton = section.querySelector(
            ".e\\+xvXX.KvHRYS span"
          );
          if (clickMoreButton) {
            console.log(
              `[Content Script] ${type} filter not found in visible options, clicking 'Click More'`
            );
            simulateClick(clickMoreButton);
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Try finding the filter again after expanding
            const expandedFilterElements = section.querySelectorAll(
              '.ewzVkT[class*="_3DvUAf"]'
            );
            for (const element of expandedFilterElements) {
              const text = element
                .querySelector('[class*="_6i1qKy"]')
                ?.textContent.trim();
              if (text && text.toLowerCase() === filterValue.toLowerCase()) {
                console.log(
                  `[Content Script] Found matching ${type} filter after expanding: ${filterValue}`
                );

                // Try the same interaction methods
                const interactionMethods = [
                  async () => {
                    const checkbox = element.querySelector(
                      'input[type="checkbox"]'
                    );
                    if (checkbox) {
                      simulateClick(checkbox);
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      return await isFilterApplied(filterValue, type);
                    }
                    return false;
                  },
                  async () => {
                    const label = element.querySelector("label");
                    if (label) {
                      simulateClick(label);
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      return await isFilterApplied(filterValue, type);
                    }
                    return false;
                  },
                  async () => {
                    simulateClick(element);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    return await isFilterApplied(filterValue, type);
                  },
                ];

                for (const method of interactionMethods) {
                  const success = await method();
                  if (success) {
                    console.log(
                      `[Content Script] Successfully applied ${type} filter after expanding: ${filterValue}`
                    );
                    return true;
                  }
                }

                // If all methods failed, try one more time with a longer delay
                await new Promise((resolve) => setTimeout(resolve, 2000));
                simulateClick(element);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                const success = await isFilterApplied(filterValue, type);
                if (success) {
                  return true;
                }
              }
            }
          }
        }

        if (!found) {
          console.warn(
            `[Content Script] ${type} filter not found: ${filterValue}`
          );
        }

        // If this attempt failed and we have more retries, wait before trying again
        if (attempt < maxRetries) {
          console.log(
            `[Content Script] Retrying ${type} filter: ${filterValue}`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
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
        const currentTypeFilters = currentFilters[type + "s"] || [];
        console.log(
          `[Content Script] Current ${type} filters:`,
          currentTypeFilters
        );

        // Filter out already applied values
        const filtersToApply = filters.filter(
          (filter) => !currentTypeFilters.includes(filter)
        );

        if (filtersToApply.length === 0) {
          console.log(
            `[Content Script] All ${type} filters already applied, skipping`
          );
          // Add already applied filters to our tracking
          filters.forEach((filter) => {
            if (!appliedFilters[type + "s"].includes(filter)) {
              appliedFilters[type + "s"].push(filter);
            }
          });
          return;
        }

        console.log(
          `[Content Script] Applying ${filtersToApply.length} ${type} filters:`,
          filtersToApply
        );

        for (const filter of filtersToApply) {
          // Check if this specific filter was already applied (double-check)
          if (
            currentTypeFilters.includes(filter) ||
            appliedFilters[type + "s"].includes(filter)
          ) {
            console.log(
              `[Content Script] Filter ${filter} already applied, skipping`
            );
            if (!appliedFilters[type + "s"].includes(filter)) {
              appliedFilters[type + "s"].push(filter);
            }
            continue;
          }

          const success = await applySingleFilter(section, filter, type);
          if (success) {
            appliedFilters[type + "s"].push(filter);
            // Wait between applying filters of the same type
            await new Promise((resolve) => setTimeout(resolve, 2000));
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
      sizes: [],
    };

    // Check for brand filters
    if (filters.brands && filters.brands.length > 0) {
      const brandSection = Array.from(
        document.querySelectorAll('section[class*="-5qqlC"]')
      ).find((section) =>
        section.querySelector(".rgHxCQ")?.textContent.includes("Brand")
      );
      if (brandSection) {
        await applyFilterGroup(filters.brands, "brand", brandSection);
      }
    }

    // Wait before applying next filter type
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check for color filters
    if (filters.colors && filters.colors.length > 0) {
      const colorSection = Array.from(
        document.querySelectorAll('section[class*="-5qqlC"]')
      ).find((section) =>
        section.querySelector(".rgHxCQ")?.textContent.includes("Color")
      );
      if (colorSection) {
        await applyFilterGroup(filters.colors, "color", colorSection);
      }
    }

    // Wait before applying next filter type
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check for size filters
    if (filters.sizes && filters.sizes.length > 0) {
      const sizeSection = Array.from(
        document.querySelectorAll('section[class*="-5qqlC"]')
      ).find((section) =>
        section.querySelector(".rgHxCQ")?.textContent.includes("Size")
      );
      if (sizeSection) {
        // Additional wait for size section
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await applyFilterGroup(filters.sizes, "size", sizeSection);
      }
    }

    // Final verification
    console.log("[Content Script] Applied filters:", appliedFilters);

    // Calculate which filters we were unable to apply
    const unappliedFilters = {
      brands: filters.brands.filter(
        (brand) => !appliedFilters.brands.includes(brand)
      ),
      colors: filters.colors.filter(
        (color) => !appliedFilters.colors.includes(color)
      ),
      sizes: filters.sizes.filter(
        (size) => !appliedFilters.sizes.includes(size)
      ),
    };

    // Check if we have any unapplied filters
    const hasUnappliedFilters =
      unappliedFilters.brands.length > 0 ||
      unappliedFilters.colors.length > 0 ||
      unappliedFilters.sizes.length > 0;

    if (hasUnappliedFilters) {
      console.log(
        "[Content Script] Some filters were not applied:",
        unappliedFilters
      );

      // Only try once more with very specific values that weren't applied
      // and only if we have something to retry
      let retrySuccessful = false;

      if (unappliedFilters.brands.length > 0) {
        const brandSection = Array.from(
          document.querySelectorAll('section[class*="-5qqlC"]')
        ).find((section) =>
          section.querySelector(".rgHxCQ")?.textContent.includes("Brand")
        );
        if (brandSection) {
          for (const brand of unappliedFilters.brands) {
            // Skip if somehow it got applied in the meantime
            if (appliedFilters.brands.includes(brand)) continue;

            const success = await applySingleFilter(
              brandSection,
              brand,
              "brand"
            );
            if (success) {
              appliedFilters.brands.push(brand);
              retrySuccessful = true;
            }
          }
        }
      }

      if (unappliedFilters.colors.length > 0) {
        const colorSection = Array.from(
          document.querySelectorAll('section[class*="-5qqlC"]')
        ).find((section) =>
          section.querySelector(".rgHxCQ")?.textContent.includes("Color")
        );
        if (colorSection) {
          for (const color of unappliedFilters.colors) {
            // Skip if somehow it got applied in the meantime
            if (appliedFilters.colors.includes(color)) continue;

            const success = await applySingleFilter(
              colorSection,
              color,
              "color"
            );
            if (success) {
              appliedFilters.colors.push(color);
              retrySuccessful = true;
            }
          }
        }
      }

      if (unappliedFilters.sizes.length > 0) {
        const sizeSection = Array.from(
          document.querySelectorAll('section[class*="-5qqlC"]')
        ).find((section) =>
          section.querySelector(".rgHxCQ")?.textContent.includes("Size")
        );
        if (sizeSection) {
          for (const size of unappliedFilters.sizes) {
            // Skip if somehow it got applied in the meantime
            if (appliedFilters.sizes.includes(size)) continue;

            const success = await applySingleFilter(sizeSection, size, "size");
            if (success) {
              appliedFilters.sizes.push(size);
              retrySuccessful = true;
            }
          }
        }
      }

      // If retry was successful, update our list of unapplied filters
      if (retrySuccessful) {
        console.log(
          "[Content Script] Retry was partially successful, updated applied filters:",
          appliedFilters
        );
      }
    }

    // Return success even if not all filters were applied
    return {
      success: true,
      appliedFilters,
      partialSuccess: hasUnappliedFilters,
    };
  } catch (error) {
    console.error("[Content Script] Error applying Flipkart filters:", error);
    throw error;
  }
}
