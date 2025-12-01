const supabase = require('../config/supabase');

const login = async (req, res) => {
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
};

const logout = async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        res.json({ success: true, message: 'Sesión cerrada' });
    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({ error: error.message });
    }
};

const getSession = async (req, res) => {
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
};

module.exports = { login, logout, getSession };