// Amazon.in-specific functions
export async function getAmazonFilters() {
  const filters = {
    brands: [],
    sizes: [],
    colors: [],
  };

  // Get selected brands
  const brandLinks = document.querySelectorAll(
    "#filter-p_123 .a-link-normal.s-navigation-item"
  );
  for (const link of brandLinks) {
    const checkbox = link.querySelector('input[type="checkbox"]');
    if (checkbox && checkbox.checked) {
      const brandText = link
        .querySelector(".a-size-base.a-color-base")
        ?.textContent.trim();
      if (brandText) {
        filters.brands.push(brandText);
      }
    }
  }

  // Get selected sizes
  const sizeLinks = document.querySelectorAll(
    "#filter-p_n_size_browse-vebin .a-link-normal.s-navigation-item"
  );
  for (const link of sizeLinks) {
    if (link.getAttribute("aria-current") === "true") {
      const sizeText = link
        .querySelector(".a-size-base.a-color-base")
        ?.textContent.trim();
      if (sizeText) {
        filters.sizes.push(sizeText);
      }
    }
  }

  // Get selected colors
  const colorLinks = document.querySelectorAll(
    "#filter-p_n_size_two_browse-vebin .a-link-normal.s-navigation-item"
  );
  for (const link of colorLinks) {
    const colorText = link.getAttribute("title");
    if (colorText && link.getAttribute("aria-current") === "true") {
      filters.colors.push(colorText);
    }
  }

  console.log("[Content Script] Extracted Amazon filters:", filters);
  return filters;
}

