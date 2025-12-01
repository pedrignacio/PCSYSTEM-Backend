const express = require('express');
const cors = require('cors');
const path = require('path');

// Cargar variables de entorno explícitamente
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Diagnóstico de variables de entorno
console.log("🔧 Diagnóstico de entorno:");
console.log("- PORT:", process.env.PORT);
console.log("- FRONTEND_URL:", process.env.FRONTEND_URL || "⚠️ Usando fallback localhost:3000");
console.log("- MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "✅ Cargado" : "❌ NO ENCONTRADO");

const app = express();
const PORT = process.env.PORT || 5000;

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

// Importar Rutas
const productRoutes = require('./src/routes/productRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const authRoutes = require('./src/routes/authRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const contactRoutes = require('./src/routes/contactRoutes');
const statsRoutes = require('./src/routes/statsRoutes');
const salesRoutes = require('./src/routes/salesRoutes');

// Usar Rutas
app.use('/api/pcs', productRoutes);
app.use('/api', paymentRoutes); // Ojo: create_preference estaba en /api/create_preference
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/estadisticas', statsRoutes);
app.use('/api/ventas', salesRoutes);

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
});