import { ToastContainer } from "react-toastify";//You import the ToastContainer component from the react-toastify library. This component is the "manager" that knows how to render all the toasts you create.
import "react-toastify/dist/ReactToastify.css";//You import the default CSS file from the library. This is essential because it contains all the styling that makes the notifications look good. Without this, your notifications would be plain, unstyled HTML.

const Notification = () => {
  return (
    <div className=''>
      <ToastContainer position="bottom-right"/>
      {/* You are passing a prop to ToastContainer to tell it where on the screen all notifications should appear. In this case, any new toast will show up in the bottom-right corner. */}
    </div>
  )
}
//You only need to include this <Notification /> component once in your app (like you did in App.jsx).

// Now, from any other file (like your Login component), you can import the toast function and call it to show a message:

//like try {
  // ... code to log in ...
// } catch (error) {
  // This will make the notification appear!
  // toast.error(error.message); 
// }

export default Notification