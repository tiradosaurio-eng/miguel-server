const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json());

// Estado de la conexión
let waStatus = 'disconnected'; // disconnected | qr | ready
let qrDataUrl = null;

// Cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '/tmp/wwebjs_auth' }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  }
});

client.on('qr', async (qr) => {
  waStatus = 'qr';
  qrDataUrl = await qrcode.toDataURL(qr);
  console.log('QR generado — escanea desde la webapp');
});

client.on('ready', () => {
  waStatus = 'ready';
  qrDataUrl = null;
  console.log('WhatsApp conectado');
});

client.on('disconnected', () => {
  waStatus = 'disconnected';
  qrDataUrl = null;
  console.log('WhatsApp desconectado');
  // Reintentar conexión
  setTimeout(() => client.initialize(), 5000);
});

client.initialize();

// ---- ENDPOINTS ----

// Estado y QR
app.get('/status', (req, res) => {
  res.json({ status: waStatus, qr: qrDataUrl });
});

// Enviar mensaje
app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (waStatus !== 'ready') {
    return res.status(503).json({ ok: false, error: 'WhatsApp no está conectado' });
  }
  if (!phone || !message) {
    return res.status(400).json({ ok: false, error: 'Faltan phone o message' });
  }

  try {
    // Normalizar número: quitar +, espacios, guiones
    const clean = phone.replace(/[\s+\-()]/g, '');
    const chatId = `${clean}@c.us`;
    await client.sendMessage(chatId, message);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error enviando mensaje:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Health check para Railway
app.get('/', (req, res) => res.send('La noche de Miguel — servidor activo'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
