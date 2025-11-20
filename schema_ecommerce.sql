-- SQL Script: MODELO DE DATOS ECOMMERCE (PostgreSQL + Supabase)
-- Respeta la tabla "Productos" existente (usa BIGINT para product IDs)
-- Ejecutar en Supabase SQL editor o con psql: psql $DATABASE_URL -f schema_ecommerce.sql

-- Habilitar extensión para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefono TEXT,
    direccion TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CARRITOS
CREATE TABLE IF NOT EXISTS carritos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    estado TEXT DEFAULT 'pendiente', -- pendiente, pagado, cancelado
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. DETALLE_CARRITO
-- Referencia a "Productos" que usa BIGINT
CREATE TABLE IF NOT EXISTS detalle_carrito (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    carrito_id UUID NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,
    producto_id BIGINT NOT NULL REFERENCES "Productos"(id) ON DELETE CASCADE,

    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario INTEGER NOT NULL,

    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas frecuentes por carrito
CREATE INDEX IF NOT EXISTS idx_detalle_carrito_carrito_id ON detalle_carrito(carrito_id);
CREATE INDEX IF NOT EXISTS idx_detalle_carrito_producto_id ON detalle_carrito(producto_id);

-- 4. DESCUENTOS_PRODUCTOS
-- Asociado directo a productos
CREATE TABLE IF NOT EXISTS descuentos_productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    producto_id BIGINT NOT NULL REFERENCES "Productos"(id) ON DELETE CASCADE,
    porcentaje INTEGER NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),

    codigo TEXT UNIQUE NOT NULL, -- Código de descuento único
    valido_desde TIMESTAMP WITH TIME ZONE,
    valido_hasta TIMESTAMP WITH TIME ZONE,
    usado BOOLEAN DEFAULT FALSE,

    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_descuentos_producto_producto_id ON descuentos_productos(producto_id);

-- 5. PACKS
CREATE TABLE IF NOT EXISTS packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio INTEGER NOT NULL CHECK (precio >= 0),

    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. PACK_PRODUCTOS
-- Relación N a N entre packs y productos
CREATE TABLE IF NOT EXISTS pack_productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    producto_id BIGINT NOT NULL REFERENCES "Productos"(id) ON DELETE CASCADE,

    cantidad INTEGER DEFAULT 1 CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS idx_pack_productos_pack_id ON pack_productos(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_productos_producto_id ON pack_productos(producto_id);

-- 7. PAGOS
CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    carrito_id UUID NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,
    monto_total INTEGER NOT NULL,

    metodo TEXT NOT NULL,   -- webpay, transferencia, etc.
    estado TEXT DEFAULT 'pendiente', -- pendiente, aprobado, rechazado

    transaccion_id TEXT, -- ID del proveedor de pago
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_carrito_id ON pagos(carrito_id);

-- 8. ENVIOS
CREATE TABLE IF NOT EXISTS envios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    carrito_id UUID NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,

    direccion TEXT NOT NULL,
    estado TEXT DEFAULT 'preparando', -- preparando, enviado, entregado
    courier TEXT,

    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_envios_carrito_id ON envios(carrito_id);

-- Opcional: Tabla de clientes invitados / sesiones (si se necesita)
CREATE TABLE IF NOT EXISTS invitados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notas:
-- 1) Este script respeta la tabla existente "Productos" con id tipo BIGINT.
--    Antes de ejecutar, asegúrate que la tabla "Productos" existe y que la columna id es de tipo BIGINT.
-- 2) `gen_random_uuid()` requiere la extensión pgcrypto. Si no la tienes, ejecuta:
--      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- 3) Ejecuta este script en el SQL editor de Supabase o con psql:
--      psql $DATABASE_URL -f schema_ecommerce.sql
-- 4) ON DELETE CASCADE se usa donde eliminaciones deben propagar (detalle_carrito, pack_productos, pagos, envios, etc.)
-- 5) Prepara migraciones cuidadosas si ya tienes datos en las tablas existentes.

-- End of script
