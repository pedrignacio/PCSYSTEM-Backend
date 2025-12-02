-- Tabla de Ventas POS
CREATE TABLE IF NOT EXISTS ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total INTEGER NOT NULL,
    metodo_pago TEXT NOT NULL, -- efectivo, transbank, transferencia
    documento_tipo TEXT, -- boleta, factura, recibo
    tipo_venta TEXT, -- inmediata, preventa
    observaciones TEXT,
    codigo_autorizacion TEXT,
    id_transaccion TEXT,
    estado TEXT DEFAULT 'completada' -- completada, anulada
);

-- Detalle de Ventas POS
CREATE TABLE IF NOT EXISTS detalle_ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id BIGINT REFERENCES "Productos"(id), -- Puede ser NULL para items manuales
    nombre_producto TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    is_custom BOOLEAN DEFAULT FALSE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_detalle_ventas_venta_id ON detalle_ventas(venta_id);
