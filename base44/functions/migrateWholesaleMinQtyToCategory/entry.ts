import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * migrateWholesaleMinQtyToCategory
 *
 * One-time migration: reads wholesale_min_qty from Product records that still have it set,
 * groups by category, detects conflicts (products in same category have different values),
 * and writes the threshold to the Category entity.
 *
 * Safe to run multiple times (idempotent: only updates if category has no threshold set yet).
 * Admin-only endpoint.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'User has no business assigned' }, { status: 400 });
    }

    // Fetch all products and categories for this business
    const [products, categories] = await Promise.all([
      base44.asServiceRole.entities.Product.filter({ business_id: businessId }),
      base44.asServiceRole.entities.Category.filter({ business_id: businessId }),
    ]);

    const catMap = {};
    for (const c of categories) catMap[c.id] = c;

    // Group products that still have wholesale_min_qty set (legacy field) by category
    const byCategory = {}; // { category_id: [{ product_name, wholesale_min_qty }] }
    let productsWithLegacyField = 0;

    for (const p of products) {
      // Only process if the product still has a meaningful value in this legacy field
      if (p.wholesale_min_qty != null && Number(p.wholesale_min_qty) > 0 && p.category) {
        productsWithLegacyField++;
        if (!byCategory[p.category]) byCategory[p.category] = [];
        byCategory[p.category].push({ product_name: p.name, wholesale_min_qty: Number(p.wholesale_min_qty) });
      }
    }

    const results = [];
    const conflicts = [];

    for (const [catId, entries] of Object.entries(byCategory)) {
      const category = catMap[catId];
      if (!category) {
        results.push({ category_id: catId, status: 'skipped', reason: 'Category not found' });
        continue;
      }

      // Already migrated — skip to avoid overwrite
      if (category.wholesale_min_qty != null && Number(category.wholesale_min_qty) > 0) {
        results.push({ category_id: catId, category_name: category.name, status: 'skipped', reason: 'Category already has wholesale_min_qty set' });
        continue;
      }

      // Detect conflicts: all entries should have the same value
      const uniqueValues = [...new Set(entries.map(e => e.wholesale_min_qty))];

      if (uniqueValues.length > 1) {
        conflicts.push({
          category_id: catId,
          category_name: category.name,
          conflict: `Products in this category have different wholesale_min_qty values: ${uniqueValues.join(', ')}`,
          products: entries,
        });
        results.push({ category_id: catId, category_name: category.name, status: 'conflict', reason: `Multiple values found: ${uniqueValues.join(', ')}` });
        continue;
      }

      // Single consistent value — migrate
      const valueToSet = uniqueValues[0];
      await base44.asServiceRole.entities.Category.update(catId, { wholesale_min_qty: valueToSet });
      results.push({ category_id: catId, category_name: category.name, status: 'migrated', wholesale_min_qty: valueToSet, source_products: entries.length });
    }

    const migrated = results.filter(r => r.status === 'migrated').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const conflicted = results.filter(r => r.status === 'conflict').length;

    return Response.json({
      success: true,
      summary: {
        products_with_legacy_field: productsWithLegacyField,
        categories_processed: Object.keys(byCategory).length,
        migrated,
        skipped,
        conflicted,
      },
      results,
      conflicts,
      note: conflicts.length > 0
        ? 'Some categories had conflicting values. Review manually and set wholesale_min_qty in Category settings.'
        : 'Migration complete. Review and remove wholesale_min_qty from Product records if desired.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});