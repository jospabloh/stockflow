# 📋 Test del Generador de Códigos de Barras

## Flujo de Prueba Completo

### 1️⃣ **Crear un Producto sin Código de Barras**

1. Ve a **Productos**
2. Clic en **"+ Nuevo Producto"**
3. Rellena:
   - **Nombre:** "Cable USB-C Test"
   - **Precio Menudeo:** 150
   - **Stock:** 10
   - **Stock Mínimo:** 5
4. Deja **vacío** el campo "Código de barras"
5. Guarda el producto

**Resultado esperado:** Producto creado sin código de barras.

---

### 2️⃣ **Generar Código de Barras desde la Tabla**

1. Vuelve a la lista de **Productos**
2. Busca "Cable USB-C Test" en la tabla
3. Verás un **botón de código de barras 📦** (solo aparece si NO tiene código)
4. Haz clic en el botón

**Resultado esperado:** Redirige a `/BarcodeGenerator?productId=<ID>`

---

### 3️⃣ **Generador de Código de Barras**

Verás una página con:
- **Nombre del producto:** "Cable USB-C Test"
- **Estado:** 🟡 "Sin código de barras asignado"
- **Botón:** "Generar Código Único"

Haz clic en **"Generar Código Único"**

**Resultado esperado:**
- Se genera un código **único** (ej: `3NZQR45Z0K`)
- Aparece una **vista previa** del código de barras (imagen SVG)
- El código se muestra en texto mono

---

### 4️⃣ **Opciones con el Código Generado**

#### A. **Copiar al Portapapeles**
1. Haz clic en el botón **📋 Copiar** al lado del código
2. **Resultado:** Ves "✅ Copiado al portapapeles"

#### B. **Descargar como PDF**
1. Haz clic en **"Descargar PDF"**
2. Se descarga un archivo `barcode-3NZQR45Z0K.pdf` con:
   - Imagen del código de barras
   - Número del código
   - Nombre del producto
   - Formato A6 (perfecto para imprimir y pegar)

#### C. **Guardar en el Producto**
1. Haz clic en **"Guardar en Producto"**
2. **Resultado:** 
   - El código se guarda en la BD
   - Verás "✅ Código de barras guardado exitosamente"

---

### 5️⃣ **Verificar que el Código Se Guardó**

1. Vuelve a **Productos**
2. Busca "Cable USB-C Test"
3. Verás el código en la fila de la tabla (ej: `3NZQR45Z0K`)
4. El **botón de código de barras desaparece** (ya tiene código)
5. Si haces clic en "Editar", verás el código en el campo "Código de barras"

---

### 6️⃣ **Generar Otro Producto y Verificar Unicidad**

1. Crea otro producto: "Mouse Inalámbrico"
2. Sin código de barras
3. Abre el generador
4. Genera un código (ej: `5ABC7XYZ2M`)
5. Guarda el código

**Resultado esperado:** El nuevo código es **completamente diferente** del anterior (no hay duplicados).

---

## 🎯 Validaciones Automáticas

✅ **Unicidad:** Cada código es único incluso si generas múltiples

✅ **Vista Previa:** Se renderiza en tiempo real

✅ **Descarga PDF:** Funciona sin librerías externas (usa jsPDF que ya está instalado)

✅ **Persistencia:** El código se guarda en el producto

✅ **Integración:** El botón solo aparece en productos sin código

---

## 🔧 Datos Técnicos del Código Generado

**Formato:** `{TIMESTAMP_BASE36}{RANDOM_6CHARS}`

**Ejemplo breakdown:** `3NZQR45Z0K`
- `3NZQR45` → Timestamp en base36 (11:45 UTC del día)
- `Z0K` → 3 caracteres aleatorios

**Ventajas:**
- Único por timestamp + aleatoriedad
- Legible y escaneable
- No requiere BD adicional, puro cálculo

---

## 📸 Pantallazos Esperados

### Pantalla 1: Productos (sin código)
```
| Nombre           | SKU | Categoría | Precio | Stock | Estado | [Botón 📦]
| Cable USB-C Test | -   | -         | $150   | 10    | Activo | [📦]
```

### Pantalla 2: Generador
```
┌─────────────────────────────────────────┐
│ Generador de Códigos de Barras          │
│                                         │
│ Producto: Cable USB-C Test              │
│ 🟡 Sin código de barras asignado        │
│                                         │
│ [Generar Código Único]                  │
└─────────────────────────────────────────┘
```

### Pantalla 3: Código Generado
```
┌─────────────────────────────────────────┐
│ 📦 VISTA PREVIA                         │
│ ┌───────────────────────────────────┐   │
│ │  [BARCODE SVG RENDERIZADO]        │   │
│ │  3NZQR45Z0K                       │   │
│ │  Cable USB-C Test                 │   │
│ └───────────────────────────────────┘   │
│                                         │
│ [Copiar] [Descargar PDF] [Guardar]    │
│ [Generar Otro]                       │
└─────────────────────────────────────────┘
```

---

## ⚡ Notas de Implementación

- **Backend:** `functions/generateUniqueBarcode.js` genera el código y valida unicidad
- **Frontend:** `components/barcode/BarcodeGenerator.jsx` muestra vista previa y PDF
- **Página:** `pages/BarcodeGenerator.jsx` maneja el flujo principal
- **Integración:** `ProductTable.jsx` tiene botón que redirige al generador
- **API Externa:** Usa `api.barcodeserver.com` para renderizar SVG (online)

---

¡Ahora puedes testear y validar el flujo completo! 🚀