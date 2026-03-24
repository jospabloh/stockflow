import React from 'react';
import { MobileSelect } from '@/components/ui/MobileSelect';

export default function SelectWrapper({ 
  value, 
  onValueChange, 
  options = [],
  placeholder = 'Selecciona una opción',
  ariaLabel,
  ariaDescription,
  disabled = false,
  ...props 
}) {
  return (
    <MobileSelect
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescription}
      {...props}
    />
  );
}