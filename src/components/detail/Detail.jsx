import { useEffect, useState } from "react";
import { useChatStore } from "../lib/chatStore";
import { useUserStore } from "../lib/userStore";
import "./detail.css";
import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";

const Detail = () => {
  const {
    chatId,
    user,
    isCurrentUserBlocked,
    isReceiverBlocked,
    changeBlock,
    resetChat,
    toggleDetail,
  } = useChatStore();
  const { currentUser } = useUserStore();
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (!chatId) return;

    const fetchPhotos = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("img_url")
          .eq("chat_id", chatId)
          .not("img_url", "is", null);

        if (error) throw error;
        setPhotos(data);
      } catch (err) {
        console.log(err);
      }
    };

    fetchPhotos();
  }, [chatId]);

  const handleBlock = async () => {
    if (!user || !currentUser) return;

    const newBlockedList = isReceiverBlocked
      ? currentUser.blocked.filter((id) => id !== user.id)
      : [...currentUser.blocked, user.id];

    try {
      await supabase
        .from("users")
        .update({ blocked: newBlockedList })
        .eq("id", currentUser.id);

      changeBlock();
      toast.success(isReceiverBlocked ? "User unblocked." : "User blocked.");
    } catch (err) {
      console.log(err);
      toast.error("An error occurred.");
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      resetChat();
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="detail">
      <div className="user">
        <img
          src="./arrow-left.png"
          alt="Back to chat"
          className="back-button"
          onClick={toggleDetail}
        />
        <img src={user?.avatar_url || "./avatar.png"} alt="" />
        <h2>{user?.username}</h2>
        <p>User description placeholder.</p>
      </div>
      <div className="info">
        <div className="option">
          <div className="title">
            <span>Chat Settings</span>
            <img src="./arrowUp.png" alt="" />
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span>Privacy & help</span>
            <img src="./arrowUp.png" alt="" />
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span>Shared photos</span>
            <img src="./arrowDown.png" alt="" />
          </div>
          <div className="photos">
            {photos.map((photo, index) => (
              <div className="photoItem" key={index}>
                <div className="photoDetail">
                  <img src={photo.img_url} alt="Shared" />
                  <span>photo_{index + 1}.png</span>
                </div>
                <a href={photo.img_url} download>
                  <img src="./download.png" alt="Download" className="icon" />
                </a>
              </div>
            ))}
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span>Shared Files</span>
            <img src="./arrowUp.png" alt="" />
          </div>
        </div>
        <button className="block glitch" onClick={handleBlock}>
          {isCurrentUserBlocked
            ? "You are Blocked!"
            : isReceiverBlocked
            ? "User blocked"
            : "Block User"}
        </button>
        <button className="logout btn liquid" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Detail;
