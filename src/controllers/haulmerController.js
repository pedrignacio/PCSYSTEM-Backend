const createPayment = async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!process.env.HAULMER_API_KEY) {
      return res.status(500).json({ error: "HAULMER_API_KEY no configurada" });
    }

    if (!process.env.HAULMER_DEVICE_ID) {
      return res.status(500).json({ error: "HAULMER_DEVICE_ID no configurado" });
    }

    if (!amount || amount < 100) {
      return res.status(400).json({ error: "Monto debe ser >= 100" });
    }

    // Estructura exacta según API Haulmer
    const payload = {
      Amount: Number(amount),
      Device: process.env.HAULMER_DEVICE_ID
    };

    // Campos opcionales
    if (description) payload.Description = description;

    console.log("📤 Enviando a Haulmer:", JSON.stringify(payload, null, 2));

    const response = await fetch('https://integrations.payment.haulmer.com/PaymentRequest/Create', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'X-API-Key': process.env.HAULMER_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error Haulmer:", data);
      return res.status(response.status).json({ error: data.message || "Error en Haulmer", details: data });
    }

    console.log("✅ Respuesta Haulmer:", data);
    // La respuesta v1 suele devolver un objeto con el token/id.
    res.json(data);

  } catch (error) {
    console.error("❌ Error interno Haulmer Controller:", error);
    res.status(500).json({ error: "Error interno al procesar pago Haulmer" });
  }
};

const checkPaymentStatus = async (req, res) => {
  try {
    const { token } = req.params; // Usamos 'token' o 'id'

    if (!process.env.HAULMER_API_KEY) {
      return res.status(500).json({ error: "HAULMER_API_KEY no configurada" });
    }

    const response = await fetch(`https://integrations.payment.haulmer.com/PaymentRequest/${token}`, {
      method: 'GET',
      headers: {
        'X-API-Key': process.env.HAULMER_API_KEY
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || "Error al consultar estado", details: data });
    }

    res.json(data);

  } catch (error) {
    console.error("❌ Error interno Haulmer Status:", error);
    res.status(500).json({ error: "Error interno al consultar estado Haulmer" });
  }
};

module.exports = {
  createPayment,
  checkPaymentStatus
};
