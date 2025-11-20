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
            .from('Productos')
            .select('*')
            .order('id', { ascending: false });
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET producto por ID
app.get('/api/pcs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        if (!data) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET productos por categoría
app.get('/api/productos/categoria/:categoria', async (req, res) => {
    try {
        const { categoria } = req.params;
        
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .eq('CATEGORIA', categoria)
            .order('POSICION', { ascending: true });
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET productos destacados
app.get('/api/productos/destacados', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .eq('destacado', true)
            .order('NUM_VENTAS', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET búsqueda de productos
app.get('/api/productos/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .or(`NOMBRE.ilike.%${q}%,DETALLE.ilike.%${q}%,CATEGORIA.ilike.%${q}%`);
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET todas las categorías únicas
app.get('/api/categorias', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Productos')
            .select('CATEGORIA')
            .order('CATEGORIA');
        
        if (error) throw error;
        
        // Obtener categorías únicas y filtrar nulls
        const categorias = [...new Set(data.map(p => p.CATEGORIA).filter(Boolean))];
        res.json(categorias);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET estadísticas (para dashboard admin)
app.get('/api/stats', async (req, res) => {
    try {
        const { data: productos, error: errorProductos } = await supabase
            .from('Productos')
            .select('*');
        
        if (errorProductos) throw errorProductos;

        const stats = {
            totalProductos: productos.length,
            totalStock: productos.reduce((sum, p) => sum + (parseInt(p.STOCK) || 0), 0),
            productosSinStock: productos.filter(p => parseInt(p.STOCK) === 0).length,
            totalVentas: productos.reduce((sum, p) => sum + (parseInt(p.NUM_VENTAS) || 0), 0),
            categorias: [...new Set(productos.map(p => p.CATEGORIA).filter(Boolean))].length,
            productosDestacados: productos.filter(p => p.destacado).length,
            valorInventario: productos.reduce((sum, p) => sum + (parseInt(p.PRECIO) * parseInt(p.STOCK) || 0), 0)
        };

        res.json(stats);
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
            .from('Productos')
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

// PUT - Actualizar producto
app.put('/api/pcs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const { data, error } = await supabase
            .from('Productos')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({
            message: 'Producto actualizado exitosamente',
            data: data[0]
        });
    } catch (error) {
        console.error('Error actualizando producto:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Eliminar producto
app.delete('/api/pcs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('Productos')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error('Error eliminando producto:', error);
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

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🗄️ Supabase: Conectado`);
});