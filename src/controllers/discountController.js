const supabase = require('../config/supabase');

const getAllDiscounts = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('descuentos_productos')
            .select(`
                *,
                Productos (
                    id,
                    NOMBRE,
                    PRECIO,
                    IMAGENES
                )
            `)
            .order('id', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error fetching discounts:', error);
        res.status(500).json({ error: 'Error al obtener descuentos' });
    }
};

const getDiscountById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('descuentos_productos')
            .select(`
                *,
                Productos (
                    id,
                    NOMBRE,
                    PRECIO
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error fetching discount:', error);
        res.status(500).json({ error: 'Error al obtener el descuento' });
    }
};

const createDiscount = async (req, res) => {
    try {
        const { producto_id, porcentaje, fecha_inicio, fecha_fin } = req.body;

        // Validaciones básicas
        if (!producto_id || !porcentaje) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        const { data, error } = await supabase
            .from('descuentos_productos')
            .insert([
                {
                    producto_id,
                    porcentaje,
                    fecha_inicio: fecha_inicio || null,
                    fecha_fin: fecha_fin || null,
                    activo: true
                }
            ])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating discount:', error);
        res.status(500).json({ error: 'Error al crear el descuento' });
    }
};

const updateDiscount = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const { data, error } = await supabase
            .from('descuentos_productos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error updating discount:', error);
        res.status(500).json({ error: 'Error al actualizar el descuento' });
    }
};

const deleteDiscount = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('descuentos_productos')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Descuento eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting discount:', error);
        res.status(500).json({ error: 'Error al eliminar el descuento' });
    }
};

module.exports = {
    getAllDiscounts,
    getDiscountById,
    createDiscount,
    updateDiscount,
    deleteDiscount
};
