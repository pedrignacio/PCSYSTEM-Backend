const supabase = require('../config/supabase');
const https = require('https');

/**
 * Obtener detalles del pago desde Mercado Pago API
 */
const getPaymentDetails = (paymentId, accessToken) => {
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: 'api.mercadopago.com',
                path: `/v1/payments/${paymentId}`,
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
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(body));
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                });
            }
        );

        req.on('error', reject);
        req.end();
    });
};

/**
 * Webhook de Mercado Pago
 * Recibe notificaciones de cambios de estado de pagos
 */
const mercadoPagoWebhook = async (req, res) => {
    try {
        console.log('🔔 Webhook recibido de Mercado Pago');
        console.log('📋 Body:', JSON.stringify(req.body, null, 2));
        console.log('📋 Query:', JSON.stringify(req.query, null, 2));

        // Mercado Pago envía notificaciones de varios tipos
        const { type, action } = req.body;
        const { id, topic } = req.query;

        // Responder inmediatamente a MP (200 OK)
        // MP espera una respuesta rápida o reintentará
        res.status(200).send('OK');

        // Procesar la notificación de forma asíncrona
        // Solo procesamos notificaciones de pagos
        if (type !== 'payment' && topic !== 'payment') {
            console.log(`ℹ️ Tipo de notificación ignorada: ${type || topic}`);
            return;
        }

        const paymentId = id || req.body.data?.id;

        if (!paymentId) {
            console.log('⚠️ No se recibió payment_id en el webhook');
            return;
        }

        console.log(`💳 Procesando pago: ${paymentId}`);

        // Obtener detalles del pago desde Mercado Pago
        if (!process.env.MP_ACCESS_TOKEN) {
            console.error('❌ MP_ACCESS_TOKEN no configurado');
            return;
        }

        const payment = await getPaymentDetails(paymentId, process.env.MP_ACCESS_TOKEN);

        console.log('📦 Detalles del pago:', JSON.stringify(payment, null, 2));

        const { 
            status, 
            status_detail, 
            external_reference,
            transaction_amount,
            payer
        } = payment;

        console.log(`💰 Estado: ${status}, Monto: ${transaction_amount}, Referencia: ${external_reference}`);

        // Buscar orden por preference_id o external_reference
        let orden = null;

        if (external_reference) {
            const { data } = await supabase
                .from('ordenes')
                .select('*')
                .eq('external_reference', external_reference)
                .single();
            
            orden = data;
        }

        // Si no encontramos por external_reference, buscar por preference_id
        if (!orden && payment.preference_id) {
            const { data } = await supabase
                .from('ordenes')
                .select('*')
                .eq('preference_id', payment.preference_id)
                .single();
            
            orden = data;
        }

        if (!orden) {
            console.log(`⚠️ No se encontró orden para payment_id: ${paymentId}`);
            // Esto puede pasar si el webhook llega antes que createOrder
            // MP reintentará, así que no es crítico
            return;
        }

        console.log(`📋 Orden encontrada: ${orden.id}`);

        // Mapear estado de Mercado Pago a nuestro sistema
        let payment_status = status; // approved, rejected, pending, etc.
        let nuevo_estado = orden.estado;

        if (status === 'approved') {
            nuevo_estado = 'pagado';
            console.log('✅ Pago aprobado - Orden marcada como pagado');
        } else if (status === 'rejected') {
            nuevo_estado = 'cancelado';
            console.log('❌ Pago rechazado - Orden cancelada');
        } else if (status === 'pending') {
            nuevo_estado = 'pendiente';
            console.log('⏳ Pago pendiente');
        }

        // Actualizar orden en BD
        const { error: updateError } = await supabase
            .from('ordenes')
            .update({
                payment_id: paymentId,
                payment_status,
                estado: nuevo_estado,
                actualizado_en: new Date().toISOString()
            })
            .eq('id', orden.id);

        if (updateError) {
            console.error('❌ Error actualizando orden:', updateError);
            return;
        }

        console.log(`✅ Orden ${orden.id} actualizada exitosamente`);

        // TODO: Aquí podríamos:
        // 1. Enviar email de confirmación al cliente
        // 2. Actualizar stock de productos
        // 3. Notificar al admin
        // 4. Crear registro de envío si el pago fue aprobado

        if (status === 'approved') {
            // Actualizar stock de productos vendidos
            const { data: detalles } = await supabase
                .from('detalle_ordenes')
                .select('producto_id, cantidad')
                .eq('orden_id', orden.id);

            if (detalles && detalles.length > 0) {
                for (const item of detalles) {
                    if (item.producto_id) {
                        // Obtener stock actual
                        const { data: producto } = await supabase
                            .from('Productos')
                            .select('STOCK, NUM_VENTAS')
                            .eq('id', item.producto_id)
                            .single();

                        if (producto) {
                            // Actualizar stock y ventas
                            await supabase
                                .from('Productos')
                                .update({
                                    STOCK: Math.max(0, producto.STOCK - item.cantidad),
                                    NUM_VENTAS: (producto.NUM_VENTAS || 0) + item.cantidad
                                })
                                .eq('id', item.producto_id);

                            console.log(`📦 Stock actualizado para producto ${item.producto_id}`);
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ Error en webhook de Mercado Pago:', error);
        // No lanzamos el error porque ya respondimos 200 OK a MP
    }
};

module.exports = {
    mercadoPagoWebhook
};
