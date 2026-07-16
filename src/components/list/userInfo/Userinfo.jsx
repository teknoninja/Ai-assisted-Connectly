import React, { useState, useRef, useEffect } from 'react';
import "./userInfo.css";
import { useUserStore } from "../../lib/userStore"; // Import the Zustand store
import { useAiStore } from "../../lib/aiStore"; // Store controlling the AI companion panel
import { useChatStore } from "../../lib/chatStore";
import EditProfile from "./editProfile/EditProfile";

const Userinfo = () => {
  // Get the current user's data from the Zustand store
  const { currentUser, logout } = useUserStore();
  const { toggleAi } = useAiStore();
  const { resetChat } = useChatStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const settingsRef = useRef(null);

  // Close the settings dropdown when clicking anywhere outside it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      resetChat();
      await logout();
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className='userInfo'>
      <div className="user">
        {/* Display the user's avatar, or a default one if it doesn't exist */}
        <img src={currentUser.avatar_url || "./avatar.png"} alt="User Avatar" />
        {/* Display the user's username */}
        <h2>{currentUser.username}</h2>
      </div>
      <div className="icons">
        <button className="aiButton" onClick={toggleAi} title="Chat with Connectly AI">✨ AI</button>
        <img
          src="./edit.png"
          alt="Edit profile"
          title="Edit profile"
          onClick={() => setEditOpen(true)}
        />
        <div className="settings" ref={settingsRef}>
          <div
            className="settingsToggle"
            onClick={() => setSettingsOpen((prev) => !prev)}
            title="Settings"
          >
            <img src="./info.png" alt="Settings" />
            <span>Settings</span>
          </div>
          {settingsOpen && (
            <div className="settingsMenu">
              <button className="logoutButton" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      {editOpen && <EditProfile onClose={() => setEditOpen(false)} />}
    </div>
  );
};

export default Userinfo;
