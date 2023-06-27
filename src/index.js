import React from 'react';
import ReactDOM from 'react-dom';
import 'mapbox-gl/dist/mapbox-gl.css';
import Map from './Map';
import './index.css';

ReactDOM.render(
    <React.StrictMode>
        <Map />
    </React.StrictMode>,
    document.getElementById('body')
);