/**
 * Precise VAT Calculator for Quotations
 * 
 * Rules:
 * - Product prices already include VAT when taxable (tax_rate = 16)
 * - VAT flag is only for breakdown display, never add VAT again
 * - Maintain internal precision, round only for display
 * - Reconcile line VAT values to total VAT via adjustment on last taxable line
 */

/**
 * Calculate VAT breakdown for a single line item
 * @param {number} lineTotal - Final line total (including VAT if taxable)
 * @param {number} taxRate - Tax rate (0 or 16)
 * @returns { netBase: number, vat: number } - Internal precision values
 */
export function calculateLineVAT(lineTotal, taxRate) {
  if (taxRate !== 16) {
    // Exempt: all amount is net base, no VAT
    return { netBase: lineTotal, vat: 0 };
  }
  
  // Taxable: extract VAT from included amount
  // lineTotal = netBase * 1.16
  // netBase = lineTotal / 1.16
  const netBase = lineTotal / 1.16;
  const vat = lineTotal - netBase;
  
  return { netBase, vat };
}

/**
 * Calculate totals with reconciliation
 * Adjusts the last taxable line VAT if needed to ensure:
 * Subtotal + VAT = Total (with rounding tolerance)
 * 
 * @param {Array} items - Quotation items with { total, tax_rate }
 * @returns {object} - { subtotal, tax, total, items: [...with vatDisplayed] }
 */
export function calculateTotalsWithReconciliation(items) {
  if (!items || items.length === 0) {
    return { subtotal: 0, tax: 0, total: 0, items: [] };
  }
  
  // Calculate all line VATs with full precision
  const lineBreakdowns = items.map((item, idx) => {
    const { netBase, vat } = calculateLineVAT(item.total || 0, item.tax_rate);
    return {
      idx,
      netBase,
      vat,
      isTaxable: item.tax_rate === 16,
      lineTotal: item.total || 0
    };
  });
  
  // Sum all bases and VATs
  let sumNetBase = 0;
  let sumVAT = 0;
  for (const bd of lineBreakdowns) {
    sumNetBase += bd.netBase;
    sumVAT += bd.vat;
  }
  
  const subtotal = sumNetBase;
  const total = subtotal + sumVAT;
  
  // Find last taxable line for adjustment
  let lastTaxableIdx = -1;
  for (let i = lineBreakdowns.length - 1; i >= 0; i--) {
    if (lineBreakdowns[i].isTaxable) {
      lastTaxableIdx = i;
      break;
    }
  }
  
  // Round for display and calculate rounding error
  const subtotalRounded = Math.round(subtotal * 100) / 100;
  const vatRounded = Math.round(sumVAT * 100) / 100;
  const totalRounded = subtotalRounded + vatRounded;
  
  // Calculate accumulated error that needs adjustment
  const calculatedTotal = sumNetBase + sumVAT;
  const displayTotal = subtotalRounded + vatRounded;
  const roundingError = calculatedTotal - displayTotal;
  
  // Create items with displayed VAT values
  const itemsWithDisplayVAT = items.map((item, idx) => {
    const bd = lineBreakdowns[idx];
    let displayVAT = Math.round(bd.vat * 100) / 100;
    
    // Apply adjustment to last taxable line if needed
    if (idx === lastTaxableIdx && lastTaxableIdx >= 0 && Math.abs(roundingError) > 0.001) {
      displayVAT = Math.round((bd.vat + roundingError) * 100) / 100;
    }
    
    return {
      ...item,
      // Internal values (full precision)
      _internalNetBase: bd.netBase,
      _internalVAT: bd.vat,
      // Display values (rounded)
      _displayVAT: displayVAT
    };
  });
  
  return {
    subtotal: subtotalRounded,
    tax: vatRounded,
    total: totalRounded,
    items: itemsWithDisplayVAT
  };
}

/**
 * Format a number for display
 */
export function formatMXN(num) {
  return (num || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}