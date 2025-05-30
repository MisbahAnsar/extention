# E-Commerce Filter Saver Extension - Installation Guide

## Overview
This browser extension allows you to save and reapply filters across multiple e-commerce platforms:
- **Myntra**
- **Ajio** 
- **Amazon India**
- **Flipkart**
- **TataCliq** ✨ (Newly Added)

## Installation Steps

### 1. Download and Prepare
1. Download or clone the extension files to your computer
2. Ensure you have the following files:
   - `manifest.json`
   - `contentScript.js`
   - `popup.html`
   - `popup.js`
   - `background.js`
   - `images/` folder with icons

### 2. Install in Chrome/Edge
1. Open Chrome/Edge browser
2. Navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the folder containing the extension files
6. The extension should now appear in your extensions list

### 3. Verify Installation
1. Visit any supported site (Myntra, Ajio, Amazon.in, Flipkart, or TataCliq)
2. Click the extension icon in your browser toolbar
3. You should see the "Filter Saver" popup without any error messages

## Testing TataCliq Functionality

### Quick Test
1. Open the included `test_tatacliq.html` file in your browser
2. Click "Test Get TataCliq Filters" to see if filter extraction works
3. Click "Test Apply Sample Filters" to see if filter application works

### Live Test on TataCliq
1. Visit [TataCliq.com](https://www.tatacliq.com/)
2. Navigate to any product category (e.g., men's shoes, women's clothing)
3. Apply some filters (brands, sizes, colors)
4. Click the extension icon and click "Save Current Filters"
5. Name your filter set and save it
6. Clear all filters on the page
7. Use the extension to reapply your saved filters

## Troubleshooting

### Extension Not Loading
**Problem**: Extension shows "This extension only works on..." error on TataCliq
**Solution**: 
- Make sure you have the latest version of the files
- Verify `manifest.json` includes `*://*.tatacliq.com/*` in both `host_permissions` and `content_scripts.matches`
- Try refreshing the TataCliq page after installing the extension

### Filters Not Being Detected
**Problem**: "No filters detected on the page" error
**Solutions**:
1. **Wait for page to load**: TataCliq loads filters dynamically. Wait 3-5 seconds after page load
2. **Apply filters first**: Make sure you have actually selected some filters before trying to save
3. **Check filter types**: Currently supports brands, sizes, and colors
4. **Refresh and retry**: Sometimes a page refresh helps

### Filters Not Being Applied
**Problem**: Saved filters don't apply correctly
**Solutions**:
1. **Ensure page is loaded**: Wait for the TataCliq page to fully load before applying filters
2. **Check filter availability**: Some filters might not be available on the current page
3. **Try partial application**: The extension will apply whatever filters it can find
4. **Clear existing filters**: Remove any existing filters before applying saved ones

### Content Script Issues
**Problem**: Extension popup doesn't work or shows connection errors
**Solutions**:
1. **Refresh the page**: This reloads the content script
2. **Check developer console**: Look for any JavaScript errors (F12 → Console)
3. **Reinstall extension**: Remove and reinstall the extension in developer mode

## Browser Compatibility
- ✅ **Chrome** (Version 88+)
- ✅ **Microsoft Edge** (Version 88+)
- ❌ **Firefox** (Not supported - uses Manifest V3)
- ❌ **Safari** (Not supported)

## Supported Filter Types

### TataCliq Specific
- **Brands**: Nike, Adidas, Puma, etc.
- **Sizes**: UK/IND sizes, EURO sizes, numeric sizes
- **Colors**: Standard color names (Black, White, Red, etc.)

### Cross-Platform Compatibility
Filters saved from TataCliq can be applied to other supported sites and vice versa, with intelligent matching based on:
- Brand name similarity
- Size format conversion
- Color name standardization

## Performance Tips
1. **Close filter modals**: If brand filter modals are open, close them before saving
2. **Wait between operations**: Allow 2-3 seconds between saving and applying filters
3. **Use specific filter names**: More specific brand/color names have better success rates

## Advanced Features
- **Cross-site filter application**: Save filters from Myntra and apply them on TataCliq
- **Partial filter matching**: Applies available filters even if some don't match
- **Filter validation**: Shows which filters were successfully applied
- **Dark/Light mode**: Toggle theme in the extension popup

## Getting Help
If you encounter issues:
1. Check the browser's developer console (F12) for error messages
2. Test with the included `test_tatacliq.html` file
3. Try refreshing the page and waiting longer for it to load
4. Verify you're on a supported TataCliq product listing page

## File Structure
```
extension/
├── manifest.json          # Extension configuration
├── contentScript.js       # Main filter detection/application logic
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── background.js         # Background service worker
├── test_tatacliq.html    # Test page for TataCliq functionality
├── README_TATACLIQ.md    # Technical documentation
└── images/               # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Version Information
- **Current Version**: 1.0
- **TataCliq Support**: Added in v1.0
- **Last Updated**: 2024

---

**Need Help?** Check the technical documentation in `README_TATACLIQ.md` for detailed implementation information. 