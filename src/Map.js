import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

require('dotenv').config()

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const URL_RESOURCES = process.env.REACT_APP_URL_RESOURCES;

mapboxgl.accessToken = MAPBOX_TOKEN;

export default function Map() {
    const map = useRef(null);
    const mapContainer = useRef(null);
    const urlParams = new URLSearchParams(window.location.search);

    useEffect(() => {
        if (map.current) return;
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-5.984040411639227, 37.38862867862967],
            zoom: 7.0
        });
    }, []);

    useEffect(() => {
        if (!map.current) return;
        const dataset = urlParams.get('dataset');
        const resource = urlParams.get('resource');
        const fileName = urlParams.get('file-name')
        const url = `${URL_RESOURCES}${dataset}/resource/${resource}/download/${fileName}`;
        map.current.on('load', ()=>{
            map.current.addSource('dataset-source',{
                'type': 'geojson',
                'data': url,
            });
            map.current.addLayer({
                "id": "dataset-layer",
                "source": 'dataset-source',
                "type": "line",
                "paint": {
                    "line-color": "#000000",
                }
            });
        });
    },[]);
    return (
        <div ref={mapContainer} className="map-container" id='map-container'>
        </div>
    );
}