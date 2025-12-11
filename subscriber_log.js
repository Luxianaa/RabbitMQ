const amqp = require('amqplib');
const exchangeName = 'notifications';
const RABBITMQ_URL = 'amqp://rabbitmq';
const MAX_RETRIES = 10;
const RETRY_DELAY = 3000; // 3 segundos

async function connectWithRetry(retries = MAX_RETRIES) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`[LOG] Intento ${i}/${retries} - Conectando a RabbitMQ...`);
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();
      await channel.assertExchange(exchangeName, 'fanout', { durable: false });
      
      const q = await channel.assertQueue('', { exclusive: true });
      console.log(`[LOG] ✓ Conectado. Escuchando mensajes en la cola: ${q.queue}`);
      
      channel.bindQueue(q.queue, exchangeName, '');
      channel.consume(q.queue, (msg) => {
        if (msg.content) {
          console.log(`[LOG] 📝 Registrando mensaje: ${msg.content.toString()}`);
        }
      }, { noAck: true });
      
      connection.on('error', (err) => {
        console.error('[LOG] ❌ Connection error:', err.message);
      });
      
      return; // Éxito
    } catch (error) {
      console.error(`[LOG] ❌ Error (intento ${i}/${retries}):`, error.message);
      
      if (i < retries) {
        console.log(`[LOG] ⏳ Reintentando en ${RETRY_DELAY / 1000} segundos...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        throw new Error(`No se pudo conectar después de ${retries} intentos`);
      }
    }
  }
}

connectWithRetry().catch((err) => {
  console.error('[LOG] ❌ Error fatal:', err.message);
  process.exit(1);
});
