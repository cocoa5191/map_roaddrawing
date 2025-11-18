// This file contains the client-side JavaScript code that interacts with the Socket.io server.

const socket = io(); // Connect to the Socket.io server

// Event listener for form submission
document.getElementById('messageForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission

    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value; // Get the message from the input field
    socket.emit('chat message', message); // Send the message to the server
    messageInput.value = ''; // Clear the input field
});

// Event listener for receiving messages from the server
socket.on('chat message', function(msg) {
    const messagesList = document.getElementById('messages');
    const newMessage = document.createElement('li'); // Create a new list item
    newMessage.textContent = msg; // Set the text content to the received message
    messagesList.appendChild(newMessage); // Append the new message to the list
});