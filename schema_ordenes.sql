-- ============================================
-- SCHEMA: SISTEMA DE ÓRDENES PARA E-COMMERCE
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- Este schema maneja órdenes de Mercado Pago

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLA: ordenes
-- Almacena cada orden de compra online
-- ============================================
CREATE TABLE IF NOT EXISTS ordenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Datos del cliente
    cliente_nombre TEXT NOT NULL,
    cliente_email TEXT NOT NULL,
    cliente_telefono TEXT,
    
    -- Datos de entrega
    direccion TEXT,
    ciudad TEXT,
    metodo_entrega TEXT, -- 'domicilio' o 'tienda'
    lat NUMERIC(10, 8),
    lng NUMERIC(11, 8),
    
    -- Datos de pago
    metodo_pago TEXT NOT NULL DEFAULT 'mercadopago',
    total INTEGER NOT NULL CHECK (total >= 0),
    
    -- Mercado Pago
    preference_id TEXT, -- ID de la preferencia creada
    payment_id TEXT, -- ID del pago de Mercado Pago
    payment_status TEXT DEFAULT 'pending', -- pending, approved, rejected, cancelled
    external_reference TEXT, -- Referencia externa (ID de orden)
    
    -- Estado de la orden
    estado TEXT DEFAULT 'pendiente', -- pendiente, pagado, preparando, enviado, entregado, cancelado
    
    -- Observaciones
    observaciones TEXT,
    
    -- Timestamps
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_ordenes_cliente_email ON ordenes(cliente_email);
CREATE INDEX IF NOT EXISTS idx_ordenes_payment_id ON ordenes(payment_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_preference_id ON ordenes(preference_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_payment_status ON ordenes(payment_status);
CREATE INDEX IF NOT EXISTS idx_ordenes_creado_en ON ordenes(creado_en DESC);

-- ============================================
-- TABLA: detalle_ordenes
-- Items de cada orden
-- ============================================
CREATE TABLE IF NOT EXISTS detalle_ordenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    orden_id UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    producto_id BIGINT REFERENCES "Productos"(id) ON DELETE SET NULL,
    
    -- Guardamos snapshot del producto al momento de la venta
    nombre_producto TEXT NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario INTEGER NOT NULL CHECK (precio_unitario >= 0),
    subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
    
    -- Info adicional (opcional)
    imagen_url TEXT,
    
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detalle_ordenes_orden_id ON detalle_ordenes(orden_id);
CREATE INDEX IF NOT EXISTS idx_detalle_ordenes_producto_id ON detalle_ordenes(producto_id);

-- ============================================
-- TABLA: historial_ordenes
-- Log de cambios de estado de órdenes
-- ============================================
CREATE TABLE IF NOT EXISTS historial_ordenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    orden_id UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    estado_anterior TEXT,
    estado_nuevo TEXT NOT NULL,
    notas TEXT,
    
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_ordenes_orden_id ON historial_ordenes(orden_id);

-- ============================================
-- TRIGGER: Actualizar timestamp de actualizado_en
-- ============================================
CREATE OR REPLACE FUNCTION actualizar_timestamp_orden()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_timestamp_orden
BEFORE UPDATE ON ordenes
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_orden();

-- ============================================
-- TRIGGER: Registrar cambios de estado
-- ============================================
CREATE OR REPLACE FUNCTION registrar_cambio_estado_orden()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO historial_ordenes (orden_id, estado_anterior, estado_nuevo)
        VALUES (NEW.id, OLD.estado, NEW.estado);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_registrar_cambio_estado
AFTER UPDATE ON ordenes
FOR EACH ROW
EXECUTE FUNCTION registrar_cambio_estado_orden();

-- ============================================
-- NOTAS DE USO
-- ============================================
-- 1. Ejecutar este script en Supabase SQL Editor
-- 2. El webhook de Mercado Pago actualizará payment_status y estado
-- 3. Los triggers mantienen actualizado_en y historial automáticamente
-- 4. payment_status refleja el estado en Mercado Pago
-- 5. estado refleja el estado de fulfillment (preparando, enviado, etc.)

COMMENT ON TABLE ordenes IS 'Órdenes de compra del e-commerce';
COMMENT ON TABLE detalle_ordenes IS 'Items de cada orden (snapshot al momento de la venta)';
COMMENT ON TABLE historial_ordenes IS 'Log de cambios de estado de órdenes';
