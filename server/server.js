const express = require('express')
const { Server } = require('socket.io');
const app = express();
const cors = require('cors');
app.use(cors())
const http = require('http');
const server = http.createServer(app);
const io = new Server(server);
const ACTIONS = require('./Action')
const userSocketMap = {};

function getAllConnectedClients(roomId) {

    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            }
        });
}
io.on('connection', (socket) => {
    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);

        // Notify the newly joined user about existing clients
        const clients = getAllConnectedClients(roomId);
        socket.emit(ACTIONS.JOINED, {
            clients,
            username,
            socketId: socket.id,
        });

        // Notify existing clients about the new join
        socket.broadcast.to(roomId).emit(ACTIONS.JOINED, {
            clients: [{ socketId: socket.id, username }],
            username,
            socketId: socket.id,
        });
    });
    
    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {
            code
        });
    })
    socket.on(ACTIONS.SEND, ({ roomId, messages, currentuser }) => {
        io.in(roomId).emit(ACTIONS.RECEIVE, {
            messages,
            currentuser,
        });

    })
    socket.on(ACTIONS.SYNC_CODE, ({ code, socketId }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, {
            code
        });
    })

socket.on(ACTIONS.SEND_MESSAGE, ({ roomId, message }) => {
  // Broadcast the message to all clients in the same room except the sender
  socket.broadcast.to(roomId).emit(ACTIONS.SEND_MESSAGE, { message });
});

      socket.on(ACTIONS.GET_OUTPUT, ({ roomId, output }) => {
        // Broadcast the code output to all clients in the same room
        socket.to(roomId).emit(ACTIONS.GET_OUTPUT, { output });
      });




    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECT, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    })



})

app.get('/', (req, res) => {
    res.send("<h1>Backend is up and running!</h1>");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on ${PORT}`));
