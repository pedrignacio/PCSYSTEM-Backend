const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Configurar Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Configurar Multer para manejo de archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB límite
});

// Configurar Nodemailer (opcional)
let emailTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// GET todos los productos (con paginación)
app.get('/api/pcs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const all = req.query.all === 'true'; // Parámetro para obtener todos sin paginación
        
        if (all) {
            // Obtener todos los productos sin paginación (para admin)
            const { data, error } = await supabase
                .from('Productos')
                .select('*')
                .order('POSICION', { ascending: true });
            
            if (error) throw error;
            res.json(data);
        } else {
            // Obtener productos con paginación
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await supabase
                .from('Productos')
                .select('*', { count: 'exact' })
                .order('POSICION', { ascending: true })
                .range(from, to);
            
            if (error) throw error;

            res.json({
                data,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit),
                    hasMore: to < count - 1
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// RUTAS DE BÚSQUEDA Y FILTROS
// (Deben ir ANTES de /api/pcs/:id)
// ============================================

// Buscar productos (con paginación)
app.get('/api/pcs/search', async (req, res) => {
    try {
        const { q, category, minPrice, maxPrice, inStock } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        let query = supabase.from('Productos').select('*', { count: 'exact' });

        // Búsqueda por texto
        if (q) {
            query = query.or(`NOMBRE.ilike.%${q}%,DETALLE.ilike.%${q}%,CATEGORIA.ilike.%${q}%`);
        }

        // Filtro por categoría
        if (category && category !== 'all') {
            query = query.eq('CATEGORIA', category);
        }

        // Filtro por precio
        if (minPrice) {
            query = query.gte('PRECIO', parseFloat(minPrice));
        }
        if (maxPrice) {
            query = query.lte('PRECIO', parseFloat(maxPrice));
        }

        // Filtro por stock
        if (inStock === 'true') {
            query = query.gt('STOCK', 0);
        }

        query = query.order('POSICION', { ascending: true }).range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;
        
        res.json({
            data,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit),
                hasMore: to < count - 1
            }
        });
    } catch (error) {
        console.error('Error buscando productos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener categorías únicas
app.get('/api/pcs/categories', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Productos')
            .select('CATEGORIA')
            .not('CATEGORIA', 'is', null);

        if (error) throw error;

        const uniqueCategories = [...new Set(data.map(p => p.CATEGORIA))];
        res.json(uniqueCategories);
    } catch (error) {
        console.error('Error obteniendo categorías:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener productos con bajo stock
app.get('/api/pcs/low-stock', async (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold) || 5;
        
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .lte('STOCK', threshold)
            .order('STOCK', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error obteniendo productos con bajo stock:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener productos más vendidos
app.get('/api/pcs/top-selling', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .order('NUM_VENTAS', { ascending: false })
            .limit(limit);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error obteniendo productos más vendidos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar posiciones masivamente
app.put('/api/pcs/positions', async (req, res) => {
    try {
        const { positions } = req.body; // Array de { id, POSICION }

        if (!Array.isArray(positions)) {
            return res.status(400).json({ error: 'Se requiere un array de posiciones' });
        }

        // Actualizar cada producto con su nueva posición
        const updates = positions.map(({ id, POSICION }) =>
            supabase
                .from('Productos')
                .update({ POSICION })
                .eq('id', id)
        );

        await Promise.all(updates);

        res.json({ 
            success: true, 
            message: 'Posiciones actualizadas correctamente' 
        });
    } catch (error) {
        console.error('Error actualizando posiciones:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener productos relacionados
app.get('/api/pcs/:id/related', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 4;

        // Primero obtener el producto para conocer su categoría
        const { data: product, error: productError } = await supabase
            .from('Productos')
            .select('CATEGORIA')
            .eq('id', id)
            .single();

        if (productError) throw productError;

        // Obtener productos de la misma categoría
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .eq('CATEGORIA', product.CATEGORIA)
            .neq('id', id)
            .limit(limit);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error obteniendo productos relacionados:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// RUTAS DE PRODUCTOS INDIVIDUALES
// (Debe ir DESPUÉS de las rutas específicas)
// ============================================

// GET por ID
app.get('/api/pcs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('Productos')
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

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña requeridos' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        res.json({
            success: true,
            session: data.session,
            user: data.user
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(401).json({ error: error.message });
    }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        res.json({ success: true, message: 'Sesión cerrada' });
    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({ error: error.message });
    }
});

// Verificar sesión
app.get('/api/auth/session', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data, error } = await supabase.auth.getUser(token);

        if (error) throw error;

        res.json({ user: data.user });
    } catch (error) {
        console.error('Error verificando sesión:', error);
        res.status(401).json({ error: error.message });
    }
});

// ============================================
// RUTAS DE UPLOAD DE ARCHIVOS
// ============================================

// Upload de imágenes
app.post('/api/upload/image', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó archivo' });
        }

        const file = req.file;
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `images/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('Imagenes')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('Imagenes')
            .getPublicUrl(filePath);

        res.json({ 
            success: true, 
            url: data.publicUrl 
        });
    } catch (error) {
        console.error('Error subiendo imagen:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload de videos
app.post('/api/upload/video', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó archivo' });
        }

        const file = req.file;
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `videos/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('Imagenes')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('Imagenes')
            .getPublicUrl(filePath);

        res.json({ 
            success: true, 
            url: data.publicUrl 
        });
    } catch (error) {
        console.error('Error subiendo video:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener productos relacionados
app.get('/api/pcs/:id/related', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 4;

        // Primero obtener el producto para conocer su categoría
        const { data: product, error: productError } = await supabase
            .from('Productos')
            .select('CATEGORIA')
            .eq('id', id)
            .single();

        if (productError) throw productError;

        // Obtener productos de la misma categoría
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .eq('CATEGORIA', product.CATEGORIA)
            .neq('id', id)
            .limit(limit);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error obteniendo productos relacionados:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// RUTAS DE GESTIÓN DE POSICIONES
// ============================================

// Actualizar posiciones masivamente
app.put('/api/pcs/positions', async (req, res) => {
    try {
        const { positions } = req.body; // Array de { id, POSICION }

        if (!Array.isArray(positions)) {
            return res.status(400).json({ error: 'Se requiere un array de posiciones' });
        }

        // Actualizar cada producto con su nueva posición
        const updates = positions.map(({ id, POSICION }) =>
            supabase
                .from('Productos')
                .update({ POSICION })
                .eq('id', id)
        );

        await Promise.all(updates);

        res.json({ 
            success: true, 
            message: 'Posiciones actualizadas correctamente' 
        });
    } catch (error) {
        console.error('Error actualizando posiciones:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// RUTAS DE CONTACTO
// ============================================

// Enviar mensaje de contacto
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, service, message } = req.body;

        // Validación básica
        if (!name || !email || !message) {
            return res.status(400).json({ 
                error: 'Faltan campos requeridos: nombre, email y mensaje son obligatorios' 
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        // Registrar en consola
        console.log('📧 Nuevo mensaje de contacto:', {
            name,
            email,
            phone,
            service,
            message,
            timestamp: new Date().toISOString(),
        });

        // Intentar enviar email si está configurado
        if (emailTransporter) {
            try {
                await emailTransporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: process.env.CONTACT_EMAIL || 'contacto@pcsystems.cl',
                    replyTo: email,
                    subject: `Nuevo mensaje de contacto - ${name}`,
                    html: `
                        <h2>Nuevo mensaje de contacto desde PCSystem</h2>
                        <p><strong>Nombre:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Teléfono:</strong> ${phone || 'No proporcionado'}</p>
                        <p><strong>Servicio de Interés:</strong> ${service || 'No especificado'}</p>
                        <p><strong>Mensaje:</strong></p>
                        <p>${message.replace(/\n/g, '<br>')}</p>
                    `,
                });
            } catch (emailError) {
                console.error('Error enviando email:', emailError);
                // No fallar la request si el email falla
            }
        }

        // Generar URL de WhatsApp como fallback
        const whatsappMessage = `Nuevo contacto web:\n\nNombre: ${name}\nEmail: ${email}\nTeléfono: ${phone || 'N/A'}\nServicio: ${service || 'N/A'}\nMensaje: ${message}`;
        const whatsappUrl = `https://wa.me/56989142836?text=${encodeURIComponent(whatsappMessage)}`;

        res.json({
            success: true,
            message: 'Mensaje recibido correctamente',
            whatsappUrl,
        });

    } catch (error) {
        console.error('Error en API de contacto:', error);
        res.status(500).json({
            error: 'Error al procesar el mensaje',
            details: error.message,
        });
    }
});

// ============================================
// RUTAS DE ESTADÍSTICAS
// ============================================

// Obtener productos con bajo stock
app.get('/api/pcs/low-stock', async (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold) || 5;
        
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .lte('STOCK', threshold)
            .order('STOCK', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error obteniendo productos con bajo stock:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener productos más vendidos
app.get('/api/pcs/top-selling', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .order('NUM_VENTAS', { ascending: false })
            .limit(limit);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error obteniendo productos más vendidos:', error);
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
    console.log(`📧 Email: ${emailTransporter ? 'Configurado' : 'No configurado'}`);
});