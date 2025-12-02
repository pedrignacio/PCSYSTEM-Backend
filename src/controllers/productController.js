const supabase = require('../config/supabase');

const getFeatured = async (req, res) => {
    try {
        console.log('🔍 Buscando productos destacados...');
        let { data, error } = await supabase
            .from('Productos')
            .select('*')
            .eq('destacado', true)
            .limit(10);

        if (error || !data || data.length === 0) {
            console.log('⚠️ No se encontraron destacados o error en columna, buscando últimos productos...');
            const fallback = await supabase
                .from('Productos')
                .select('*')
                .order('id', { ascending: false })
                .limit(5);
            
            if (fallback.error) throw fallback.error;
            data = fallback.data;
        }

        console.log(`✅ Encontrados ${data.length} productos destacados/recientes`);
        res.json(data);
    } catch (error) {
        console.error('❌ Error obteniendo productos destacados:', error);
        res.status(500).json({ error: error.message });
    }
};

const getAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const all = req.query.all === 'true';
        
        if (all) {
            const { data, error } = await supabase
                .from('Productos')
                .select('*')
                .order('POSICION', { ascending: true });
            
            if (error) throw error;
            res.json(data);
        } else {
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
};

const search = async (req, res) => {
    try {
        const { q, category, minPrice, maxPrice, inStock } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        let query = supabase.from('Productos').select('*', { count: 'exact' });

        if (q) {
            query = query.or(`NOMBRE.ilike.%${q}%,DETALLE.ilike.%${q}%,CATEGORIA.ilike.%${q}%,codigo_barra.eq.${q}`);
        }

        if (category && category !== 'all') {
            query = query.eq('CATEGORIA', category);
        }

        if (minPrice) {
            query = query.gte('PRECIO', parseFloat(minPrice));
        }
        if (maxPrice) {
            query = query.lte('PRECIO', parseFloat(maxPrice));
        }

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
};

const getCategories = async (req, res) => {
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
};

const getLowStock = async (req, res) => {
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
};

const getTopSelling = async (req, res) => {
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
};

const updatePositions = async (req, res) => {
    try {
        const { positions } = req.body;

        if (!Array.isArray(positions)) {
            return res.status(400).json({ error: 'Se requiere un array de posiciones' });
        }

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
};

const getRelated = async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 4;

        const { data: product, error: productError } = await supabase
            .from('Productos')
            .select('CATEGORIA')
            .eq('id', id)
            .single();

        if (productError) throw productError;

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
};

const getById = async (req, res) => {
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
};

const create = async (req, res) => {
    try {
        const { NOMBRE, DETALLE, PRECIO, CATEGORIA, SUBCATEGORIA, STOCK, stock, codigo_barra, imageCropData, images, videos, mainImageIndex } = req.body;
        
        if (!NOMBRE) {
            return res.status(400).json({ error: 'NOMBRE es requerido' });
        }

        // Construir objeto IMAGENES
        const IMAGENES = {
            images: images || [],
            videos: videos || [],
            mainImageIndex: mainImageIndex || 0,
            imageCropData: imageCropData || {}
        };

        const newProduct = {
            NOMBRE,
            DETALLE,
            PRECIO,
            CATEGORIA,
            SUBCATEGORIA,
            STOCK: STOCK || stock || 0, // Manejar ambas mayúsculas/minúsculas
            codigo_barra,
            IMAGENES // Usar columna JSONB
        };

        const { data, error } = await supabase
            .from('Productos')
            .insert([newProduct])
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
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Preparar objeto de actualización limpio
        const cleanUpdates = {};

        // Campos directos permitidos (Mayúsculas según DB)
        const allowedFields = ['NOMBRE', 'DETALLE', 'PRECIO', 'CATEGORIA', 'SUBCATEGORIA', 'STOCK', 'codigo_barra', 'POSICION', 'NUM_VENTAS', 'destacado'];
        
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                cleanUpdates[field] = updates[field];
            }
        });

        // Mapeo de campos especiales
        if (updates.stock !== undefined) cleanUpdates.STOCK = updates.stock;

        // Manejo de IMAGENES (JSONB)
        // Si viene alguno de los campos de medios, actualizamos todo el objeto IMAGENES
        if (updates.images || updates.videos || updates.mainImageIndex !== undefined || updates.imageCropData) {
            cleanUpdates.IMAGENES = {
                images: updates.images || [],
                videos: updates.videos || [],
                mainImageIndex: updates.mainImageIndex || 0,
                imageCropData: updates.imageCropData || {}
            };
        } else if (updates.IMAGENES) {
            // Si ya viene como objeto IMAGENES
            cleanUpdates.IMAGENES = updates.IMAGENES;
        }

        const { data, error } = await supabase
            .from('Productos')
            .update(cleanUpdates)
            .eq('id', id)
            .select();

        if (error) throw error;
        
        res.json({ message: 'Producto actualizado', data: data[0] });
    } catch (error) {
        console.error('Error actualizando producto:', error);
        res.status(500).json({ error: error.message });
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('Productos')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getFeatured,
    getAll,
    search,
    getCategories,
    getLowStock,
    getTopSelling,
    updatePositions,
    getRelated,
    getById,
    create,
    update,
    remove
};