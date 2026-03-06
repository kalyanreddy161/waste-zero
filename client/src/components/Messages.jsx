import { useEffect, useState } from "react";
import { socket } from "../Services/socket";
//socket.emit("send_message", messageData);

//import "../styles/NavbarComponents-styles/Messages.css";

function Messages() {

  //console.log("MessagesUI Component Running");

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const sendMessage = () => {
    if (!text.trim()) return;

    const messageData = {
      sender: "me",
      text: text,
      time: new Date().toLocaleTimeString(),
    };

    socket.emit("send_message", messageData);

    setText("");
  };

  useEffect(() => {

  const handleMessage = (data) => {
    console.log("Received:", data);

    setMessages(prev => [...prev, data]);
  };

  socket.on("receive_message", handleMessage);

  return () => {
    socket.off("receive_message", handleMessage);
  };

}, []);

  return (
    <div className="page">
      <h2>Messages</h2>

      <div className="chat-box">

        <div className="chat-messages">
          {messages.length === 0 ? (
            <p className="no-msg">No messages yet</p>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`message ${msg.sender}`}>
                <p>{msg.text}</p>
                <span>{msg.time}</span>
              </div>
            ))
          )}
        </div>

        <div className="chat-input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type message..."
          />

          <button onClick={sendMessage}>
            Send
          </button>
        </div>

      </div>
    </div>
  );
}

export default Messages;