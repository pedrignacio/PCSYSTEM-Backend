const { MercadoPagoConfig, Preference } = require('mercadopago');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN 
});

module.exports = { client, Preference };