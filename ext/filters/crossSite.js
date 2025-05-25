// Cross-site filter application
import { applyMyntraFilters } from "./myntra.js";
import { applyAjioFilters } from "./ajio.js";
import { applyAmazonFilters } from "./amazon.js";
import { applyFlipkartFilters } from "./flipkart.js";
import { applySnapdealFilters } from "./snapdeal.js";
import { applyNykaaFilters } from "./nykaa.js";
import { waitForElements, verifyFiltersApplied } from "./helpers.js";

// Unified filter application that works across sites
export async function applyCrossSiteFilters(filters, site) {
  console.log(
    `[Content Script] Applying cross-site filters for ${site}:`,
    filters
  );

  try {
    // Wait for filter elements to be present
    const elementsFound = await waitForElements();
    if (!elementsFound) {
      throw new Error("Filter elements not found on the page");
    }

    let result;

    // Apply filters based on the site
    if (site === "myntra") {
      result = await applyMyntraFilters(filters);
    } else if (site === "ajio") {
      result = await applyAjioFilters(filters);
    } else if (site === "amazon") {
      result = await applyAmazonFilters(filters);
    } else if (site === "flipkart") {
      result = await applyFlipkartFilters(filters);
    } else if (site === "snapdeal") {
      result = await applySnapdealFilters(filters);
    } else if (site === "nykaa") {
      result = await applyNykaaFilters(filters);
    } else {
      throw new Error(`Unsupported site: ${site}`);
    }

    // Verify filters were applied correctly
    const success = await verifyFiltersApplied(filters, site);
    if (!success && !result.partialSuccess) {
      throw new Error("Failed to verify all filters were applied correctly");
    }

    console.log(`[Content Script] Successfully applied filters on ${site}`);
    return result;
  } catch (error) {
    console.error(`[Content Script] Error applying filters on ${site}:`, error);
    throw error;
  }
}
