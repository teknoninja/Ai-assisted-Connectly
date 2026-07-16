import { supabase } from './supabase';//You import your configured Supabase client from your supabase.js file. This gives you access to all Supabase services, including supabase.storage.
//This is a simple utility module for file uploads. It creates a unique file path using Date.now() and uploads the file to the 'avatars' storage bucket in Supabase. This is great for handling profile picture changes.
//it takes a file, uploads it to your 'avatars' bucket in Supabase, and gives you back the public URL to access it.
const upload = async (file) => {//It's async because it will use the await keyword to wait for Supabase's (asynchronous) upload process to finish
  if (!file) {
    return null;//If the function is accidentally called with no file (i.e., file is null or undefined), it immediately stops and returns null.
  }

  try {//You start a try block. Because file uploads involve network requests, they can fail for many reasons (no internet, Supabase permissions error, etc.). This block lets you "try" the risky code, and if anything inside it throws an error, the catch block at the end will "catch" it and handle it .
    // Create a unique file path.You create a string for the file's path inside the Supabase bucket.
    const filePath = `public/${Date.now()}_${file.name}`;
//You've decided to put all avatars inside a folder named public.
//${Date.now()}: This is the key to making the path unique. Date.now() returns the current time in milliseconds (e.g., 1678886400000). This ensures that even if two users upload a file named profile.jpg, they won't overwrite each other's file.The final path would look something like: public/1678886400000_profile.jpg.

    // Upload the file to the 'avatars' bucket
    const {  error } = await supabase.storage// You tell the code to "wait" at this line until the storage operation is complete.
      .from('avatars')//You select your storage bucket named 'avatars'.
      .upload(filePath, file);//You call the upload method, passing it the unique path you just created (filePath) and the actual file object.

    if (error) {//it means the upload failed.and jumps down to the catch block, passing the error object to it.
      throw error;
    }

    // Get the public URL of the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')//This is a nested destructuring. The response object looks like { data: { publicUrl: '...' } }. This line neatly extracts the URL string and puts it into a variable called publicUrl.
      .getPublicUrl(filePath);
    
    return publicUrl;//The function successfully completes and returns the public URL.The component that called upload(file) will receive this URL.
  } catch (error) {//This block only runs if an error was thrown inside the try block.
    console.error('Error uploading file:', error.message);
    throw new Error('File upload failed.');//You throw a new, more generic error. This is good practice because it tells the part of your code that called upload that the process failed, without needing to expose the complex details of the original Supabase error. The component can then use this to show a generic "Upload failed, please try again" message to the user.
  }
};

export default upload;
