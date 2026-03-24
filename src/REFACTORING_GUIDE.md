# Refactoring Guide: SelectWrapper, Optimistic Updates & A11y

## Overview
This document outlines the refactoring applied to standardize UI components, implement optimistic mutations, and improve accessibility across the application.

---

## 1. SelectWrapper Component

**Location:** `components/wrappers/SelectWrapper.jsx`

**Purpose:** Unified wrapper around MobileSelect to provide:
- Responsive select on mobile (bottom sheet) and desktop (dropdown)
- Integrated ARIA labels and descriptions
- Consistent styling across the app

**Usage:**
```jsx
import SelectWrapper from "@/components/wrappers/SelectWrapper";

<SelectWrapper
  value={category}
  onValueChange={setCategory}
  placeholder="Selecciona categoría"
  ariaLabel="Filtrar por categoría"
  options={[
    { value: "all", label: "Todas" },
    { value: "1", label: "Electrónica" },
  ]}
/>
```

**Migration Path:**
- All `<MobileSelect>` components have been refactored to use `<SelectWrapper>`
- Pages refactored: Products, Movements
- Fallback support for Quotations (uses direct buttons instead of selects)

---

## 2. Optimistic Mutations Hook

**Location:** `hooks/useOptimisticMutation.js`

**Purpose:** Provides safe optimistic UI updates for mutations with automatic rollback on error.

**Features:**
- Optimistic updates on **update/delete only** (safer pattern)
- Auto-reverts on error
- Integrates with React Query for cache management

**Usage:**
```jsx
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { useQueryClient } from '@tanstack/react-query';

const mutation = useOptimisticMutation({
  mutationFn: async (newData) => {
    return await base44.entities.Product.update(id, newData);
  },
  queryKey: ['products'],
  optimisticData: updatedProductsList,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
});

mutation.mutate(newProductData);
```

---

## 3. Accessibility Utilities

**Location:** `lib/a11y.js`

**Purpose:** Centralized ARIA labels, roles, and helper functions for consistent A11y across the app.

**Available Helpers:**

### `createTableProps(tableId)`
Applies standard table ARIA attributes.

```jsx
<Table {...createTableProps('products-table')} />
```

### `createModalProps(modalId, title)`
Applies standard modal/dialog ARIA attributes.

```jsx
<AlertDialogContent {...createModalProps('delete-modal', 'Delete Item')} />
```

### `createButtonProps(action)`
Applies semantic button labels for common actions.

```jsx
<Button {...createButtonProps('delete')} onClick={handleDelete} />
```

---

## 4. Implementation Status

### ✅ Refactored Pages
- **Products:** SelectWrapper for category/stock filters, table ARIA roles, button ARIA labels
- **Movements:** SelectWrapper for type filter, table ARIA roles, search input label
- **ProductTable:** Comprehensive table roles (table, row, columnheader), action buttons with ARIA labels

### 📝 Partially Refactored
- **Quotations:** Search input A11y label, dialog ARIA attributes (button toggles remain as custom implementation due to complex state)

### 🔄 Implementation Pattern
Each refactoring follows this pattern:

1. **Import utilities**
   ```jsx
   import SelectWrapper from "@/components/wrappers/SelectWrapper";
   import { createTableProps } from "@/lib/a11y";
   ```

2. **Replace native selects**
   ```jsx
   // Before
   <MobileSelect value={filter} onValueChange={setFilter} ... />
   
   // After
   <SelectWrapper value={filter} onValueChange={setFilter} ariaLabel="..." />
   ```

3. **Add table ARIA roles**
   ```jsx
   <Table {...createTableProps('table-id')} />
   <TableRow role="row">
     <TableHead role="columnheader">Column Name</TableHead>
   </TableRow>
   ```

4. **Add input labels**
   ```jsx
   <Input placeholder="Search..." aria-label="Search products" />
   ```

5. **Add dialog ARIA**
   ```jsx
   <AlertDialogContent role="alertdialog" aria-labelledby="dialog-title">
     <AlertDialogTitle id="dialog-title">Confirm Delete</AlertDialogTitle>
   </AlertDialogContent>
   ```

---

## 5. Component Wrapper Architecture

The SelectWrapper demonstrates the "wrapper component" pattern for safe non-breaking refactoring:

```
MobileSelect (original)
    ↓ (wrapped by)
SelectWrapper (adds ARIA labels)
    ↓ (used in)
Pages (Products, Movements, Quotations)
```

This approach:
- ✅ Maintains backward compatibility
- ✅ Centralizes logic
- ✅ Allows gradual rollout
- ✅ Easy to update in one place

---

## 6. Migration Checklist

### For New Pages/Components
- [ ] Use `SelectWrapper` instead of `MobileSelect`
- [ ] Add `aria-label` to search/filter inputs
- [ ] Apply table ARIA roles via `createTableProps()`
- [ ] Apply button ARIA labels via `createButtonProps()`
- [ ] Use `createModalProps()` for dialogs

### For Existing Pages
- [ ] Replace `MobileSelect` with `SelectWrapper`
- [ ] Add `aria-label` to interactive inputs
- [ ] Add table ARIA attributes
- [ ] Add dialog ARIA attributes

---

## 7. Desktop Functionality Preserved

All refactoring maintains **full desktop functionality**:
- ✅ Responsive layouts unchanged
- ✅ TableSkeleton loading states
- ✅ Mobile card views
- ✅ Desktop table views
- ✅ Button interactions
- ✅ Form submissions
- ✅ Modal dialogs

No regression in visual styling or feature parity.

---

## 8. Testing Recommendations

### Visual Testing
- [ ] Test SelectWrapper on mobile (bottom sheet opens)
- [ ] Test SelectWrapper on desktop (dropdown opens)
- [ ] Verify table styling on all screen sizes

### Accessibility Testing
- [ ] Use a screen reader (NVDA, JAWS, VoiceOver) to navigate
- [ ] Verify all buttons have accessible labels
- [ ] Check tab navigation order on modals
- [ ] Use axe DevTools to scan for violations

### Functional Testing
- [ ] Filter operations work correctly
- [ ] Search inputs are responsive
- [ ] Dialog buttons trigger correct actions
- [ ] No console errors

---

## 9. Future Enhancements

Potential improvements for next phase:
1. Implement optimistic mutations across all CRUD operations
2. Add keyboard navigation to custom button groups (Quotations payment methods)
3. Create form field wrapper with automatic ARIA integration
4. Add focus management utilities for modals
5. Implement live region updates for async operations