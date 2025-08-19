import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { auth0Config } from './auth0-config';
import MainApp from './components/MainApp';
import './App.css';

function App() {
  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: auth0Config.redirectUri,
        audience: auth0Config.audience,
        scope: 'openid profile email place:orders',
      }}
    >
      <MainApp />
    </Auth0Provider>
  );
}

export default App;
