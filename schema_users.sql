-- Tabla de Usuarios del Sistema (Extiende Supabase Auth o funciona independiente)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Link opcional a Supabase Auth
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'vendedor')),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar un usuario admin por defecto (opcional, para pruebas)
-- INSERT INTO usuarios (nombre, email, rol) VALUES ('Admin', 'admin@pcsystem.cl', 'admin') ON CONFLICT DO NOTHING;
