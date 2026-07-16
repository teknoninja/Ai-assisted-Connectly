import { useEffect } from "react";//used to perform "side effects"—tasks that run after the component renders, like fetching data or setting up event listeners.
import Chat from "./components/chat/Chats";
import Detail from "./components/detail/Detail";
import List from "./components/list/List";
import Login from "./components/login/Login";
import Notification from "./components/notification/Notification";
import { useUserStore } from "./components/lib/userStore";//you import the custom hook for your UserStore. This gives you access to the currentUser and the fetchUserInfo action.
import { useChatStore } from "./components/lib/chatStore";//You import the custom hook for your ChatStore. This gives you access to the chatId to know which chat is active.
import { useAiStore } from "./components/lib/aiStore";//Store that tracks whether the AI companion panel is open.
import AiCompanion from "./components/aiCompanion/AiCompanion";//The RAG-powered AI companion panel.
import { supabase } from "./components/lib/supabase"; // Import the Supabase client.You import your Supabase client. You need this to listen for authentication events.
import Background from "./background";
//this file is the root component and the main "control center" .Its primary job is to figure out if a user is logged in and then decide whether to show the main chat interface or the login page.

const App = () => {
  const { currentUser, isLoading, fetchUserInfo } = useUserStore();//You are "subscribing" to the UserStore.
 const { chatId, isDetailOpen } = useChatStore();//You subscribe to the ChatStore to get the chatId and isDetailOpen state. Your component will now automatically re-render whenever any of these values (currentUser, isLoading, chatId, etc.) change.
 const { isAiOpen } = useAiStore();//Subscribe to the AI store so the app re-renders when the AI panel opens/closes.

  useEffect(() => {
    // You tell React to run the code inside this function once when the App component first loads.
    fetchUserInfo();//This checks Supabase: "Is a user already logged in from a previous visit?"


    // Listen for authentication state changes (login, logout).This is a key Supabase feature. You are setting up a real-time listener that watches for auth events.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // When the auth state changes, re-fetch the user info.you call fetchUserInfo() again
        fetchUserInfo();//If the user just logged in, this call will get their session, fetch their profile, and set currentUser, causing your app to re-render and show the chat UI.
        //If the user just logged out, this call will find no session, set currentUser to null, and cause your app to re-render and show the Login component.
      }
    );

    // Cleanup the listener when the component unmounts.This is the cleanup function. React runs this function when the component is "unmounted" (e.g., the user closes the browser tab)
    return () => {
      authListener.subscription.unsubscribe();//This is critical for preventing memory leaks. It tells Supabase, "Stop listening for auth changes; this component is gone."
    };
  }, [fetchUserInfo]);

  if (isLoading) return <div className="loading">Loading...</div>;//While fetchUserInfo() is running for the first time, isLoading is true. This line stops the rest of the component from rendering and only shows a "Loading..." message.

  //The Main UI (Conditional Rendering)
  return (
    <>
    <Background/>
    {/* You render your background component. */}
    <div className={isAiOpen ? "container ai-open" : "container"}>
      {currentUser ? (//IF currentUser is true (an object exists, meaning the user is logged in):
        <>
          <List />
        {/* /* It renders the <List /> component (the chat list). */}

         {chatId && <Chat />} {chatId && isDetailOpen && <Detail />}
         {isAiOpen && <AiCompanion />}
         {/* The AI companion panel — opened via the ✨ button in the user info bar. */}
         {/* This is a "short-circuit." It means "if chatId is not null, then render the <Chat /> component." */}
         {/* A further short-circuit. "if chatId is not null AND isDetailOpen is true, then render the <Detail /> component." */}
        </>

      ) : (//IF currentUser is false (null, meaning the user is logged out)
        <Login />
        // It renders the <Login /> component.
        )}
      <Notification />
      {/* You render the Notification component outside the conditional logic. This means it's always on the screen, whether the user is logged in or not, ready to display any pop-up messages. */}
    </div>
        </>
  );
};

export default App;//This makes your App component available to be imported and rendered by your main.jsx
