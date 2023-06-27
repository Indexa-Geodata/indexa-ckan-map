import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

require('dotenv').config()
console.log(process.env);

// mapboxgl.accessToken = process.env.MAPBOX_TOKEN;

export default function Map() {
    const map = useRef(null);
    const mapContainer = useRef(null);

    useEffect(() => {
        if (map.current) return;
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-5.984040411639227, 37.38862867862967],
            zoom: 6.0
        });
    }, []);

    return (<div ref={mapContainer} className="map-container" id='map-container'>

    </div>
    );
}