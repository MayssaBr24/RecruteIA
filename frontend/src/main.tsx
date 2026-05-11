import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'

//ReactDOM.createRoot(document.getElementById('root')!).render(
  //<React.StrictMode>
    //<App />
  //</React.StrictMode>,
//)
ReactDOM.createRoot(document.getElementById('root')!).render(
    <GoogleReCaptchaProvider reCaptchaKey="6LdZUNosAAAAAINqS8fCQMLL41UCt2JwWrvrd7qK">
        <App />
    </GoogleReCaptchaProvider>
)