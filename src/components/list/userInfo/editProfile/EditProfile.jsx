import "./editProfile.css";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useUserStore } from "../../../lib/userStore";
import upload from "../../../lib/upload";
import { toast } from "react-toastify";

const EditProfile = ({ onClose }) => {
  const { currentUser, updateCurrentUser } = useUserStore();

  const [username, setUsername] = useState(currentUser.username || "");
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [saving, setSaving] = useState(false);

  const modalRef = useRef(null);

  // Close the modal when a click lands outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleAvatar = (e) => {
    if (e.target.files[0]) {
      setAvatar({
        file: e.target.files[0],
        url: URL.createObjectURL(e.target.files[0]),
      });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast.error("Username cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      // Make sure the new username isn't already taken by someone else
      if (trimmedUsername !== currentUser.username) {
        const { data: existing, error: checkError } = await supabase
          .from("users")
          .select("id")
          .eq("username", trimmedUsername)
          .neq("id", currentUser.id)
          .maybeSingle();

        if (checkError) throw checkError;
        if (existing) {
          toast.error("That username is already taken.");
          setSaving(false);
          return;
        }
      }

      // Upload the new avatar (if one was picked) and get its public URL
      let avatarUrl = currentUser.avatar_url;
      if (avatar.file) {
        avatarUrl = await upload(avatar.file);
      }

      const { error } = await supabase
        .from("users")
        .update({ username: trimmedUsername, avatar_url: avatarUrl })
        .eq("id", currentUser.id);

      if (error) throw error;

      updateCurrentUser({ username: trimmedUsername, avatar_url: avatarUrl });
      toast.success("Profile updated!");
      onClose();
    } catch (err) {
      console.log(err);
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editProfileOverlay">
      <div className="editProfile" ref={modalRef}>
        <h3>Edit Profile</h3>
        <form onSubmit={handleSave}>
          <label htmlFor="editAvatarFile" className="avatarPicker">
            <img
              src={avatar.url || currentUser.avatar_url || "./avatar.png"}
              alt="Avatar preview"
            />
            <span>Change avatar</span>
          </label>
          <input
            type="file"
            id="editAvatarFile"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatar}
          />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <div className="actions">
            <button type="button" className="cancelButton" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfile;
