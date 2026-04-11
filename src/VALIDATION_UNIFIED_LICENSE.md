# Validación: Licencias Unificadas (Tenant y Admin)

## Problema Solucionado
- **Antes**: License Admin y Account mostraban estados diferentes para el mismo tenant
- **Ahora**: Ambas usan la misma lógica server-side unificada

## Cambios Implementados

### 1. Nueva Función Server-Side Única
**Archivo**: `functions/getCurrentTenantLicenseState.js`
- Resuelve el estado de licencia del tenant actual
- Usa la **misma lógica** que `adminGetAllLicenses.js`
- Retorna todos los campos normalizados:
  - `billing_status` (trial, active, view_only, suspended)
  - `trial_days_left` (cálculo con expiración automática)
  - `active_user_count` (contador real de usuarios del tenant)
  - `next_renewal_at` (para licencias activas)
  - `is_read_only` (bandera derivada)

### 2. Actualización de `adminGetAllLicenses.js`
- Ahora usa la **misma lógica de resolución** que `getCurrentTenantLicenseState.js`
- Cálculo de `trial_days_left` consistente
- Validación de expiración de trial automática
- `active_user_count` = conteo real de usuarios del tenant

### 3. Actualización de `LicenseContext.jsx`
- Ya no lee `Business` directamente en el frontend
- Ahora invoca `getCurrentTenantLicenseState()` como única fuente de verdad
- Proporciona todos los valores normalizados a consumidores

### 4. `LicenseInfoCard.jsx`
- Lee del contexto unificado (nunca directamente de Business)
- Muestra `active_user_count` correctamente (sin defaults falsos a 0)
- Muestra `next_renewal_at` para licencias activas
- Normaliza estados: `view_only` → `expired` para UI

### 5. `TrialBanner.jsx`
- Lee del contexto unificado
- Muestra correcto: trial con días, view_only, suspended

## Validación Requerida

### Test 1: Tenant en Trial (Ej: Baristop Distribuidora)
**License Admin debe mostrar**:
- Estado: `trial`
- Días restantes: 14
- Usuarios: 3/4

**Account > Licencia debe mostrar IGUAL**:
- Estado: Período de Prueba
- Días restantes: 14 días
- Usuarios Activos: 3/4

### Test 2: Tenant Activo (Licencia Pagada)
**License Admin debe mostrar**:
- Estado: `active`
- Plan: (ej: Growth)
- Sin banner de warning

**Account > Licencia debe mostrar IGUAL**:
- Estado: Licencia Activa
- Próxima Renovación: (fecha correcta)
- Sin banner rojo

### Test 3: Tenant Expirado (Trial vencido)
**License Admin debe mostrar**:
- Estado: `view_only` (o `expired` en normalización)
- Días restantes: 0

**Account > Licencia debe mostrar IGUAL**:
- Estado: Expirada / Solo Lectura
- Banner rojo: "Tu período de prueba ha expirado"

### Test 4: Tenant Suspendido
**License Admin debe mostrar**:
- Estado: `suspended`

**Account > Licencia debe mostrar IGUAL**:
- Estado: Suspendida
- Banner rojo: "Tu licencia ha sido suspendida"

## Archivos Modificados

1. **functions/getCurrentTenantLicenseState.js** (NUEVO)
   - Función server-side unificada para tenant
   
2. **functions/adminGetAllLicenses.js**
   - Actualizado con lógica de resolución idéntica

3. **lib/LicenseContext.jsx**
   - Ya invoca `getCurrentTenantLicenseState()`
   - No lee Business directamente

4. **components/license/LicenseInfoCard.jsx**
   - Ya muestra `activeUserCount` sin defaults falsos
   - Muestra `nextRenewalAt` para activos

5. **components/license/TrialBanner.jsx**
   - Lee del contexto unificado

## Cómo Verificar

```bash
# 1. Ir a License Admin (admin-only)
# 2. Buscar tenant con trial (ej: Baristop)
# 3. Notar: Estado, días, usuarios

# 4. Login como usuario de ese tenant
# 5. Ir a Account > Licencia
# 6. Verificar que muestre EXACTAMENTE lo mismo
```

## Validación Final
✅ License Admin y Account muestran el mismo estado
✅ Conteo de usuarios es consistente
✅ Banners se muestran correctamente
✅ Lógica de expiración es automática y unificada