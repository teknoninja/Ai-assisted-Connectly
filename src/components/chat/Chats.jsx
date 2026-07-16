import { useEffect, useRef, useState } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import { supabase } from "../lib/supabase";
import { useChatStore } from "../lib/chatStore";
import { useUserStore } from "../lib/userStore";
import upload from "../lib/upload";
import { format } from "timeago.js";

const Chat = () => {
  
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [img, setImg] = useState({
    file: null,
    url: "",
  });

  const { currentUser } = useUserStore();
  
  const {
    chatId,
    user,
    isCurrentUserBlocked,
    isReceiverBlocked,
    resetChat,
    toggleDetail,
  } = useChatStore();

  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!chatId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      setMessages(data || []);
    };

    fetchMessages();

    const subscription = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [chatId]);

  const handleEmoji = (e) => {
    setText((prev) => prev + e.emoji);
    setOpen(false);
  };

  const handleImg = (e) => {
    if (e.target.files[0]) {
      setImg({
        file: e.target.files[0],
        url: URL.createObjectURL(e.target.files[0]),
      });
    }
  };

  const handleSend = async () => {
    if (text === "" && !img.file) return;

    let imgUrl = null;

    try {
      if (img.file) {
        imgUrl = await upload(img.file);
      }

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        text: text,
        img_url: imgUrl,
      });

      const lastMessageText = text || "Image";
      const now = new Date().toISOString();

      await supabase
        .from("user_chats")
        .update({
          last_message: lastMessageText,
          is_seen: true,
          updated_at: now,
        })
        .eq("chat_id", chatId)
        .eq("user_id", currentUser.id);

      await supabase
        .from("user_chats")
        .update({
          last_message: lastMessageText,
          is_seen: false,
          updated_at: now,
        })
        .eq("chat_id", chatId)
        .eq("user_id", user.id);
    } catch (err) {
      console.log(err);
    } finally {
      setImg({ file: null, url: "" });
      setText("");
    }
  };

  return (
    <div className="chat">
      <div className="top">
        <div className="user">
          <img
            src="./arrow-left.png"
            alt="Back"
            className="back-button"
            onClick={resetChat}
          />
          <img src={user?.avatar_url || "./avatar.png"} alt="" />
          <div className="texts">
            <span>{user?.username}</span>
            <p>User status placeholder.</p>
          </div>
        </div>
        <div className="icons">
          <img src="./phone.png" alt="" />
          <img src="./video.png" alt="" />
          
          <div className="settings" onClick={toggleDetail} >
            
          <img src="./info.png" alt=""  />
          <span>Settings</span>
          </div>
        </div>
      </div>
      <div className="center">
        {messages?.map((message) => (
          <div
            className={
              message.sender_id === currentUser?.id ? "message own" : "message"
            }
            key={message.id}
          >
            <div className="texts">
              {message.img_url && <img src={message.img_url} alt="" />}
              <p>{message.text}</p>
              <span>{format(message.created_at)}</span>
            </div>
          </div>
        ))}
        {img.url && (
          <div className="message own">
            <div className="texts">
              <img src={img.url} alt="Preview" />
            </div>
          </div>
        )}
        <div ref={endRef}></div>
      </div>
      <div className="bottom">
        <div className="icons">
          <label htmlFor="file">
            <img src="./img.png" alt="" />
          </label>
          <input
            type="file"
            id="file"
            style={{ display: "none" }}
            onChange={handleImg}
          />
          <img src="./camera.png" alt="" />
          <img src="./mic.png" alt="" />
        </div>
        <input
          type="text"
          placeholder={
            isCurrentUserBlocked || isReceiverBlocked
              ? "You cannot send a message"
              : "Type a message..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isCurrentUserBlocked || isReceiverBlocked}
        />
        <div className="emoji">
          <img
            src="./emoji.png"
            alt=""
            onClick={() => setOpen((prev) => !prev)}
          />
          <div className="picker">
            <EmojiPicker open={open} onEmojiClick={handleEmoji} />
          </div>
        </div>
        <button
          className="sendButton button"
          onClick={handleSend}
          disabled={isCurrentUserBlocked || isReceiverBlocked}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
