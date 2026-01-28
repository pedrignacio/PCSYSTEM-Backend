const { MercadoPagoConfig, Preference } = require('mercadopago');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN 
});

const preference = new Preference(client);

module.exports = { client, preference };