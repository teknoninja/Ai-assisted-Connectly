import { create } from "zustand";
import { useUserStore } from "./userStore";//You are importing the hook for your other store. This allows ChatStore to read data from UserStore, specifically to get the currentUser object.
//This chatstore file is responsible for knowing which chat is currently open.
export const useChatStore = create((set) => ({//Creates and exports a custom React hook named useChatStore. Components will call this hook to get data about the active chat.The set function is the tool you'll use to change this store's state.
  chatId: null,//This will store the ID of the active conversation. It's null because no chat is open by default.
  user: null,//This will store the full user object of the other person you are chatting with.
  isCurrentUserBlocked: false,//This will be true if the user (the other person) has blocked you (currentUser).
  isReceiverBlocked: false,//This will be true if you (currentUser) have blocked the user (the other person).
  isDetailOpen: false, // This likely controls whether a side panel showing the other user's details is visible or not.

  // Action to toggle the detail panel's visibility
  toggleDetail: () => {
    set((state) => ({ isDetailOpen: !state.isDetailOpen }));//This is the "updater" form of set. It's used when your new state depends on the old state. state is the current state of the store.
    //if state.isDetailOpen was true, it becomes false, and vice-versa. This is the standard way to implement a toggle.
  },

  changeChat: (chatId, user) => {//It's called when the user clicks on a chat in the list.. It takes two arguments: the chatId of the conversation and the user object of the person they clicked on.
    const currentUser = useUserStore.getState().currentUser;
//This is how you read data from another store inside an action. useUserStore.getState() instantly gets the current state of UserStore, allowing you to grab the currentUser object.

    // CHECK IF CURRENT USER IS BLOCKED
    if (user.blocked.includes(currentUser.id)) {//This is your first security check. It looks at the blocked array on the other user's object (user) and checks if your ID (currentUser.id) is in it.
      return set({
        chatId,
        user: null,//It sets the user to null. This is a good way to prevent the UI from displaying the blocker's details.
        isCurrentUserBlocked: true,//It sets this flag. Your Chat.jsx component will read this and should display a "You are blocked" message and disable the text input.
        isReceiverBlocked: false,
      });
    }

    // CHECK IF RECEIVER IS BLOCKED
    else if (currentUser.blocked.includes(user.id)) {//This is the reverse check. It looks at your (currentUser) blocked array and checks if the other user's ID (user.id) is in it.
      return set({
        chatId,
        user: user,
        isCurrentUserBlocked: false,
        isReceiverBlocked: true,
      });
    } else {//It sets the state normally. The chat is fully active, and both block flags are false.It runs if no one is blocked.
      return set({
        chatId,
        user,
        isCurrentUserBlocked: false,
        isReceiverBlocked: false,
      });
    }
  },

  changeBlock: () => {//When you click a "Block User" button, your component would call this function and also call a separate function to update Supabase. This makes the UI feel instant.
    set((state) => ({ ...state, isReceiverBlocked: !state.isReceiverBlocked }));
  },
  
  resetChat: () => {//You would call this function when a user logs out (e.g., in your UserStore.js logout action). This ensures that if a new user logs in, they don't see a "flash" of the previous user's active chat.
    set({//It resets every single value in the store back to its original null or false state.
      chatId: null,
      user: null,
      isCurrentUserBlocked: false,
      isReceiverBlocked: false,
      isDetailOpen: false, // Also reset detail view on chat reset
    });
  },
}));
