const supabase = require('../config/supabase');

const createSale = async (req, res) => {
    try {
        const { items, total, metodo_pago, codigo_autorizacion, id_transaccion, documento_tipo, tipo_venta, observaciones } = req.body;

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
            const { id_producto, cantidad, precio_unitario, is_custom } = item;

            // Si es un item personalizado, no verificamos stock
            if (is_custom) {
                ventaItems.push({
                    id_producto: null,
                    nombre_producto: item.nombre_producto || 'Item Personalizado',
                    cantidad,
                    precio_unitario,
                    subtotal: cantidad * precio_unitario,
                    is_custom: true
                });
                continue;
            }

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
                subtotal: cantidad * precio_unitario,
                is_custom: false
            });
        }

        // 1. Crear registro de venta en BD
        const { data: venta, error: ventaError } = await supabase
            .from('ventas')
            .insert({
                total,
                metodo_pago,
                documento_tipo,
                tipo_venta,
                observaciones,
                codigo_autorizacion,
                id_transaccion,
                estado: 'completada'
            })
            .select()
            .single();

        if (ventaError) throw new Error(`Error creando venta: ${ventaError.message}`);

        // 2. Insertar detalles de venta
        const detallesParaInsertar = ventaItems.map(item => ({
            venta_id: venta.id,
            producto_id: item.id_producto,
            nombre_producto: item.nombre_producto,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            subtotal: item.subtotal,
            is_custom: item.is_custom
        }));

        const { error: detalleError } = await supabase
            .from('detalle_ventas')
            .insert(detallesParaInsertar);

        if (detalleError) {
            // Rollback (eliminar venta si fallan los detalles)
            await supabase.from('ventas').delete().eq('id', venta.id);
            throw new Error(`Error guardando detalles: ${detalleError.message}`);
        }

        // 3. Ejecutar actualizaciones de stock (solo si todo lo anterior salió bien)
        for (const update of stockUpdates) {
            const { error: updateError } = await supabase
                .from('Productos')
                .update({ 
                    STOCK: update.nuevo_stock,
                    NUM_VENTAS: update.nuevo_num_ventas
                })
                .eq('id', update.id);

            if (updateError) console.error(`Error actualizando stock del producto ${update.id}: ${updateError.message}`);
        }

        res.json({ 
            success: true, 
            message: 'Venta registrada exitosamente',
            venta: { ...venta, items: ventaItems }
        });

    } catch (error) {
        console.error('Error procesando venta:', error);
        res.status(500).json({ error: error.message });
    }
};

const getSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: venta, error } = await supabase
            .from('ventas')
            .select(`
                *,
                detalle_ventas (*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

        res.json(venta);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const cancelSale = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Obtener venta y detalles
        const { data: venta, error: fetchError } = await supabase
            .from('ventas')
            .select(`*, detalle_ventas (*)`)
            .eq('id', id)
            .single();

        if (fetchError || !venta) return res.status(404).json({ error: 'Venta no encontrada' });
        if (venta.estado === 'anulada') return res.status(400).json({ error: 'La venta ya está anulada' });

        // 2. Restaurar stock
        for (const item of venta.detalle_ventas) {
            if (!item.is_custom && item.producto_id) {
                // Obtener stock actual
                const { data: prod } = await supabase
                    .from('Productos')
                    .select('STOCK')
                    .eq('id', item.producto_id)
                    .single();
                
                if (prod) {
                    await supabase
                        .from('Productos')
                        .update({ STOCK: prod.STOCK + item.cantidad })
                        .eq('id', item.producto_id);
                }
            }
        }

        // 3. Marcar venta como anulada
        const { error: updateError } = await supabase
            .from('ventas')
            .update({ estado: 'anulada' })
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({ success: true, message: 'Venta anulada y stock restaurado' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getDailySales = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: ventas, error } = await supabase
            .from('ventas')
            .select('*')
            .gte('fecha', today.toISOString())
            .eq('estado', 'completada');

        if (error) throw error;

        const total = ventas.reduce((sum, v) => sum + v.total, 0);
        const metodos = ventas.reduce((acc, v) => {
            acc[v.metodo_pago] = (acc[v.metodo_pago] || 0) + v.total;
            return acc;
        }, { efectivo: 0, transbank: 0, transferencia: 0 });

        res.json({
            ventas,
            total_del_dia: total,
            cantidad_ventas: ventas.length,
            metodos_pago: metodos
        });
    } catch (error) {
        console.error('Error obteniendo ventas del día:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { createSale, getDailySales, getSaleById, cancelSale };