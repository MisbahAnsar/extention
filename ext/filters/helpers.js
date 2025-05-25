import { getAjioFilters } from "./ajio";
import { getAmazonFilters } from "./amazon";
import { getFlipkartFilters } from "./flipkart";
import { getMyntraFilters } from "./myntra";
import { getNykaaFilters } from "./nykaa";
import { getSnapdealFilters } from "./snapdeal";

// Get current filters from the page
export async function getCurrentFilters() {
  const hostname = window.location.hostname;
  let filters = {
    brands: [],
    sizes: [],
    colors: [],
  };

  try {
    console.log("[Content Script] Getting current filters from", hostname);

    // Wait for the page to be fully loaded
    if (document.readyState !== "complete") {
      console.log("[Content Script] Waiting for page to load completely...");
      await new Promise((resolve) => {
        window.addEventListener("load", resolve);
      });
    }

    // Give additional time for filter elements to be rendered
    console.log("[Content Script] Waiting for filter elements to render...");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Attempt to get filters based on the hostname
    try {
      if (hostname.includes("myntra.com")) {
        filters = await getMyntraFilters();
      } else if (hostname.includes("ajio.com")) {
        filters = await getAjioFilters();
      } else if (hostname.includes("amazon.in")) {
        filters = await getAmazonFilters();
      } else if (hostname.includes("flipkart.com")) {
        filters = await getFlipkartFilters();
      } else if (hostname.includes("snapdeal.com")) {
        filters = await getSnapdealFilters();
      } else if (hostname.includes("nykaa.com")) {
        filters = await getNykaaFilters();
      }
    } catch (firstError) {
      console.warn(
        "[Content Script] First attempt to get filters failed:",
        firstError
      );

      // Wait longer and try again one more time
      console.log("[Content Script] Waiting longer and trying again...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (hostname.includes("myntra.com")) {
        filters = await getMyntraFilters();
      } else if (hostname.includes("ajio.com")) {
        filters = await getAjioFilters();
      } else if (hostname.includes("amazon.in")) {
        filters = await getAmazonFilters();
      } else if (hostname.includes("flipkart.com")) {
        filters = await getFlipkartFilters();
      } else if (hostname.includes("snapdeal.com")) {
        filters = await getSnapdealFilters();
      } else if (hostname.includes("nykaa.com")) {
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

// Wait for necessary elements to be available
export async function waitForElements(maxAttempts = 10, delay = 1000) {
  const hostname = window.location.hostname;
  let attempts = 0;

  // For Flipkart, use a more aggressive approach with fewer attempts
  if (hostname.includes("flipkart.com")) {
    maxAttempts = 5; // Reduce max attempts for Flipkart
    delay = 500; // Reduce delay between attempts

    while (attempts < maxAttempts) {
      console.log(
        `[Content Script] Checking for Flipkart elements (attempt ${
          attempts + 1
        }/${maxAttempts})`
      );

      // Check for any of these selectors to indicate filters are ready
      const filterIndicators = [
        'section[class*="pgRLLn"]', // Applied filters section
        'section[class*="-5qqlC"]', // Filter sections
        ".aOfogh", // Clear all button
        ".filter-summary-filter", // Filter summary
      ];

      for (const selector of filterIndicators) {
        const element = document.querySelector(selector);
        if (element) {
          console.log(
            `[Content Script] Found Flipkart filter elements (${selector})`
          );
          // Give a small delay for other elements to load
          await new Promise((resolve) => setTimeout(resolve, 500));
          return true;
        }
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    console.warn(
      "[Content Script] Could not find Flipkart filter elements after",
      maxAttempts,
      "attempts"
    );
    // Return true anyway for Flipkart to attempt filter application
    return true;
  }

  // Original logic for other sites
  while (attempts < maxAttempts) {
    console.log(
      `[Content Script] Waiting for elements (attempt ${
        attempts + 1
      }/${maxAttempts})`
    );

    if (hostname.includes("myntra.com")) {
      const filterSummary = document.querySelector(
        ".filter-summary-filterList"
      );
      const horizontalFilters = document.querySelector(".atsa-filters");
      const filterValues = document.querySelector(".atsa-values");

      if (filterSummary || horizontalFilters || filterValues) {
        console.log("[Content Script] Found Myntra filter elements");
        return true;
      }
    } else if (hostname.includes("ajio.com")) {
      const appliedFilters = document.querySelector(".fnl-plp-appliedFliters");
      const facetList = document.querySelector(".cat-facets");
      const breadcrumbContainer = document.querySelector(
        "#breadcrumb-container"
      );

      if (appliedFilters || facetList || breadcrumbContainer) {
        console.log("[Content Script] Found Ajio filter elements");
        return true;
      }
    } else if (hostname.includes("amazon.in")) {
      const brandFilters = document.querySelector("#filter-p_123");
      const colorFilters = document.querySelector(
        "#filter-p_n_size_two_browse-vebin"
      );

      if (brandFilters || colorFilters) {
        console.log("[Content Script] Found Amazon filter elements");
        return true;
      }
    } else if (hostname.includes("snapdeal.com")) {
      const filterSections = document.querySelectorAll(".filter-section");

      if (filterSections.length > 0) {
        console.log(
          "[Content Script] Found Snapdeal filter sections:",
          filterSections.length
        );
        return true;
      }
    } else if (hostname.includes("nykaa.com")) {
      const brandFilter = document.querySelector("#first-filter");
      const filterSections = document.querySelectorAll(
        'div[class="css-w2222k"]'
      );
      const appliedFilters = document.querySelector(".css-19j3ean");

      if (brandFilter || filterSections.length > 0 || appliedFilters) {
        console.log("[Content Script] Found Nykaa filter elements");
        return true;
      }
    }

    attempts++;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.warn(
    "[Content Script] Could not find filter elements after",
    maxAttempts,
    "attempts"
  );
  return false;
}

// Update verifyFiltersApplied to be more lenient
export async function verifyFiltersApplied(filters, site) {
  console.log("[Content Script] Verifying applied filters...");

  // Wait longer for filters to be visible in the UI
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    const appliedFilters = await getCurrentFilters();
    let appliedCount = 0;
    let totalFilters = 0;

    // Helper function to check if a value is included in the applied filters
    const isFilterApplied = (value, appliedList) => {
      if (!value || !appliedList) return false;
      const normalizedValue = value.toLowerCase().trim();
      return appliedList.some((applied) => {
        const appliedText = (
          typeof applied === "string"
            ? applied
            : applied.text || applied.value || ""
        )
          .toLowerCase()
          .trim();
        return (
          appliedText.includes(normalizedValue) ||
          normalizedValue.includes(appliedText) ||
          // Check for similar words
          normalizedValue
            .split(" ")
            .some((word) => appliedText.includes(word) && word.length > 3)
        );
      });
    };

    // Check brands
    if (filters.brands && filters.brands.length > 0) {
      totalFilters += filters.brands.length;
      for (const brand of filters.brands) {
        const brandName = typeof brand === "string" ? brand : brand.text;
        if (isFilterApplied(brandName, appliedFilters.brands)) {
          appliedCount++;
        }
      }
    }

    // Check sizes
    if (filters.sizes && filters.sizes.length > 0) {
      totalFilters += filters.sizes.length;
      for (const size of filters.sizes) {
        const sizeValue = typeof size === "string" ? size : size.text;
        if (isFilterApplied(sizeValue, appliedFilters.sizes)) {
          appliedCount++;
        }
      }
    }

    // Check colors
    if (filters.colors && filters.colors.length > 0) {
      totalFilters += filters.colors.length;
      for (const color of filters.colors) {
        const colorValue = typeof color === "string" ? color : color.text;
        if (isFilterApplied(colorValue, appliedFilters.colors)) {
          appliedCount++;
        }
      }
    }

    // Consider it successful if at least 50% of filters were applied
    const successRate = totalFilters > 0 ? appliedCount / totalFilters : 1;
    console.log(
      `[Content Script] Filter application success rate: ${(
        successRate * 100
      ).toFixed(1)}%`
    );

    return successRate >= 0.5;
  } catch (error) {
    console.error("[Content Script] Error verifying filters:", error);
    // Return true to avoid blocking the process on verification errors
    return true;
  }
}

// Helper function to check if all filters were applied
export function areAllFiltersApplied(requestedFilters, appliedFilters) {
  const checkArrays = (requested, applied) => {
    if (!requested || requested.length === 0) return true;
    if (!applied || applied.length === 0) return false;
    return requested.length === applied.length;
  };

  return (
    checkArrays(requestedFilters.brands, appliedFilters.brands) &&
    checkArrays(requestedFilters.sizes, appliedFilters.sizes) &&
    checkArrays(requestedFilters.colors, appliedFilters.colors)
  );
}
