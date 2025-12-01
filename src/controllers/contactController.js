const emailTransporter = require('../config/nodemailer');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const sendMessage = async (req, res) => {
    try {
        const { name, email, phone, service, message } = req.body;

        // Validación básica
        if (!name || !email || !message) {
            return res.status(400).json({ 
                error: 'Faltan campos requeridos: nombre, email y mensaje son obligatorios' 
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        // Registrar en consola
        console.log('📧 Nuevo mensaje de contacto:', {
            name,
            email,
            phone,
            service,
            message,
            timestamp: new Date().toISOString(),
        });

        // Intentar enviar email si está configurado
        if (emailTransporter) {
            try {
                await emailTransporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: process.env.CONTACT_EMAIL || 'contacto@pcsystems.cl',
                    replyTo: email,
                    subject: `Nuevo mensaje de contacto - ${name}`,
                    html: `
                        <h2>Nuevo mensaje de contacto desde PCSystem</h2>
                        <p><strong>Nombre:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Teléfono:</strong> ${phone || 'No proporcionado'}</p>
                        <p><strong>Servicio de Interés:</strong> ${service || 'No especificado'}</p>
                        <p><strong>Mensaje:</strong></p>
                        <p>${message.replace(/\n/g, '<br>')}</p>
                    `,
                });
            } catch (emailError) {
                console.error('Error enviando email:', emailError);
                // No fallar la request si el email falla
            }
        }

        // Generar URL de WhatsApp como fallback
        const whatsappMessage = `Nuevo contacto web:\n\nNombre: ${name}\nEmail: ${email}\nTeléfono: ${phone || 'N/A'}\nServicio: ${service || 'N/A'}\nMensaje: ${message}`;
        const whatsappUrl = `https://wa.me/56989142836?text=${encodeURIComponent(whatsappMessage)}`;

        res.json({
            success: true,
            message: 'Mensaje recibido correctamente',
            whatsappUrl,
        });

    } catch (error) {
        console.error('Error en API de contacto:', error);
        res.status(500).json({
            error: 'Error al procesar el mensaje',
            details: error.message,
        });
    }
};

module.exports = { sendMessage };