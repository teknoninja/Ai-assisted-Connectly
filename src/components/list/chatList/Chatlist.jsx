import { useEffect, useState } from "react";
import "./chatList.css";
import AddUser from "./addUser/AddUser"; // Correct import
import { useUserStore } from "../../lib/userStore";
import { supabase } from "../../lib/supabase"; // Import supabase client
import { useChatStore } from "../../lib/chatStore";

const ChatList = () => {
  const [chats, setChats] = useState([]);
  const [addMode, setAddMode] = useState(false);
  const [input, setInput] = useState("");

  const { currentUser } = useUserStore();
  const { changeChat } = useChatStore();

  useEffect(() => {
    if (!currentUser?.id) return;

    // Function to fetch chats and related user data
    const fetchChats = async () => {
      try {
        const { data, error } = await supabase
          .from('user_chats')
          .select(`
            *,
            receiver:receiver_id (id, username, avatar_url, blocked)
          `)
          .eq('user_id', currentUser.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const formattedChats = data.map(chat => ({
            ...chat,
            user: chat.receiver,
        }));
        setChats(formattedChats);
      } catch (error) {
        console.error("Error fetching chats:", error);
      }
    };

    fetchChats();

    // Set up a real-time subscription to the user_chats table
    const subscription = supabase
      .channel('user_chats_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_chats', filter: `user_id=eq.${currentUser.id}` },
        (payload) => {
          // When any change occurs, re-fetch the entire chat list
          fetchChats();
        }
      )
      .subscribe();


    // Cleanup the subscription when the component unmounts
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentUser.id]);

  const handleSelect = async (chat) => {
    await supabase
      .from('user_chats')
      .update({ is_seen: true })
      .eq('chat_id', chat.chat_id)
      .eq('user_id', currentUser.id);
      
    setChats(prevChats => 
        prevChats.map(c => 
            c.chat_id === chat.chat_id ? { ...c, is_seen: true } : c
        )
    );

    changeChat(chat.chat_id, chat.user);
  };

  const filteredChats = chats.filter((c) =>
    c.user?.username.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div className="chatList">
      <div className="search">
        <div className="searchBar">
          <img src="./search.png" alt="" />
          <input
            type="text"
            placeholder="Search a friend if you have one or add a friend"
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="friend">

        <img
          src={addMode ? "./minus.png" : "./plus.png"}
          alt=""
          className="add"
          onClick={() => setAddMode((prev) => !prev)}
          />
        <span>Add Friend</span>
          </div>
      </div>
      {filteredChats.map((chat) => (
        <div
          className="item"
          key={chat.chat_id}
          onClick={() => handleSelect(chat)}
          style={{
            backgroundColor: chat?.is_seen ? "transparent" : "#5183fe",
          }}
        >
          <img
            src={
              chat.user?.blocked?.includes(currentUser.id)
                ? "./avatar.png"
                : chat.user?.avatar_url || "./avatar.png"
            }
            alt=""
          />
          <div className="texts">
            <span>
              {chat.user?.blocked?.includes(currentUser.id)
                ? "User"
                : chat.user?.username}
            </span>
            <p>{chat.last_message}</p>
          </div>
        </div>
      ))}

      {/* --- THIS IS THE CHANGE --- */}
      {/* Pass the function to set addMode to false as the onClose prop */}
      {addMode && <AddUser onClose={() => setAddMode(false)} />}
    </div>
  );
};

export default ChatList;