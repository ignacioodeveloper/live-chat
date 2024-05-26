import express from 'express';
import logger from 'morgan';
import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;
import { Server } from 'socket.io';
import { createServer } from 'http';

dotenv.config();

const port = process.env.PORT || 5001;

const app = express();
const server = createServer(app);
const io = new Server(server, { connectionStateRecovery: {} });

// Configuración de la conexión a la base de datos PostgreSQL en Amazon RDS
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false // Esto es necesario si usas SSL con RDS, en producción deberías configurarlo adecuadamente
  }
});

// Crear la tabla 'messages' si no existe
(async () => {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        content TEXT,
        "user" TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP

      )
      
    `);
    client.release();
  } catch (error) {
    console.error('Error al crear la tabla:', error);
  }
})();

io.on('connection', async (socket) => {
  console.log('Un cliente se ha conectado.');

  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado.');
  });
  // antiguo
  socket.on('chat message', async (msg) => {
  //socket.on('chat message', async ({ msg }) => {
    const username = socket.handshake.auth.username || 'anonymous'; // Obtener el nombre de usuario desde la autenticación del socket
    const timestamp = new Date().toISOString(); // Obtener el timestamp actual

    console.log('Mensaje recibido:', msg, 'de', username,timestamp);

    try {
      await pool.query('INSERT INTO messages (content, "user", timestamp) VALUES ($1, $2, $3)', [msg, username, timestamp]);
      
      io.emit('chat message', { msg, username,timestamp }); // Emitir el mensaje a todos los clientes conectados
    } catch (error) {
      console.error('Error al insertar el mensaje en la base de datos:', error);
    }
  });

  // Recuperar mensajes antiguos al conectar un nuevo cliente
  try {
    const result = await pool.query('SELECT id, content, "user", timestamp FROM messages');
    result.rows.forEach(row => {
      socket.emit('chat message', { msg: row.content, username: row.user, timestamp: row.timestamp });
      // antiguo 
      //socket.emit('chat message', row.content, row.user); // Emitir el mensaje al nuevo cliente
    });
  } catch (error) {
    console.error('Error al recuperar los mensajes de la base de datos:', error);
  }
});

app.use(logger('dev'));
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html');
});

server.listen(port, () => {
  console.log(`Servidor en ejecución en el puerto ${port}`);
});
