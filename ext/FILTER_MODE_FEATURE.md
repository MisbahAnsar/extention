# Filter Mode Feature Documentation

## Overview

The Filter Mode feature provides two distinct ways to view and interact with saved filters: **Single Mode** and **Multiple Mode**. This feature enhances the user experience by offering flexible filter management options.

## Feature Components

### 1. Filter Mode Dropdown
- **Location**: Between "Saved Searches" header and the filters list
- **Options**: Single (default) and Multiple
- **Persistence**: User's choice is saved in localStorage
- **Label**: "View Mode:" with accompanying dropdown

### 2. Single Mode (Default)

#### Characteristics:
- **Compact List View**: Shows saved filters as individual cards with filter names
- **Action Icons**: Each filter has an arrow icon (view details) and trash icon (delete)
- **Detail View**: Clicking the arrow shows filter breakdown with selection options
- **Individual Application**: Apply specific filters from a single saved set

#### User Flow:
1. User sees list of saved filter names with action buttons
2. Click arrow (▷) icon to view filter details
3. Detail view shows:
   - Back button to return to list
   - Filter name as header
   - Sections for Brands, Sizes, Colors (if available)
   - Select All/Clear All controls for each section
   - Checkboxes for individual filter options
   - Apply button to apply selected filters
4. User can select/deselect specific filters before applying
5. After applying, automatically returns to main list

#### Benefits:
- Clean, organized interface
- Focused interaction with one filter set at a time
- Clear navigation with back button
- Selective application of filters

### 3. Multiple Mode

#### Characteristics:
- **Expanded View**: All saved filters shown with their contents visible
- **Multi-Selection**: Checkboxes for entire filter sets and individual options
- **Bulk Application**: Apply filters from multiple saved sets simultaneously
- **Master Controls**: Filter-level checkboxes control all options within that filter

#### User Flow:
1. User sees all saved filters expanded with their contents
2. Each filter has:
   - Master checkbox to select/deselect all options in that filter
   - Individual checkboxes for each brand, size, color
3. Sticky Apply button at bottom shows when filters are selected
4. User can mix and match options from different saved filter sets
5. Apply button applies all selected filters together

#### Benefits:
- Complete overview of all available filters
- Ability to combine filters from different saved sets
- Bulk operations for efficiency
- Visual feedback with indeterminate states

## Technical Implementation

### HTML Structure
```html
<!-- Filter Mode Dropdown -->
<div class="filter-mode-bar">
  <label for="filterModeDropdown" class="filter-mode-label">View Mode:</label>
  <select id="filterModeDropdown" class="filter-mode-dropdown">
    <option value="single">Single</option>
    <option value="multiple">Multiple</option>
  </select>
</div>
```

### CSS Classes

#### Filter Mode Dropdown
- `.filter-mode-bar`: Container for the dropdown
- `.filter-mode-label`: Label styling
- `.filter-mode-dropdown`: Dropdown styling with hover and focus states

#### Single Mode
- `.single-mode-container`: Main container
- `.filter-item-single`: Individual filter cards
- `.filter-item-header`: Header with name and action buttons
- `.filter-action-btn`: Action buttons (view details, delete)
- `.filter-details-view`: Detailed view container
- `.filter-details-header`: Detail view header with back button
- `.filter-section`: Sections for brands, sizes, colors
- `.filter-options-grid`: Grid layout for filter options
- `.filter-option-item`: Individual filter option with checkbox

#### Multiple Mode
- `.multiple-mode-container`: Main container
- `.filter-item-multiple`: Individual filter cards
- `.filter-item-multiple-header`: Header with master checkbox
- `.filter-item-multiple-content`: Expanded content area
- `.multiple-mode-apply`: Sticky apply section
- `.multiple-mode-apply-btn`: Apply button for multiple mode

### JavaScript Functions

#### Core Functions
- `renderFiltersInCurrentMode()`: Main router function
- `renderSingleModeFilters()`: Renders single mode interface
- `renderMultipleModeFilters()`: Renders multiple mode interface
- `renderFilterDetails(filterSet)`: Renders detail view for single mode

#### Event Handlers
- Filter mode dropdown change handler
- Single mode action button handlers (view details, delete)
- Multiple mode checkbox handlers (master and individual)
- Apply button handlers for both modes

#### State Management
- `currentFilterMode`: Tracks current mode ('single' or 'multiple')
- `currentDetailView`: Tracks which filter is being viewed in detail (single mode)
- `allSavedFilters`: Array of all compatible saved filters

## Integration

### With Existing Features
- **Brand List**: Filter mode bar hidden when brand list is open
- **Delete Functionality**: Updated to work with new rendering system
- **Toast Notifications**: Proper feedback for filter applications
- **Cross-site Compatibility**: Maintains existing cross-site filter application

### Data Flow
1. `loadSavedFilters()` populates `allSavedFilters` array
2. `renderFiltersInCurrentMode()` determines which render function to call
3. Mode-specific render functions create appropriate UI
4. User interactions trigger filter application through existing pipeline
5. Results display through existing toast notification system

## User Benefits

1. **Flexibility**: Choose between focused (Single) or comprehensive (Multiple) views
2. **Efficiency**: Multiple mode allows bulk operations
3. **Clarity**: Single mode provides clear, focused interaction
4. **Consistency**: Maintains existing filter application logic
5. **Persistence**: Mode preference saved across sessions

## Design Principles

1. **Non-breaking**: Existing functionality preserved
2. **Intuitive**: Clear visual hierarchy and interaction patterns
3. **Responsive**: Proper spacing and layout for extension popup
4. **Accessible**: Proper labels and keyboard navigation
5. **Performance**: Efficient rendering and state management

## Future Enhancements

Potential improvements that could be added:
1. Drag-and-drop reordering of filters
2. Grouping of filters by origin site
3. Quick preview of filter effects
4. Bulk delete operations in multiple mode
5. Export/import filter sets
6. Search functionality within filter modes 