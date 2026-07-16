import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(//The .render() function is what officially "starts" the application, telling React to build your App component and all its children and inject the resulting HTML into the <div id="root"> element.
//document.getElementById('root'): This searches your index.html file (which you haven't shown, but it's there) for an HTML element that has the ID root. This is typically an empty <div> like <div id="root"></div>
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
