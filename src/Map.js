import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import municipios from './municipios.json';
import Papa from 'papaparse';
require('dotenv').config()

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const URL_RESOURCES = process.env.REACT_APP_URL_RESOURCES;

mapboxgl.accessToken = MAPBOX_TOKEN;

function filterCsvByParams(objects, params, puntero) {
    let hasAllParams;
    for (const obj of objects) {
        hasAllParams = true
        for (const key in params) {
            hasAllParams = hasAllParams && obj.includes(params[key]);
        }
        if (hasAllParams) {
            return obj[puntero];
        }
    }
    return 'NaN';
}

export default function Map() {
    const map = useRef(null);
    const mapContainer = useRef(null);
    const urlParams = new URLSearchParams(window.location.search);
    const csvLookup = {};
    const csvParams = {};
    const allValues = {};
    const punteros = {};

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
        fetch(url)
            .then(response => response.text())
            .then(csvData => {
                Papa.parse(csvData, {
                    complete: function (results) {
                        
                        for (let i = 0; i < results.data[0].length; i++) {
                            let columnName = results.data[0][i];
                            punteros[columnName] = i;
                            if (columnName !== 'TERRITORIO' && columnName !== 'OBS_VALUE') {
                                csvParams[columnName] = results.data[1][i];
                            }
                        }
                        results.data.forEach(row => {
                            if (!csvLookup[row[punteros.TERRITORIO]]) csvLookup[row[punteros.TERRITORIO]] = [];
                            csvLookup[row[punteros.TERRITORIO]][csvLookup[row[punteros.TERRITORIO]].length] = row;
                        });
                        municipios.features.forEach(obj => {
                            const codMun = obj.properties.cod_mun;
                            obj.properties.value = parseFloat(filterCsvByParams(csvLookup[codMun], csvParams, punteros.OBS_VALUE));
                        });

                        for (const param in csvParams) {
                            allValues[param] = Array.from(new Set(results.data.map(subArray => subArray[punteros[param]])));
                            allValues[param].shift();
                            allValues[param].pop();
                        }
                        console.log(allValues);
                    }
                })
            })
            .catch(error => {
                console.error('Error:', error);
            });
        map.current.on('load', () => {
            map.current.addSource('dataset-source', {
                'type': 'geojson',
                'data': municipios,
            });
            map.current.addLayer({
                "id": "dataset-layer-fill",
                "source": 'dataset-source',
                "type": "fill",
                "paint": {
                    "fill-color": {
                        "property": "value",
                        "stops": [
                            [0., '#3288bd'],
                            [100., '#66c2a5'],
                            [200., '#abdda4'],
                            [300., '#e6f598'],
                            [400., '#ffffbf'],
                            [500., '#fee08b'],
                            [600., '#fdae61'],
                            [700., '#f46d43'],
                            [800., '#d53e4f']
                        ]
                    },
                    "fill-opacity": 0.5
                }
            });
            map.current.addLayer({
                "id": "dataset-layer-line",
                "source": 'dataset-source',
                "type": "line",
                "paint": {
                    "line-width": 2,
                    "line-color": "#000000",
                    "line-opacity": 0.2
                }
            });
            const filter = document.getElementById('filter');
            for (const param in csvParams) {
                const paramSelect = document.createElement('select');
                const paramText = document.createElement('p');
                
                paramSelect.setAttribute('param', param);
                for (const paramValues of allValues[param]) {
                    const option = document.createElement('option');
                    option.textContent = paramValues;
                    paramSelect.appendChild(option);
                }
                paramText.textContent = param;
                paramSelect.addEventListener('change', event=>{
                    const selectedOption = event.target.value;
                    const selectedParam = paramSelect.getAttribute('param');
                    csvParams[selectedParam] = selectedOption;
                    console.log(csvParams);
                    municipios.features.forEach(obj => {
                        const codMun = obj.properties.cod_mun;
                        obj.properties.value = parseFloat(filterCsvByParams(csvLookup[codMun], csvParams, punteros.OBS_VALUE));
                    });
                    map.current.getSource('dataset-source').setData(municipios);
                });
                filter.appendChild(paramText);
                filter.appendChild(paramSelect);
            }
        });
    }, []);
    return (
        <div>
            <div ref={mapContainer} className="map-container" id='map-container' />
            <div className="filter" id="filter" />
        </div>
    );
}