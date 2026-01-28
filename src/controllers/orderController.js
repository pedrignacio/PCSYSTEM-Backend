const supabase = require('../config/supabase');

/**
 * Crear una nueva orden desde el checkout
 * Se llama ANTES de redirigir a Mercado Pago
 */
const createOrder = async (req, res) => {
    try {
        const {
            // Datos del cliente
            cliente_nombre,
            cliente_email,
            cliente_telefono,
            
            // Datos de entrega
            direccion,
            ciudad,
            metodo_entrega,
            lat,
            lng,
            
            // Items del carrito
            items,
            
            // Total
            total,
            
            // Observaciones
            observaciones,
            
            // Mercado Pago
            preference_id
        } = req.body;

        // Validaciones
        if (!cliente_nombre || !cliente_email) {
            return res.status(400).json({ 
                error: 'Faltan datos del cliente (nombre y email son obligatorios)' 
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'El carrito está vacío' });
        }

        if (!total || total <= 0) {
            return res.status(400).json({ error: 'Total inválido' });
        }

        // Generar external_reference única
        const external_reference = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Crear orden en BD
        const { data: orden, error: ordenError } = await supabase
            .from('ordenes')
            .insert({
                cliente_nombre,
                cliente_email,
                cliente_telefono,
                direccion,
                ciudad,
                metodo_entrega: metodo_entrega || 'domicilio',
                lat,
                lng,
                metodo_pago: 'mercadopago',
                total,
                preference_id,
                external_reference,
                payment_status: 'pending',
                estado: 'pendiente',
                observaciones
            })
            .select()
            .single();

        if (ordenError) {
            console.error('❌ Error creando orden:', ordenError);
            throw ordenError;
        }

        console.log('✅ Orden creada:', orden.id);

        // Crear detalles de la orden (items)
        const detalleItems = items.map(item => ({
            orden_id: orden.id,
            producto_id: item.id || null,
            nombre_producto: item.name || item.NOMBRE || 'Producto sin nombre',
            cantidad: item.quantity || 1,
            precio_unitario: item.price || item.PRECIO || 0,
            subtotal: (item.quantity || 1) * (item.price || item.PRECIO || 0),
            imagen_url: item.image || item.IMAGENES?.[0] || null
        }));

        const { error: detalleError } = await supabase
            .from('detalle_ordenes')
            .insert(detalleItems);

        if (detalleError) {
            console.error('❌ Error creando detalle de orden:', detalleError);
            // Intentar rollback
            await supabase.from('ordenes').delete().eq('id', orden.id);
            throw detalleError;
        }

        console.log(`✅ ${detalleItems.length} items agregados a la orden`);

        res.json({
            success: true,
            orden: {
                id: orden.id,
                external_reference,
                total: orden.total,
                estado: orden.estado
            }
        });

    } catch (error) {
        console.error('❌ Error en createOrder:', error);
        res.status(500).json({ 
            error: 'Error al crear la orden',
            details: error.message 
        });
    }
};

/**
 * Obtener una orden por ID
 */
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: orden, error } = await supabase
            .from('ordenes')
            .select(`
                *,
                detalle_ordenes (*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        res.json(orden);
    } catch (error) {
        console.error('❌ Error obteniendo orden:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Obtener todas las órdenes (con paginación)
 */
const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 20, estado, payment_status } = req.query;
        
        const offset = (page - 1) * limit;

        let query = supabase
            .from('ordenes')
            .select(`
                *,
                detalle_ordenes (*)
            `, { count: 'exact' })
            .order('creado_en', { ascending: false })
            .range(offset, offset + limit - 1);

        // Filtros opcionales
        if (estado) {
            query = query.eq('estado', estado);
        }

        if (payment_status) {
            query = query.eq('payment_status', payment_status);
        }

        const { data: ordenes, error, count } = await query;

        if (error) throw error;

        res.json({
            ordenes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('❌ Error obteniendo órdenes:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Actualizar estado de una orden
 */
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, notas } = req.body;

        const estadosValidos = ['pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'];
        
        if (!estado || !estadosValidos.includes(estado)) {
            return res.status(400).json({ 
                error: 'Estado inválido',
                estadosValidos 
            });
        }

        const { data: orden, error } = await supabase
            .from('ordenes')
            .update({ estado })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // El trigger registrará automáticamente el cambio en historial_ordenes

        console.log(`✅ Orden ${id} actualizada a estado: ${estado}`);

        res.json({
            success: true,
            orden
        });
    } catch (error) {
        console.error('❌ Error actualizando orden:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Obtener historial de cambios de una orden
 */
const getOrderHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: historial, error } = await supabase
            .from('historial_ordenes')
            .select('*')
            .eq('orden_id', id)
            .order('creado_en', { ascending: true });

        if (error) throw error;

        res.json(historial);
    } catch (error) {
        console.error('❌ Error obteniendo historial:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createOrder,
    getOrderById,
    getAllOrders,
    updateOrderStatus,
    getOrderHistory
};