// Amazon.in-specific functions
export async function applyAmazonFilters(filters) {
  console.log("[Content Script] Applying Amazon filters:", filters);

  try {
    // Normalize filter values - handle both string and object formats
    const normalizedFilters = {
      brands: (filters.brands || []).map((b) =>
        typeof b === "string" ? b : b.text || b.value || b
      ),
      sizes: (filters.sizes || []).map((s) =>
        typeof s === "string" ? s : s.text || s.value || s
      ),
      colors: (filters.colors || []).map((c) =>
        typeof c === "string" ? c : c.text || c.value || c
      ),
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
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Click the element
        element.click();
        console.log(`[Content Script] Clicked ${description}`);
        // Reduced delay after clicking
        await new Promise((resolve) => setTimeout(resolve, 1500));
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
      colors: [],
    };

    // Helper function for fuzzy matching
    const fuzzyMatch = (value, candidate) => {
      if (!value || !candidate) return false;

      const valueNormalized = value.toLowerCase().trim();
      const candidateNormalized = candidate.toLowerCase().trim();

      return (
        valueNormalized.includes(candidateNormalized) ||
        candidateNormalized.includes(valueNormalized) ||
        valueNormalized
          .split(" ")
          .some((word) => candidateNormalized.includes(word) && word.length > 3)
      );
    };

    // Helper function to verify if a filter is currently applied
    const isFilterApplied = async (filterType, value) => {
      try {
        const currentFilters = await getAmazonFilters();
        return currentFilters[filterType].some((f) => fuzzyMatch(f, value));
      } catch (error) {
        console.error(
          `[Content Script] Error verifying ${filterType} filter:`,
          error
        );
        return false;
      }
    };

    // Apply brand filters first
    if (normalizedFilters.brands.length > 0) {
      console.log("[Content Script] Starting brand filter application");

      for (const brand of normalizedFilters.brands) {
        // Skip if brand is already applied
        if (await isFilterApplied("brands", brand)) {
          console.log(
            `[Content Script] Brand ${brand} is already applied, skipping`
          );
          appliedFilters.brands.push(brand);
          continue;
        }

        console.log(`[Content Script] Looking for brand: ${brand}`);
        const brandLinks = Array.from(
          document.querySelectorAll(
            "#filter-p_123 .a-link-normal.s-navigation-item"
          )
        );
        const brandMatches = brandLinks.filter((link) => {
          const brandText = link
            .querySelector(".a-size-base.a-color-base")
            ?.textContent.trim();
          return brandText && fuzzyMatch(brandText, brand);
        });

        if (brandMatches.length > 0) {
          const brandLink = brandMatches[0];
          const brandText = brandLink
            .querySelector(".a-size-base.a-color-base")
            ?.textContent.trim();

          const success = await waitAndClick(
            brandLink,
            `brand filter: ${brandText}`
          );
          if (success && (await isFilterApplied("brands", brand))) {
            appliedFilters.brands.push(brand);
            console.log(
              `[Content Script] Successfully applied brand filter: ${brand}`
            );
          }
        }
      }
    }

    // Apply color filters next
    if (normalizedFilters.colors.length > 0) {
      console.log("[Content Script] Starting color filter application");

      for (const color of normalizedFilters.colors) {
        // Skip if color is already applied
        if (await isFilterApplied("colors", color)) {
          console.log(
            `[Content Script] Color ${color} is already applied, skipping`
          );
          appliedFilters.colors.push(color);
          continue;
        }

        console.log(`[Content Script] Looking for color: ${color}`);
        const colorLinks = Array.from(
          document.querySelectorAll(
            "#filter-p_n_size_two_browse-vebin .a-link-normal.s-navigation-item"
          )
        );
        const colorMatches = colorLinks.filter((link) => {
          const titleText = link.getAttribute("title");
          const visibleText = link
            .querySelector(".a-size-base.a-color-base")
            ?.textContent.trim();
          return (
            (titleText && fuzzyMatch(titleText, color)) ||
            (visibleText && fuzzyMatch(visibleText, color))
          );
        });

        if (colorMatches.length > 0) {
          const colorLink = colorMatches[0];
          const colorText =
            colorLink.getAttribute("title") ||
            colorLink
              .querySelector(".a-size-base.a-color-base")
              ?.textContent.trim();

          const success = await waitAndClick(
            colorLink,
            `color filter: ${colorText}`
          );
          if (success && (await isFilterApplied("colors", color))) {
            appliedFilters.colors.push(color);
            console.log(
              `[Content Script] Successfully applied color filter: ${color}`
            );
          }
        }
      }
    }

    // Apply size filters last, with limited retries
    if (normalizedFilters.sizes.length > 0) {
      console.log("[Content Script] Starting size filter application");

      for (const size of normalizedFilters.sizes) {
        // Skip if size is already applied
        if (await isFilterApplied("sizes", size)) {
          console.log(
            `[Content Script] Size ${size} is already applied, skipping`
          );
          appliedFilters.sizes.push(size);
          continue;
        }

        console.log(`[Content Script] Looking for size: ${size}`);
        let attempts = 0;
        const maxAttempts = 5;
        let sizeApplied = false;

        while (attempts < maxAttempts && !sizeApplied) {
          const sizeLinks = Array.from(
            document.querySelectorAll(
              "#filter-p_n_size_browse-vebin .a-link-normal.s-navigation-item"
            )
          );
          const sizeMatches = sizeLinks.filter((link) => {
            const sizeText = link
              .querySelector(".a-size-base.a-color-base")
              ?.textContent.trim();
            return sizeText && fuzzyMatch(sizeText, size);
          });

          if (sizeMatches.length > 0) {
            const sizeLink = sizeMatches[0];
            const sizeText = sizeLink
              .querySelector(".a-size-base.a-color-base")
              ?.textContent.trim();

            const success = await waitAndClick(
              sizeLink,
              `size filter: ${sizeText}`
            );
            if (success && (await isFilterApplied("sizes", size))) {
              appliedFilters.sizes.push(size);
              console.log(
                `[Content Script] Successfully applied size filter: ${size}`
              );
              sizeApplied = true;
              break;
            }
          }

          attempts++;
          if (!sizeApplied) {
            console.log(
              `[Content Script] Attempt ${attempts}/${maxAttempts} failed for size: ${size}`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (!sizeApplied) {
          console.warn(
            `[Content Script] Size ${size} not found after ${maxAttempts} attempts. This size may not be available.`
          );
        }
      }
    }

    // Calculate success metrics
    const totalRequested =
      normalizedFilters.brands.length +
      normalizedFilters.colors.length +
      normalizedFilters.sizes.length;
    const totalApplied =
      appliedFilters.brands.length +
      appliedFilters.colors.length +
      appliedFilters.sizes.length;
    const isPartialSuccess = totalApplied > 0 && totalApplied < totalRequested;

    console.log("[Content Script] Filter application complete:", {
      requested: {
        brands: normalizedFilters.brands,
        colors: normalizedFilters.colors,
        sizes: normalizedFilters.sizes,
      },
      applied: appliedFilters,
      success: totalApplied > 0,
      partialSuccess: isPartialSuccess,
    });

    return {
      success: totalApplied > 0,
      appliedFilters,
      partialSuccess: isPartialSuccess,
    };
  } catch (error) {
    console.error("[Content Script] Error applying Amazon filters:", error);
    throw error;
  }
}
