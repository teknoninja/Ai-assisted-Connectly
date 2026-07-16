import React, { useState } from 'react';
import "./login.css";
import { toast } from 'react-toastify';//You import the toast function, which you'll call to show pop-up notifications (e.g., "Logged in successfully!").
import { supabase } from "../lib/supabase.js";
import upload from "../lib/upload.js";//You import the upload helper function you wrote, which you'll use to upload the user's avatar to Supabase Storage.
//It's a "dual-purpose" component that cleverly handles both user registration and user login in a single file by using a piece of state (isRegistering) to toggle between the two forms.
const Login = () => {
  const [avatar, setAvatar] = useState({//This sets up a piece of state to manage the profile picture.
    file: null,//This will hold the raw File object from the user's computer, ready to be uploaded.
    url: "",//This will hold a temporary local URL for the image. This is used to show the user a preview of their avatar before it's uploaded.
  });
  const [loading, setLoading] = useState(false);//A boolean state to track when an async operation (like logging in or signing up) is in progress. This is used to disable the submit button.
  const [isRegistering, setIsRegistering] = useState(false);//By default, it's false, meaning the component will show the Login form. If it's true, it will show the Registration form.

  const handleAvatar = (e) => {//This function is an event handler that runs when the user selects a file in the <input type="file">.
    if (e.target.files[0]) {//A safety check to make sure the user actually selected a file.
      setAvatar({//Updates the avatar state.
        file: e.target.files[0],
        url: URL.createObjectURL(e.target.files[0]),//This is a browser API. It creates a temporary URL (like blob:http://...) for the file on the user's computer. This is what allows you to display the image preview in the <img> tag instantly.
      });
    }
  };

  //This single function handles both login and registration.
  const handleAuth = async (e) => {//Defines an async function to handle the form submission.
    e.preventDefault();//This stops the browser's default form submission behavior (which is to refresh the page).
    setLoading(true);//Sets the loading state to true, which will disable the submit button and show "Loading...".
    const formData = new FormData(e.target);//A browser API that grabs the form (e.target) and creates a FormData object containing all fields that have a name attribute.
    const { username, email, password } = Object.fromEntries(formData);//A clean way to turn the FormData object into a plain JavaScript object.

    try {//Starts a try...catch block, which is essential for handling errors from async operations.
      if (isRegistering) {
        // --- REGISTRATION LOGIC ---
        if (password.length < 6) {
          toast.error("Password should be at least 6 characters.");//If validation fails, it shows a toast and stops the function. The finally block will still run.
          return;
        }
        //This is the first call to Supabase. It attempts to create a new user in the auth.users table.
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;//If signUp fails (e.g., user already exists), it throws an error, which stops the try block and moves to the catch block

        const imgUrl = await upload(avatar.file);//If signUp succeeds, it calls your upload utility to upload the avatar.

        //This is the second call to Supabase. It inserts a new row into your public users table.
        const { error: insertError } = await supabase.from('users').insert({
          id: authData.user.id,//This is the most important line in your registration. It links your profile data in the users table to the new user in the auth.users table using their unique ID.
          username,
          email,
          avatar_url: imgUrl,
        });
        if (insertError) throw insertError;

        toast.success("Account created! Now please login everytime with the same email .");
      } else {//If isRegistering was false, this block runs means user already registered
        // --- LOGIN LOGIC ---
        const { error } = await supabase.auth.signInWithPassword({//This is the only Supabase call needed for login. It attempts to sign the user in.
          email,
          password,
        });
        if (error) throw error;//If it fails (wrong password, user not found), it throws an error.
        toast.success("Logged in successfully!");
      }
    } catch (error) {//This block "catches" any error that was thrown from the try block.
      console.error(error);
      toast.error(error.message);//It shows the user a "toast" with the error message.
    } finally {//This block always runs, whether the try was successful or the catch was triggered.
      setLoading(false);//It resets the loading state, re-enabling the button so the user can try again.
    }
  };

  return (
    <div className="login">
      {isRegistering ? (//This part uses a ternary operator (... ? ... : ...) to decide which form to show.This is the main UI logic. "If isRegistering is true, show the first block (Registration Form). If not, show the second block (Login Form)."
        // --- REGISTRATION FORM ---
        <div className="item">
          <h2>Create an Account</h2>
          <form onSubmit={handleAuth}>
          {/* Connects the form's submit event to your handleAuth function. */}
            <label htmlFor="file">
            {/* A styled label that acts as the file input. Clicking this label will trigger the hidden file input. */}
            {/* Displays the image. It shows the avatar.url (the local preview) if one has been selected. Otherwise, it shows a default avatar.png. */}
              <img src={avatar.url || "./avatar.png"} alt="Avatar Preview" />
              Upload Profile image
            </label>
            <input type="file" id='file' style={{ display: "none" }} onChange={handleAvatar} />
            {/* The actual file input. It's hidden so it can be styled via the <label>. Its onChange event is linked to handleAvatar. */}
            <input type="text" placeholder='Username' name='username' required />
            <input type="email" placeholder='Email' name='email' required />
            <input type="password" placeholder='Password' name='password' required />
            <button className="btn liquid" disabled={loading}>{loading ? "Loading..." : "Sign Up"}</button>
            {/* A "smart" button. It's disabled when loading is true. The text inside also changes from "Sign Up" to "Loading...". */}
          </form>
          <p>
            Already have an account?{" "}
            <a href="#" onClick={() => setIsRegistering(false)}>
            {/* This is the toggle link. When clicked, it sets the state isRegistering to false, causing React to re-render and show the Login form. */}
              Login
            </a>
          </p>
        </div>
      ) : (
        // --- LOGIN FORM ---
        <div className="item">
          <h1>CONNECTly  💬 </h1>
          <form onSubmit={handleAuth}>
          {/* It uses the exact same submit handler. handleAuth knows what to do because isRegistering is false. */}
            <input type="email" placeholder='Email' name='email' required />
            <input type="password" placeholder='Password' name='password' required />
            <button className="btn liquid" disabled={loading}>{loading ? "Loading..." : "Sign In"}</button>
          </form>
          <p>
            Don't have an account?{" "}
            {/* The other toggle link. When clicked, it sets isRegistering to true, causing React to re-render and show the Registration form. */}
            <a href="#" onClick={() => setIsRegistering(true)}>
              Register
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

export default Login;
