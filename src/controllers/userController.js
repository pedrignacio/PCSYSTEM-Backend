const supabaseAdmin = require('../config/supabaseAdmin');

const getUsers = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('usuarios')
            .select('*')
            .order('creado_en', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createUser = async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;

        if (!email || !password || !nombre || !rol) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        // 1. Crear usuario en Supabase Auth (requiere Service Role Key)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { nombre, rol }
        });

        if (authError) throw new Error(`Error creando usuario Auth: ${authError.message}`);

        // 2. Crear registro en tabla usuarios
        const { data: userData, error: dbError } = await supabaseAdmin
            .from('usuarios')
            .insert({
                auth_user_id: authData.user.id,
                nombre,
                email,
                rol,
                activo: true
            })
            .select()
            .single();

        if (dbError) {
            // Rollback: eliminar usuario de Auth si falla la BD
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw new Error(`Error guardando usuario en BD: ${dbError.message}`);
        }

        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Error creando usuario:', error);
        res.status(500).json({ error: error.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, rol, password, activo } = req.body;

        // 1. Obtener usuario para tener el auth_user_id
        const { data: currentUser, error: fetchError } = await supabaseAdmin
            .from('usuarios')
            .select('auth_user_id')
            .eq('id', id)
            .single();

        if (fetchError || !currentUser) return res.status(404).json({ error: 'Usuario no encontrado' });

        // 2. Actualizar Auth si hay password o email
        if (password || email) {
            const updates = {};
            if (email) updates.email = email;
            if (password) updates.password = password;
            
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
                currentUser.auth_user_id,
                updates
            );
            if (authError) throw new Error(`Error actualizando Auth: ${authError.message}`);
        }

        // 3. Actualizar tabla usuarios
        const { data, error } = await supabaseAdmin
            .from('usuarios')
            .update({ nombre, email, rol, activo })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, user: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtener auth_user_id
        const { data: currentUser, error: fetchError } = await supabaseAdmin
            .from('usuarios')
            .select('auth_user_id')
            .eq('id', id)
            .single();

        if (fetchError) return res.status(404).json({ error: 'Usuario no encontrado' });

        // 2. Eliminar de Auth
        if (currentUser.auth_user_id) {
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(currentUser.auth_user_id);
            if (authError) console.error('Error eliminando de Auth:', authError);
        }

        // 3. Eliminar de tabla usuarios
        const { error: dbError } = await supabaseAdmin
            .from('usuarios')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
