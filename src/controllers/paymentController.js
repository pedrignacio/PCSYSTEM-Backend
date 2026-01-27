const { client, Preference } = require('../config/mercadopago');
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

    const { items } = req.body;
    console.log("📦 Items recibidos:", JSON.stringify(items, null, 2));

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
      // Solo activar auto_return si NO es localhost (Mercado Pago valida esto estrictamente)
      auto_return: backUrls.success.includes('localhost') || backUrls.success.includes('127.0.0.1') 
        ? undefined 
        : 'approved',
    };

    console.log("📤 Enviando a Mercado Pago:", JSON.stringify(body, null, 2));

    const preference = new Preference(client);
    const result = await preference.create({ body });

    console.log("✅ Preferencia creada con éxito. ID:", result.id);
    res.json({ id: result.id });
  } catch (error) {
    console.error("❌ Error detallado Mercado Pago:", error);
    res.status(500).json({ error: 'Error al crear la preferencia', details: error.message });
  }
};

module.exports = { createPreference, getMercadoPagoAccount };