import express from "express";
import amqp from "amqplib";

const app = express();
app.use(express.json());

const EXCHANGE = "notifications";
const RABBITMQ_URL = "amqp://rabbitmq";
const MAX_RETRIES = 10;
const RETRY_DELAY = 3000; // 3 segundos

let channel;
let connection;

// Conectar a RabbitMQ con reintentos
async function connectWithRetry(retries = MAX_RETRIES) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`[Intento ${i}/${retries}] Conectando a RabbitMQ...`);
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE, "fanout", { durable: false });
      
      console.log("✓ Conectado a RabbitMQ y listo para publicar mensajes");
      
      // Manejar eventos de conexión
      connection.on("error", (err) => {
        console.error("❌ RabbitMQ connection error:", err.message);
      });
      
      connection.on("close", () => {
        console.warn("⚠️  RabbitMQ connection closed");
        channel = null;
      });
      
      return; // Éxito
    } catch (error) {
      console.error(`❌ Error al conectar (intento ${i}/${retries}):`, error.message);
      
      if (i < retries) {
        console.log(`⏳ Reintentando en ${RETRY_DELAY / 1000} segundos...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        throw new Error(`No se pudo conectar a RabbitMQ después de ${retries} intentos`);
      }
    }
  }
}

// Endpoint para publicar un mensaje
app.post("/publish", async (req, res) => {
  try {
    if (!channel) {
      return res.status(503).json({ 
        ok: false, 
        error: "No conectado a RabbitMQ" 
      });
    }

    const message = req.body.message || "Mensaje vacío";
    channel.publish(EXCHANGE, "", Buffer.from(message));
    console.log(`✓ Mensaje enviado: ${message}`);
    res.json({ ok: true, message });
  } catch (error) {
    console.error("Error al publicar:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/", (req, res) => {
  const status = channel ? "conectado" : "desconectado";
  res.json({
    service: "API Publisher",
    status,
    exchange: EXCHANGE,
    usage: "POST /publish con { message: 'tu mensaje' }"
  });
});

const PORT = process.env.PORT || 3000;

// Conectar primero, luego iniciar servidor
(async () => {
  try {
    await connectWithRetry();
    app.listen(PORT, () => {
      console.log(`✓ API REST escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error fatal al iniciar:", error.message);
    process.exit(1);
  }
})();