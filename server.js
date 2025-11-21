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
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3002', // Frontend web
        'http://localhost:5173'  // POS Electron
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
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

// ============================================
// RUTAS DE CARRITO / E-COMMERCE
// ============================================

// Crear carrito (opcionalmente vinculado a cliente)
app.post('/api/carritos', async (req, res) => {
    try {
        const { cliente_id } = req.body;

        const { data, error } = await supabase
            .from('carritos')
            .insert([{ cliente_id }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        console.error('Error creando carrito:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener (o crear) carrito pendiente de un cliente
app.get('/api/clientes/:clienteId/carrito', async (req, res) => {
    try {
        const { clienteId } = req.params;

        // Buscar carrito pendiente
        const { data: existing, error: existingError } = await supabase
            .from('carritos')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('estado', 'pendiente')
            .limit(1)
            .maybeSingle();

        if (existingError) throw existingError;

        if (existing) {
            return res.json(existing);
        }

        // Crear nuevo carrito
        const { data, error } = await supabase
            .from('carritos')
            .insert([{ cliente_id: clienteId }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        console.error('Error obteniendo/creando carrito del cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener carrito con items y datos de producto
app.get('/api/carritos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: cart, error: cartError } = await supabase
            .from('carritos')
            .select('*')
            .eq('id', id)
            .single();

        if (cartError) throw cartError;

        const { data: items, error: itemsError } = await supabase
            .from('detalle_carrito')
            .select('*')
            .eq('carrito_id', id);

        if (itemsError) throw itemsError;

        // Enriquecer items con datos de Productos
        const productoIds = items.map(i => i.producto_id);
        let productsMap = {};
        if (productoIds.length > 0) {
            const { data: products } = await supabase
                .from('Productos')
                .select('*')
                .in('id', productoIds);

            productsMap = (products || []).reduce((acc, p) => {
                acc[p.id] = p; return acc;
            }, {});
        }

        const enriched = items.map(i => ({
            ...i,
            producto: productsMap[i.producto_id] || null
        }));

        res.json({ cart, items: enriched });
    } catch (error) {
        console.error('Error obteniendo carrito:', error);
        res.status(500).json({ error: error.message });
    }
});

// Añadir o actualizar item en carrito
app.post('/api/carritos/:id/items', async (req, res) => {
    try {
        const { id } = req.params; // carrito id
        const { producto_id, cantidad } = req.body;

        if (!producto_id || !cantidad) {
            return res.status(400).json({ error: 'producto_id y cantidad son requeridos' });
        }

        // Obtener precio actual del producto
        const { data: product, error: productError } = await supabase
            .from('Productos')
            .select('PRECIO')
            .eq('id', producto_id)
            .single();

        if (productError) throw productError;

        const precio_unitario = typeof product.PRECIO === 'string' ? parseInt(product.PRECIO.replace(/[^\d]/g, '')) : product.PRECIO;

        // Verificar si item ya existe
        const { data: existing, error: existingError } = await supabase
            .from('detalle_carrito')
            .select('*')
            .eq('carrito_id', id)
            .eq('producto_id', producto_id)
            .limit(1)
            .maybeSingle();

        if (existingError) throw existingError;

        if (existing) {
            // Actualizar cantidad
            const newCantidad = existing.cantidad + cantidad;
            const { data, error } = await supabase
                .from('detalle_carrito')
                .update({ cantidad: newCantidad })
                .eq('id', existing.id)
                .select();

            if (error) throw error;
            return res.json(data[0]);
        }

        // Insertar nuevo item
        const { data, error } = await supabase
            .from('detalle_carrito')
            .insert([{
                carrito_id: id,
                producto_id,
                cantidad,
                precio_unitario
            }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        console.error('Error añadiendo item al carrito:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar cantidad de item
app.put('/api/carritos/:id/items/:itemId', async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const { cantidad } = req.body;

        if (cantidad === undefined) return res.status(400).json({ error: 'cantidad requerida' });

        const { data, error } = await supabase
            .from('detalle_carrito')
            .update({ cantidad })
            .eq('id', itemId)
            .eq('carrito_id', id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        console.error('Error actualizando item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar item del carrito
app.delete('/api/carritos/:id/items/:itemId', async (req, res) => {
    try {
        const { id, itemId } = req.params;

        const { error } = await supabase
            .from('detalle_carrito')
            .delete()
            .eq('id', itemId)
            .eq('carrito_id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Aplicar código de descuento al carrito (no marca como usado automáticamente)
app.post('/api/carritos/:id/apply-discount', async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo } = req.body;

        if (!codigo) return res.status(400).json({ error: 'codigo requerido' });

        const { data: descuento, error: descError } = await supabase
            .from('descuentos_productos')
            .select('*')
            .eq('codigo', codigo)
            .maybeSingle();

        if (descError) throw descError;
        if (!descuento) return res.status(404).json({ error: 'Código no encontrado' });

        // Verificar validez temporal
        const ahora = new Date();
        if (descuento.valido_desde && new Date(descuento.valido_desde) > ahora) return res.status(400).json({ error: 'Código no válido aún' });
        if (descuento.valido_hasta && new Date(descuento.valido_hasta) < ahora) return res.status(400).json({ error: 'Código expirado' });

        // Calcular total del carrito
        const { data: items } = await supabase
            .from('detalle_carrito')
            .select('*')
            .eq('carrito_id', id);

        const subtotal = (items || []).reduce((sum, it) => sum + (it.precio_unitario * it.cantidad), 0);
        const descuentoMonto = Math.round(subtotal * (descuento.porcentaje / 100));
        const total = subtotal - descuentoMonto;

        res.json({ subtotal, descuento: descuentoMonto, total, descuento_id: descuento.id });
    } catch (error) {
        console.error('Error aplicando descuento:', error);
        res.status(500).json({ error: error.message });
    }
});

// Checkout (crea pago y envio; no integra con pasarela real aquí)
app.post('/api/carritos/:id/checkout', async (req, res) => {
    try {
        const { id } = req.params;
        const { metodo, envio } = req.body; // envio: { direccion, courier }

        // Obtener items
        const { data: items, error: itemsError } = await supabase
            .from('detalle_carrito')
            .select('*')
            .eq('carrito_id', id);

        if (itemsError) throw itemsError;

        const monto_total = (items || []).reduce((sum, it) => sum + (it.precio_unitario * it.cantidad), 0);

        // Crear pago
        const { data: pago, error: pagoError } = await supabase
            .from('pagos')
            .insert([{ carrito_id: id, monto_total, metodo, estado: 'pendiente' }])
            .select();

        if (pagoError) throw pagoError;

        // Crear envio si se proporcionó
        let envioData = null;
        if (envio && envio.direccion) {
            const { data: env, error: envError } = await supabase
                .from('envios')
                .insert([{ carrito_id: id, direccion: envio.direccion, courier: envio.courier || null }])
                .select();

            if (envError) throw envError;
            envioData = env[0];
        }

        // Actualizar estado del carrito a 'pagado' (puedes cambiar a 'procesando' hasta confirmación real)
        await supabase.from('carritos').update({ estado: 'pagado' }).eq('id', id);

        res.json({ pago: pago[0], envio: envioData });
    } catch (error) {
        console.error('Error en checkout:', error);
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

// ============================================
// Descuentos por Producto Routes
// ============================================

// Obtener todos los descuentos de productos
app.get('/api/descuentos-productos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('descuentos_productos')
            .select(`
                *,
                producto:producto_id (
                    id,
                    NOMBRE,
                    PRECIO,
                    IMAGENES
                )
            `);

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error obteniendo descuentos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Crear descuento de producto
app.post('/api/descuentos-productos', async (req, res) => {
    try {
        const { producto_id, porcentaje, fecha_inicio, fecha_fin } = req.body;

        if (!producto_id || !porcentaje) {
            return res.status(400).json({ error: 'Faltan datos requeridos (producto_id, porcentaje)' });
        }

        // Verificar si ya existe un descuento para este producto
        const { data: existing } = await supabase
            .from('descuentos_productos')
            .select('*')
            .eq('producto_id', producto_id)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ 
                error: 'Ya existe un descuento para este producto. Edita el existente.' 
            });
        }

        const insertData = {
            producto_id,
            porcentaje
        };

        if (fecha_inicio) insertData.fecha_inicio = fecha_inicio;
        if (fecha_fin) insertData.fecha_fin = fecha_fin;

        const { data, error } = await supabase
            .from('descuentos_productos')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error creando descuento:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar descuento de producto
app.put('/api/descuentos-productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { porcentaje, fecha_inicio, fecha_fin } = req.body;

        if (!porcentaje) {
            return res.status(400).json({ error: 'El porcentaje es requerido' });
        }

        const updateData = { porcentaje };
        if (fecha_inicio !== undefined) updateData.fecha_inicio = fecha_inicio || null;
        if (fecha_fin !== undefined) updateData.fecha_fin = fecha_fin || null;

        const { data, error } = await supabase
            .from('descuentos_productos')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error actualizando descuento:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar descuento de producto
app.delete('/api/descuentos-productos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('descuentos_productos')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando descuento:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Packs Routes
// ============================================

// Obtener todos los packs
app.get('/api/packs', async (req, res) => {
    try {
        const { data: packs, error: packsError } = await supabase
            .from('packs')
            .select('*');

        if (packsError) throw packsError;

        // Para cada pack, obtener sus productos
        const packsWithProducts = await Promise.all(
            packs.map(async (pack) => {
                const { data: items, error: itemsError } = await supabase
                    .from('pack_productos')
                    .select(`
                        *,
                        producto:producto_id (
                            id,
                            NOMBRE,
                            PRECIO,
                            IMAGENES
                        )
                    `)
                    .eq('pack_id', pack.id);

                if (itemsError) throw itemsError;

                return {
                    ...pack,
                    productos: items || []
                };
            })
        );

        res.json(packsWithProducts);
    } catch (error) {
        console.error('Error obteniendo packs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Crear pack
app.post('/api/packs', async (req, res) => {
    try {
        const { nombre, descripcion, precio, productos } = req.body;

        if (!nombre || !precio || !productos || productos.length === 0) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        // Crear el pack
        const { data: pack, error: packError } = await supabase
            .from('packs')
            .insert({
                nombre,
                descripcion,
                precio
            })
            .select()
            .single();

        if (packError) throw packError;

        // Insertar productos del pack
        const packProductos = productos.map(p => ({
            pack_id: pack.id,
            producto_id: p.producto_id,
            cantidad: p.cantidad
        }));

        const { error: itemsError } = await supabase
            .from('pack_productos')
            .insert(packProductos);

        if (itemsError) throw itemsError;

        res.json(pack);
    } catch (error) {
        console.error('Error creando pack:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar pack
app.put('/api/packs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio, productos } = req.body;

        // Actualizar pack
        const updateData = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (precio !== undefined) updateData.precio = precio;

        const { data: pack, error: packError } = await supabase
            .from('packs')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (packError) throw packError;

        // Si hay productos, actualizar
        if (productos) {
            // Eliminar productos existentes
            await supabase
                .from('pack_productos')
                .delete()
                .eq('pack_id', id);

            // Insertar nuevos productos
            const packProductos = productos.map(p => ({
                pack_id: id,
                producto_id: p.producto_id,
                cantidad: p.cantidad
            }));

            const { error: itemsError } = await supabase
                .from('pack_productos')
                .insert(packProductos);

            if (itemsError) throw itemsError;
        }

        res.json(pack);
    } catch (error) {
        console.error('Error actualizando pack:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar pack
app.delete('/api/packs/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Primero eliminar productos del pack
        await supabase
            .from('pack_productos')
            .delete()
            .eq('pack_id', id);

        // Luego eliminar el pack
        const { error } = await supabase
            .from('packs')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando pack:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Cupones Routes
// ============================================

// Obtener todos los cupones
app.get('/api/cupones', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('cupones')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error obteniendo cupones:', error);
        res.status(500).json({ error: error.message });
    }
});

// Crear cupón
app.post('/api/cupones', async (req, res) => {
    try {
        const { 
            codigo, 
            tipo_descuento, 
            valor_descuento, 
            uso_unico,
            usos_maximos,
            fecha_inicio,
            fecha_fin,
            activo
        } = req.body;

        if (!codigo || !tipo_descuento || !valor_descuento) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        // Verificar si el código ya existe
        const { data: existing } = await supabase
            .from('cupones')
            .select('*')
            .eq('codigo', codigo.toUpperCase())
            .single();

        if (existing) {
            return res.status(400).json({ 
                error: 'Ya existe un cupón con este código' 
            });
        }

        const { data, error } = await supabase
            .from('cupones')
            .insert({
                codigo: codigo.toUpperCase(),
                tipo_descuento,
                valor_descuento,
                uso_unico: uso_unico || false,
                usos_maximos: usos_maximos || null,
                usos_actuales: 0,
                fecha_inicio: fecha_inicio || null,
                fecha_fin: fecha_fin || null,
                activo: activo !== undefined ? activo : true
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error creando cupón:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar cupón
app.put('/api/cupones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            codigo,
            tipo_descuento, 
            valor_descuento, 
            uso_unico,
            usos_maximos,
            fecha_inicio,
            fecha_fin,
            activo
        } = req.body;

        const updateData = {};
        if (codigo !== undefined) updateData.codigo = codigo.toUpperCase();
        if (tipo_descuento !== undefined) updateData.tipo_descuento = tipo_descuento;
        if (valor_descuento !== undefined) updateData.valor_descuento = valor_descuento;
        if (uso_unico !== undefined) updateData.uso_unico = uso_unico;
        if (usos_maximos !== undefined) updateData.usos_maximos = usos_maximos;
        if (fecha_inicio !== undefined) updateData.fecha_inicio = fecha_inicio;
        if (fecha_fin !== undefined) updateData.fecha_fin = fecha_fin;
        if (activo !== undefined) updateData.activo = activo;

        const { data, error } = await supabase
            .from('cupones')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error actualizando cupón:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar cupón
app.delete('/api/cupones/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('cupones')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando cupón:', error);
        res.status(500).json({ error: error.message });
    }
});

// Validar cupón
app.post('/api/cupones/validar', async (req, res) => {
    try {
        const { codigo } = req.body;

        if (!codigo) {
            return res.status(400).json({ error: 'Código requerido' });
        }

        const { data: cupon, error } = await supabase
            .from('cupones')
            .select('*')
            .eq('codigo', codigo.toUpperCase())
            .single();

        if (error || !cupon) {
            return res.status(404).json({ error: 'Cupón no encontrado' });
        }

        // Validaciones
        if (!cupon.activo) {
            return res.status(400).json({ error: 'Cupón inactivo' });
        }

        const now = new Date();
        if (cupon.fecha_inicio && new Date(cupon.fecha_inicio) > now) {
            return res.status(400).json({ error: 'Cupón aún no válido' });
        }

        if (cupon.fecha_fin && new Date(cupon.fecha_fin) < now) {
            return res.status(400).json({ error: 'Cupón expirado' });
        }

        if (cupon.uso_unico && cupon.usos_actuales > 0) {
            return res.status(400).json({ error: 'Cupón ya utilizado' });
        }

        if (cupon.usos_maximos && cupon.usos_actuales >= cupon.usos_maximos) {
            return res.status(400).json({ error: 'Cupón sin usos disponibles' });
        }

        res.json({ 
            valid: true, 
            cupon: {
                tipo_descuento: cupon.tipo_descuento,
                valor_descuento: cupon.valor_descuento
            }
        });
    } catch (error) {
        console.error('Error validando cupón:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Estadísticas Routes
// ============================================

// Obtener estadísticas de cupones
app.get('/api/estadisticas/cupones', async (req, res) => {
    try {
        const { data: cupones, error } = await supabase
            .from('cupones')
            .select('*')
            .order('usos_actuales', { ascending: false });

        if (error) throw error;

        const estadisticas = {
            total_cupones: cupones.length,
            cupones_activos: cupones.filter(c => c.activo).length,
            total_usos: cupones.reduce((sum, c) => sum + (c.usos_actuales || 0), 0),
            cupones_mas_usados: cupones.slice(0, 5),
            cupones_por_tipo: {
                porcentaje: cupones.filter(c => c.tipo_descuento === 'porcentaje').length,
                fijo: cupones.filter(c => c.tipo_descuento === 'fijo').length
            }
        };

        res.json(estadisticas);
    } catch (error) {
        console.error('Error obteniendo estadísticas de cupones:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener estadísticas de packs
app.get('/api/estadisticas/packs', async (req, res) => {
    try {
        // Obtener todos los packs
        const { data: packs, error: packsError } = await supabase
            .from('packs')
            .select('*');

        if (packsError) throw packsError;

        // Obtener ventas con packs (esto requeriría una tabla de ventas)
        // Por ahora retornamos estadísticas básicas
        const estadisticas = {
            total_packs: packs.length,
            packs_activos: packs.filter(p => p.activo).length,
            precio_promedio: packs.reduce((sum, p) => sum + p.precio_pack, 0) / (packs.length || 1)
        };

        res.json(estadisticas);
    } catch (error) {
        console.error('Error obteniendo estadísticas de packs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener estadísticas de descuentos
app.get('/api/estadisticas/descuentos', async (req, res) => {
    try {
        const { data: descuentos, error } = await supabase
            .from('descuentos_productos')
            .select(`
                *,
                producto:id_producto (
                    id,
                    NOMBRE,
                    PRECIO
                )
            `);

        if (error) throw error;

        const estadisticas = {
            total_descuentos: descuentos.length,
            descuentos_activos: descuentos.filter(d => d.activo).length,
            descuento_promedio: descuentos.reduce((sum, d) => sum + d.porcentaje_descuento, 0) / (descuentos.length || 1),
            productos_con_descuento: descuentos.filter(d => d.activo).length
        };

        res.json(estadisticas);
    } catch (error) {
        console.error('Error obteniendo estadísticas de descuentos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// VENTAS (POS)
// ============================================

// Crear venta y actualizar stock
app.post('/api/ventas', async (req, res) => {
    try {
        const { items, total, metodo_pago, codigo_autorizacion, id_transaccion } = req.body;

        // Validar datos
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Debe incluir items en la venta' });
        }

        if (!total || total <= 0) {
            return res.status(400).json({ error: 'El total debe ser mayor a 0' });
        }

        if (!metodo_pago || !['efectivo', 'transbank', 'transferencia'].includes(metodo_pago)) {
            return res.status(400).json({ error: 'Método de pago inválido' });
        }

        // Iniciar transacción: actualizar stock de cada producto
        const stockUpdates = [];
        const ventaItems = [];

        for (const item of items) {
            const { id_producto, cantidad, precio_unitario } = item;

            // Obtener producto actual
            const { data: producto, error: prodError } = await supabase
                .from('Productos')
                .select('id, NOMBRE, STOCK, NUM_VENTAS')
                .eq('id', id_producto)
                .single();

            if (prodError) throw new Error(`Error obteniendo producto ${id_producto}: ${prodError.message}`);
            if (!producto) throw new Error(`Producto ${id_producto} no encontrado`);

            // Verificar stock disponible
            if (producto.STOCK < cantidad) {
                return res.status(400).json({ 
                    error: `Stock insuficiente para ${producto.NOMBRE}. Disponible: ${producto.STOCK}, Solicitado: ${cantidad}` 
                });
            }

            // Preparar actualización de stock
            stockUpdates.push({
                id: id_producto,
                nuevo_stock: producto.STOCK - cantidad,
                nuevo_num_ventas: (producto.NUM_VENTAS || 0) + cantidad
            });

            ventaItems.push({
                id_producto,
                nombre_producto: producto.NOMBRE,
                cantidad,
                precio_unitario,
                subtotal: cantidad * precio_unitario
            });
        }

        // Ejecutar actualizaciones de stock
        for (const update of stockUpdates) {
            const { error: updateError } = await supabase
                .from('Productos')
                .update({ 
                    STOCK: update.nuevo_stock,
                    NUM_VENTAS: update.nuevo_num_ventas
                })
                .eq('id', update.id);

            if (updateError) throw new Error(`Error actualizando stock del producto ${update.id}: ${updateError.message}`);
        }

        // Crear registro de venta (opcional: necesitarías una tabla 'ventas')
        // Por ahora retornamos la confirmación
        const venta = {
            id: `VENTA-${Date.now()}`,
            fecha: new Date().toISOString(),
            items: ventaItems,
            total,
            metodo_pago,
            codigo_autorizacion,
            id_transaccion,
            estado: 'completada'
        };

        res.json({ 
            success: true, 
            message: 'Venta registrada exitosamente',
            venta 
        });

    } catch (error) {
        console.error('Error procesando venta:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener historial de ventas del día (para reportes)
app.get('/api/ventas/hoy', async (req, res) => {
    try {
        // Por ahora retornamos datos mock ya que no tenemos tabla de ventas
        // En producción deberías crear una tabla 'ventas' en Supabase
        res.json({
            ventas: [],
            total_del_dia: 0,
            cantidad_ventas: 0,
            metodos_pago: {
                efectivo: 0,
                transbank: 0,
                transferencia: 0
            }
        });
    } catch (error) {
        console.error('Error obteniendo ventas del día:', error);
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