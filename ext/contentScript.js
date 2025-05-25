import { applyFilters } from "./filters/applyFilters";
import { getCurrentFilters } from "./filters/helpers";

// Message listener for popup communication
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("[Content Script] Received message:", request.action);

  if (request.action === "ping") {
    console.log("[Content Script] Ping received, sending pong");
    sendResponse({ status: "connected" });
    return true;
  }

  if (request.action === "getCurrentFilters") {
    console.log("[Content Script] Getting current filters...");

    // Set a timeout to prevent message channel from closing
    let responseSent = false;
    let responseTimeout = setTimeout(() => {
      if (!responseSent) {
        console.log(
          "[Content Script] Sending timeout response for getCurrentFilters"
        );
        responseSent = true;
        sendResponse({
          filters: null,
          error: "Timeout getting filters, please try again",
        });
      }
    }, 20000); // 20 second timeout

    getCurrentFilters()
      .then((filters) => {
        clearTimeout(responseTimeout);
        if (!responseSent) {
          console.log(
            "[Content Script] Sending filters to popup:",
            JSON.stringify(filters, null, 2)
          );
          responseSent = true;
          sendResponse({
            filters: {
              url: window.location.href,
              data: filters,
            },
          });
        }
      })
      .catch((error) => {
        clearTimeout(responseTimeout);
        if (!responseSent) {
          console.error("[Content Script] Error getting filters:", error);
          responseSent = true;
          sendResponse({ filters: null, error: error.message });
        }
      });

    return true;
  } else if (request.action === "applyFilters") {
    console.log(
      "[Content Script] Applying filters:",
      JSON.stringify(request.filters, null, 2)
    );

    // Set a timeout to ensure response is sent before message channel closes
    let responseSent = false;
    let responseTimeout = setTimeout(() => {
      if (!responseSent) {
        console.log(
          "[Content Script] Sending timeout response to prevent channel closing"
        );
        responseSent = true;
        sendResponse({
          success: false,
          error: "Operation taking too long, continuing in background",
        });
      }
    }, 20000); // 20 second timeout

    // Process the request
    applyFilters(request.filters)
      .then((result) => {
        clearTimeout(responseTimeout);
        if (!responseSent) {
          console.log("[Content Script] Filters applied successfully", result);
          responseSent = true;
          sendResponse({ success: true, result: result });
        }
      })
      .catch((error) => {
        clearTimeout(responseTimeout);
        if (!responseSent) {
          console.error("[Content Script] Error applying filters:", error);
          responseSent = true;
          sendResponse({ success: false, error: error.message });
        }
      });

    return true;
  }
});
