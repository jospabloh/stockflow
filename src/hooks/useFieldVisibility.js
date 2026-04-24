import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { canViewField, getVisibleFields } from '@/lib/fieldVisibilityConfig';

/**
 * Hook para gestionar visibilidad de campos según rol y módulo
 * @param {string} moduleName - Nombre del módulo (ej: "Dashboard", "Products")
 * @returns {object} - Métodos para verificar visibilidad de campos
 */
export function useFieldVisibility(moduleName) {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(user => {
        setUserRole(user?.role || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const canSee = (fieldName) => {
    if (!userRole) return false;
    return canViewField(moduleName, userRole, fieldName);
  };

  const getVisibleFieldList = () => {
    if (!userRole) return {};
    return getVisibleFields(moduleName, userRole);
  };

  const conditionalRender = (fieldName, component, fallback = null) => {
    if (canSee(fieldName)) return component;
    return fallback;
  };

  return {
    canSee,
    getVisibleFieldList,
    conditionalRender,
    userRole,
    loading,
  };
}