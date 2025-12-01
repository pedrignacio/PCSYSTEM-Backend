const supabase = require('../config/supabase');

const createSale = async (req, res) => {
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
};

const getDailySales = async (req, res) => {
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
};

module.exports = { createSale, getDailySales };