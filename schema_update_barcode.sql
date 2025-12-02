-- Agregar columna de código de barras a la tabla Productos
ALTER TABLE "Productos" ADD COLUMN IF NOT EXISTS "CODIGO_BARRAS" TEXT UNIQUE;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras ON "Productos"("CODIGO_BARRAS");
