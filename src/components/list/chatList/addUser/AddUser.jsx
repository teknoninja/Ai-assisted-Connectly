import "./addUser.css";
import { supabase } from "../../../lib/supabase";
import { useState, useRef, useEffect } from "react";
import { useUserStore } from "../../../lib/userStore";
import { toast } from "react-toastify";

const AddUser = ({ onClose }) => {
  const [user, setUser] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const { currentUser } = useUserStore();

  const addUserRef = useRef(null);

  // Close the modal when a click lands outside of it.
  // Clicks on the add-friend toggle (.friend) are ignored here — its own
  // onClick already flips addMode, and handling it in both places would
  // close and instantly reopen the modal.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.target.closest(".friend")) return;
      if (addUserRef.current && !addUserRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Fetch a few existing users as suggestions when the modal opens
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .neq("id", currentUser.id)
          .limit(3);

        if (error) throw error;
        setSuggestions(data || []);
      } catch (err) {
        console.log(err);
      }
    };

    fetchSuggestions();
  }, [currentUser.id]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get("username");

    if (!username) return;

    try {
      const { data, error } = await supabase
        .from("users")
        .select()
        .eq("username", username)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
            setUser(null);
            toast.info("No user found with that username.");
            return;
        }
        throw error;
      }

      if (data) {
        setUser(data);
      }
    } catch (err) {
      console.log(err);
      toast.error("An error occurred while searching.");
    }
  };

  const handleAdd = async (targetUser) => {
    try {
      // 1. Create a new chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({})
        .select()
        .single();

      if (chatError) throw chatError;

      // 2. Add the chat entry for the receiver
      const { error: receiverChatError } = await supabase.from('user_chats').insert({
        chat_id: newChat.id,
        user_id: targetUser.id,
        receiver_id: currentUser.id,
      });

      if (receiverChatError) throw receiverChatError;

      // 3. Add the chat entry for the current user
      const { error: currentUserChatError } = await supabase.from('user_chats').insert({
        chat_id: newChat.id,
        user_id: currentUser.id,
        receiver_id: targetUser.id,
      });

      if (currentUserChatError) throw currentUserChatError;

      toast.success("User added and chat started!");
      setUser(null);

      if (onClose) {
        onClose();
      }

    } catch (err) {
      console.log(err);
      toast.error("Failed to add user.");
    }
  };

  return (
    <div className="addUser" ref={addUserRef}>
      <form onSubmit={handleSearch}>
        <input type="text" placeholder="Search username" name="username" />
        <button>Search</button>
      </form>
      {user && (
        <div className="user">
          <div className="detail">
            <img src={user.avatar_url || "./avatar.png"} alt="" />
            <span>{user.username}</span>
          </div>
          <button onClick={() => handleAdd(user)}>Add User</button>
        </div>
      )}
      {!user && suggestions.length > 0 && (
        <div className="suggestions">
          <p className="suggestionsTitle">People you may know</p>
          {suggestions.map((s) => (
            <div className="user" key={s.id}>
              <div className="detail">
                <img src={s.avatar_url || "./avatar.png"} alt="" />
                <span>{s.username}</span>
              </div>
              <button onClick={() => handleAdd(s)}>Add User</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddUser;
