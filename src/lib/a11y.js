/**
 * Accessibility utilities and ARIA helpers
 */

export const ariaLabels = {
  tableHeader: 'Tabla de datos',
  tableSort: (column) => `Ordenar por ${column}`,
  tableDelete: 'Eliminar fila',
  tableEdit: 'Editar fila',
  modalClose: 'Cerrar diálogo',
  formSubmit: 'Enviar formulario',
  formCancel: 'Cancelar',
  searchInput: 'Buscar',
  filterInput: 'Filtrar resultados',
  dialogTitle: 'Diálogo modal',
};

export const roles = {
  table: 'table',
  rowgroup: 'rowgroup',
  row: 'row',
  cell: 'cell',
  columnheader: 'columnheader',
  modal: 'dialog',
  alert: 'alert',
  menuitem: 'menuitem',
};

export function createTableProps(tableId) {
  return {
    role: roles.table,
    'aria-label': ariaLabels.tableHeader,
    id: tableId,
  };
}

export function createModalProps(modalId, title) {
  return {
    role: roles.modal,
    'aria-labelledby': `${modalId}-title`,
    'aria-modal': 'true',
    id: modalId,
  };
}

export function createButtonProps(action) {
  const labels = {
    delete: 'Eliminar',
    edit: 'Editar',
    save: 'Guardar',
    cancel: 'Cancelar',
    add: 'Agregar',
    close: 'Cerrar',
  };
  return {
    'aria-label': labels[action] || action,
  };
}