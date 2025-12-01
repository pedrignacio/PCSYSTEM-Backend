const { client, Preference } = require('../config/mercadopago');

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

module.exports = { createPreference };