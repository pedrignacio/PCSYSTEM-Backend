const { client, preference } = require('../config/mercadopago');
const https = require('https');

const mpGetMe = (accessToken) => {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.mercadopago.com',
        path: '/users/me',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
};

const getMercadoPagoAccount = async (req, res) => {
  try {
    if (!process.env.MP_DIAGNOSTIC_TOKEN) {
      return res.status(404).json({ error: 'Not found' });
    }

    const providedToken = req.headers['x-diag-token'];
    if (!providedToken || providedToken !== process.env.MP_DIAGNOSTIC_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
    }

    const { status, body } = await mpGetMe(process.env.MP_ACCESS_TOKEN);

    if (status < 200 || status >= 300) {
      return res.status(502).json({
        error: 'No se pudo obtener la cuenta de Mercado Pago',
        status,
        details: body,
      });
    }

    const data = JSON.parse(body);
    return res.json({
      id: data.id,
      nickname: data.nickname,
      email: data.email,
      site_id: data.site_id,
    });
  } catch (error) {
    console.error('❌ Error diagnóstico Mercado Pago:', error);
    return res.status(500).json({ error: 'Error interno', details: error.message });
  }
};

const createPreference = async (req, res) => {
  try {
    console.log("💰 Iniciando creación de preferencia de pago...");
    
    if (!process.env.MP_ACCESS_TOKEN) {
      console.error("❌ Error: MP_ACCESS_TOKEN no está definido en .env");
      return res.status(500).json({ error: "Configuración de pago incompleta" });
    }

    const { items, external_reference, order_id } = req.body;
    console.log("📦 Items recibidos:", JSON.stringify(items, null, 2));
    console.log("🔖 External reference:", external_reference);
    console.log("📋 Order ID:", order_id);

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío" });
    }

    const backUrls = {
      success: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pago/exito`,
      failure: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pago/fallo`,
      pending: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pago/pendiente`,
    };

    const body = {
      items: items.map(item => ({
        title: item.name || item.NOMBRE, 
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.price || item.PRECIO),
        currency_id: 'CLP',
      })),
      back_urls: backUrls,
      // External reference para identificar la orden en el webhook
      external_reference: external_reference || order_id || `MP-${Date.now()}`,
      // Solo activar auto_return si NO es localhost (Mercado Pago valida esto estrictamente)
      auto_return: process.env.NODE_ENV === 'production' ? 'approved' : undefined,
      // Notification URL para webhooks
      notification_url: process.env.MP_WEBHOOK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/webhooks/mercadopago`,
    };

    console.log("📤 Creando preferencia con body:", JSON.stringify(body, null, 2));

    const result = await preference.create({ body });

    console.log("✅ Preferencia creada exitosamente");
    console.log("🆔 ID:", result.id);
    console.log("🔗 Init Point:", result.init_point);

    res.json({
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    });
  } catch (error) {
    console.error("❌ Error creando preferencia:", error);
    res.status(500).json({ 
      error: "Error al procesar el pago",
      details: error.message 
    });
  }
};

module.exports = { createPreference, getMercadoPagoAccount };