import express from 'express'

// importar morgan
import logger from 'morgan'

// base de datos
// dot env
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'
// crear cliente

import { Server } from 'socket.io'
import { createServer } from 'node:http'


// para que no de error de db
dotenv.config()

/// crear y conectar el server
const port = process.env.PORT ?? 5001


const app = express()
const server = createServer(app)
const io = new Server(server,
    // para no perder info cuando se mandan mensajes
    {connectionStateRecovery: {}}


)




// 1 crea el cliente
const db = createClient({
    url: 'libsql://chat-bot-ignacioodeveloper.turso.io',
    authToken: process.env.DB_TOKEN
})

await db.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
  );
`);


// falta refactorizar
io.on('connection', async (socket) =>  {

    console.log('un loco se a conectaooo!!')

    socket.on('disconnect', () => {
        console.log('un loco se a idooo')
    })

    // cuando reciba el evento de chat message va a recibir el msg
    // async (msg) para USAR EL AWAIT de db.execute
    socket.on('chat message', async (msg) => {

        let result;
        // grabar el mensaje en la db persistensia de datos
        const username = socket.handshake.auth.username ?? 'anonymous'
        console.log({username})
        try {
            console.log(msg)
          
            result = await db.execute({
              sql: `INSERT INTO messages (content, user) VALUES (:msg, :username)`,
              args: { msg, username }
            });
          } catch (e) {
            console.error(e)
            return
          }
        // emitir mensaje
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
        // console.log('message: ' + msg)

    })

    

    // recuperar mensajes
    if (!socket.recovered) {
        try {
            const results = await db.execute({
                sql: `SELECT id, content, user FROM messages WHERE id > ?`,
                args: [socket.handshake.auth.serverOffset ?? 0]
            })
            results.rows.forEach(row => {
                socket.emit('chat message', row.content, row.id, row.user)
            })
        }

        catch (e) {
            console.error(e)
        }
        }


    })
///

// es recomendable esto guardarlo en un archivo los mailware
// logger a nivel de request de express
app.use(logger('dev'))
app.get('/',(req, res) => {
    // 
    res.sendFile(process.cwd() + '/client/index.html')
    // res.send('<h1>tamo en websocket mi gente :) </h1>')
})

// app.listen para que sscuche la applicacion
server.listen(port, () => {
    console.log(`server running on port ${port}`)
})

// NPM RUN DEV para correrlo
// "scripts": {
//     // script personalizado para iniciar el sv inicia el index.js
//     "dev":"node --watch ./server/index.js",
//     "test": "echo \"Error: no test specified\" && exit 1"
//   },
//   "type":"module",
// npm install morgan -E