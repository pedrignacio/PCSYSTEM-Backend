const supabase = require('../config/supabase');

const getCouponsStats = async (req, res) => {
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
};

const getPacksStats = async (req, res) => {
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
};

const getDiscountsStats = async (req, res) => {
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
};

module.exports = { getCouponsStats, getPacksStats, getDiscountsStats };