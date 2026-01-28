# 📋 Guía de Instalación: Sistema de Órdenes

## 🎯 Objetivo
Instalar el schema SQL para el sistema de órdenes y webhooks de Mercado Pago.

---

## 📝 Paso 1: Ejecutar Schema SQL en Supabase

1. **Abrir Supabase Dashboard**
   - Ir a: https://supabase.com/dashboard
   - Seleccionar tu proyecto PCSYSTEM

2. **Abrir SQL Editor**
   - En el menú lateral: `SQL Editor`
   - Click en `New query`

3. **Copiar y Ejecutar el Schema**
   - Abrir el archivo: `schema_ordenes.sql`
   - Copiar TODO el contenido
   - Pegarlo en el editor de Supabase
   - Click en `Run` (o `Ctrl+Enter`)

4. **Verificar que se crearon las tablas**
   ```sql
   -- Ejecutar esta query para verificar
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('ordenes', 'detalle_ordenes', 'historial_ordenes');
   ```
   
   Deberías ver 3 tablas:
   - ✅ `ordenes`
   - ✅ `detalle_ordenes`
   - ✅ `historial_ordenes`

---

## 🔐 Paso 2: Configurar Variables de Entorno

### **Backend (Render)**

1. Ir a: https://dashboard.render.com
2. Seleccionar `pcsystem-backend-6tb4`
3. Ir a `Environment`
4. Agregar nueva variable:

```
MP_WEBHOOK_URL=https://pcsystem-backend-6tb4.onrender.com/api/webhooks/mercadopago
```

5. Click `Save Changes` (esto hará un redeploy automático)

---

## 🔔 Paso 3: Configurar Webhook en Mercado Pago

1. **Ir al Panel de Mercado Pago**
   - URL: https://www.mercadopago.cl/developers/panel/app
   - Login con la cuenta del tío (o la tuya temporalmente)

2. **Seleccionar tu App**
   - Click en la aplicación (o crear una nueva si no existe)

3. **Ir a Webhooks**
   - En el menú lateral: `Webhooks` o `Notificaciones`
   - Click en `Configurar notificaciones`

4. **Configurar URL de Notificación**
   - **URL de producción**: 
     ```
     https://pcsystem-backend-6tb4.onrender.com/api/webhooks/mercadopago
     ```
   
   - **Eventos a notificar**: Seleccionar `Pagos` (Payments)
   
   - **Versión**: v1 (la más reciente)

5. **Guardar y Probar**
   - Click `Guardar`
   - Mercado Pago enviará una notificación de prueba
   - Verificar en los logs de Render que llegó correctamente

---

## 🧪 Paso 4: Probar el Sistema Completo

### **Test 1: Crear Orden desde Frontend**

No hay cambios en el flujo del usuario, todo funcionará automáticamente:

1. Agregar productos al carrito en el frontend
2. Ir a `/checkout`
3. Llenar formulario de datos
4. Click en "Pagar con Mercado Pago"

**Nuevo comportamiento**:
- ✅ Se creará la orden en BD **antes** de redirigir a Mercado Pago
- ✅ La orden incluirá `external_reference` único
- ✅ Estado inicial: `pendiente`, payment_status: `pending`

### **Test 2: Webhook Automático**

Cuando completes el pago en Mercado Pago:

1. Mercado Pago enviará webhook a tu backend
2. El webhook actualizará automáticamente:
   - `payment_id`
   - `payment_status` → `approved`
   - `estado` → `pagado`
3. Se actualizará el stock de productos
4. Se registrará el cambio en `historial_ordenes`

### **Test 3: Verificar en Supabase**

1. Ir a Supabase Dashboard → `Table Editor`
2. Seleccionar tabla `ordenes`
3. Verificar que aparece tu orden con:
   - ✅ `cliente_nombre`, `cliente_email`
   - ✅ `total`
   - ✅ `payment_status: approved`
   - ✅ `estado: pagado`
   - ✅ `payment_id` (número largo de Mercado Pago)

4. Seleccionar tabla `detalle_ordenes`
5. Verificar que están los items de la orden

6. Seleccionar tabla `historial_ordenes`
7. Verificar el cambio de estado: `pendiente` → `pagado`

---

## 🐛 Troubleshooting

### ❌ "No se encontró orden para payment_id"

**Causa**: El webhook llegó antes que el frontend creara la orden.

**Solución**: Mercado Pago reintentará automáticamente. Si persiste:
1. Verificar que el frontend está llamando a `/api/ordenes` ANTES de crear la preferencia
2. Verificar logs en Render

### ❌ "Error actualizando orden"

**Causa**: Problema con Supabase o credenciales.

**Solución**:
1. Verificar que `SUPABASE_URL` y `SUPABASE_ANON_KEY` están configurados en Render
2. Verificar que las tablas existen en Supabase
3. Revisar logs en Render para más detalles

### ❌ "Webhook no llega"

**Causa**: URL incorrecta o Mercado Pago no puede alcanzar el servidor.

**Solución**:
1. Verificar que la URL del webhook en Mercado Pago es EXACTAMENTE:
   ```
   https://pcsystem-backend-6tb4.onrender.com/api/webhooks/mercadopago
   ```
2. Probar manualmente con cURL:
   ```bash
   curl -X POST https://pcsystem-backend-6tb4.onrender.com/api/webhooks/mercadopago \
     -H "Content-Type: application/json" \
     -d '{"action":"payment.updated","type":"payment","data":{"id":"123456"}}'
   ```
3. Verificar logs en Render (debería aparecer "🔔 Webhook recibido de Mercado Pago")

---

## 📊 Verificar Logs en Render

1. Ir a: https://dashboard.render.com
2. Seleccionar `pcsystem-backend-6tb4`
3. Click en `Logs`
4. Buscar mensajes:
   - ✅ "📋 Orden creada: [UUID]"
   - ✅ "🔔 Webhook recibido de Mercado Pago"
   - ✅ "💳 Procesando pago: [PAYMENT_ID]"
   - ✅ "✅ Orden [UUID] actualizada exitosamente"
   - ✅ "📦 Stock actualizado para producto [ID]"

---

## ✅ Checklist de Instalación

- [ ] Schema SQL ejecutado en Supabase
- [ ] 3 tablas creadas: `ordenes`, `detalle_ordenes`, `historial_ordenes`
- [ ] Variable `MP_WEBHOOK_URL` configurada en Render
- [ ] Webhook configurado en panel de Mercado Pago
- [ ] Test de compra completado exitosamente
- [ ] Orden visible en Supabase con estado `pagado`
- [ ] Stock actualizado correctamente

---

**¡Listo! El sistema de órdenes está funcionando al 100%** 🎉

Próximo paso: Emails de confirmación automáticos.
