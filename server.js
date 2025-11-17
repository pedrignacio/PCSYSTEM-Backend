const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas básicas
app.get('/', (req, res) => {
    res.json({ 
        message: 'PCSYSTEM Backend API funcionando!',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        supabase: 'Conectado'
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'PCSYSTEM Backend',
        uptime: process.uptime(),
        database: 'Supabase conectado'
    });
});

// GET todos los productos
app.get('/api/pcs', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Productos') // ✅ Cambiar aquí
            .select('*');
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Crear producto
app.post('/api/pcs', async (req, res) => {
    try {
        const { NOMBRE, DETALLE, PRECIO, CATEGORIA, SUBCATEGORIA, STOCK } = req.body;
        
        if (!NOMBRE) {
            return res.status(400).json({ error: 'NOMBRE es requerido' });
        }

        const { data, error } = await supabase
            .from('Productos') // Cambiar aquí
            .insert([{
                NOMBRE,
                DETALLE,
                PRECIO,
                CATEGORIA,
                SUBCATEGORIA,
                STOCK: STOCK || 0
            }])
            .select();

        if (error) throw error;

        res.status(201).json({
            message: 'Producto creado exitosamente',
            data: data[0]
        });
    } catch (error) {
        console.error('Error creando producto:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT - Actualizar
app.put('/api/pcs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const { data, error } = await supabase
            .from('Productos') // ✅ Cambiar aquí
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ message: 'Producto actualizado', data: data[0] });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE
app.delete('/api/pcs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('Productos') // ✅ Cambiar aquí
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET por ID
app.get('/api/pcs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('Productos') // ✅ Cambiar aquí
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo salió mal!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
    console.log(`🚀 PCSYSTEM Backend corriendo en puerto ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🗄️ Supabase: Conectado`);
});