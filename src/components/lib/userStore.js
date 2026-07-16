/*we use Zustand primarily to solve the problem of Global State Management.

In a standard React app without a state management library, data is passed from parent to child via "props." However, as your chat app grows, passing the logged-in user's data (username, avatar, ID) through every single component layer—a process known as Prop Drilling—becomes incredibly messy and hard to maintain.

Your userStore acts as a single, central location that knows who is currently logged in.

1.Accessibility: Instead of App.jsx having to pass the currentUser object down to List.jsx, then to UserInfo.jsx, and then to Chat.jsx, any component can simply "ask" the userStore for that data directly.
2.Cleaner Components: Your App.jsx remains small and readable because it only calls fetchUserInfo() rather than containing all the code to talk to Supabase itself.
3.In your project, you specifically used Zustand because it allows one store to talk to another. For example, in your ChatStore.js, you used useUserStore.getState().currentUser to check if the current user was blocked by the person they clicked on. This kind of logic is much harder to implement using standard React Context.*/

import { create } from 'zustand';
import { supabase } from './supabase';//This object is your gateway to all Supabase services (Auth, Database, etc.).

// Create the Zustand store
export const useUserStore = create((set) => ({//You call the create function, which takes one argument: a function. This function gives you access to set, which is the only way to update the state in your store
  currentUser: null,//You initialize it to null because when the app first loads, you don't know if a user is logged in. If a user logs in, this will be updated to hold their user object (e.g., { id: '...', username: 'shivam', ... }).
  isLoading: true, // Start with loading state true.By starting it as true, you can tell your app to show a loading spinner or a blank screen. This prevents the app from "flickering"
  
  // Action to fetch user data based on the current session .This is an asynchronous function you can call from your components (like App.jsx) to check the user's session and get their profile.
  fetchUserInfo: async () => {
    try {//You wrap your logic in a try...catch block. This is essential for handling any network or database errors 
      // Get the current user session from Supabase
      const { data: { session } } = await supabase.auth.getSession();//You ask the Supabase client to check for a current session. This checks if the user is already logged in (e.g., from a previous visit, using a secure cookie).
      //{ data: { session } }: This is just destructuring the response to get directly to the session object, which will be null if no one is logged in.

      if (session?.user) {
        // If a user is logged in, fetch their profile from the 'users' table
        const { data, error } = await supabase//This is your database query. Now that you have the user's auth ID (session.user.id), you fetch their profile from your users table.
          .from('users')//Select the users table.
          .select('*')//Get all columns (like username, avatar_url, etc.).
          .eq('id', session.user.id)//Filter the table to find the one row where the id column matches the authenticated user's ID
          .single();//You tell Supabase you only expect one result. This makes it return a single object instead of an array, which is cleaner.
          
        if (error) throw error;//: If the database query failed, this line will stop execution and jump to the catch block.
        set({ currentUser: data, isLoading: false });//Success! You call the set function to update the global state. currentUser is now the full user profile from your database, and isLoading is set to false because the loading is done.
      } else {
        // If no user is logged in, set state to null.
        set({ currentUser: null, isLoading: false });
      }
    } catch (error) {//This catch block runs if any error happened inside the try block.
      console.error("Error fetching user info:", error.message);//It logs the error to the console for debugging.
      set({ currentUser: null, isLoading: false });//It puts the app in a safe, logged-out state by setting currentUser to null and isLoading to false.
    }
  },

  // Merge profile changes (e.g. after editing username/avatar) into the store
  updateCurrentUser: (updates) =>
    set((state) => ({ currentUser: { ...state.currentUser, ...updates } })),

  // Action to handle user logout
  logout: async () => {
    await supabase.auth.signOut();//You tell the Supabase client to sign the user out. This invalidates their session and clears the auth cookie.
    set({ currentUser: null });//After the user is signed out, you update your global state to null. This will cause your React components to re-render, and your app will (likely) automatically show the Login page.
  }
}));