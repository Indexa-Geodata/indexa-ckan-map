import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import municipios from './municipios.json';
import provincias from './provincias.json';
import Papa from 'papaparse';
import { getStops, getDimensions, getUrnCL, getCodelist, getParamName, getCodeName, getPunteros, getCodToKeep, getAllValues, populatePoligonos, updateMap } from './Utils';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const URL_RESOURCES = process.env.REACT_APP_URL_RESOURCES;
mapboxgl.accessToken = MAPBOX_TOKEN;

export default function Map() {
    const map = useRef(null);
    const mapContainer = useRef(null);
    const urlParams = new URLSearchParams(window.location.search);
    let csvLookup = {};
    let csvParams = {};
    let allValues = {};
    let punteros = {};
    let dsd = {};
    const [legendValues, setLegendValues] = useState([[0], [0], [0], [0], [0]]);
    let poligonos = provincias;

    useEffect(() => {
        if (map.current) return;
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-5.984040411639227, 37.38862867862967],
            zoom: 7.0
        });
    }, [map]);

    useEffect(() => {
        if (!map.current) return;
        const dataset = urlParams.get('dataset');
        const resourceCsv = urlParams.get('resource-csv');
        const urlCsv = `${URL_RESOURCES}${dataset}/resource/${resourceCsv}/download`;
        const resourceJson = urlParams.get('resource-json');
        const urlJson = `${URL_RESOURCES}${dataset}/resource/${resourceJson}/download`;
        fetch(urlJson).then(response => response.json()).then(jsonData => { dsd = jsonData;}).catch(error => { console.log(error) });
        fetch(urlCsv)
            .then(response => response.text())
            .then(csvData => {
                Papa.parse(csvData, {
                    complete: function (results) {
                        punteros = getPunteros(results);
                        for (const puntero in punteros){
                            if (puntero !== 'TERRITORIO' && puntero !== 'OBS_VALUE') {
                                csvParams[puntero] = results.data[1][punteros[puntero]];
                            }
                        }
                        const codToKeep = getCodToKeep(municipios, provincias);

                        results.data.forEach(row => {
                            if (codToKeep.indexOf(row[punteros.TERRITORIO]) !== -1) {
                                if (!csvLookup[row[punteros.TERRITORIO]]) csvLookup[row[punteros.TERRITORIO]] = [];
                                csvLookup[row[punteros.TERRITORIO]][csvLookup[row[punteros.TERRITORIO]].length] = row;
                            }
                        });
                        const firstPolygon = csvLookup.keys()[0];
                        let dataHasProvincias = false;
                        for(const provincia in provincias.features){
                            if(provincia.properties.cod === firstPolygon){
                                dataHasProvincias = true;
                                break;
                            }
                        }
                        if(dataHasProvincias){
                            poligonos = provincias;
                        }else{
                            poligonos = municipios;
                        }
                        populatePoligonos(poligonos, csvLookup, csvParams, punteros);
                        allValues = getAllValues(csvParams, results, punteros);
                    }
                })
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }, []);
    useEffect(() => {
        if (!map.current) return;
        if (!dsd) return;
        if (!csvLookup) return;

        const popup = new mapboxgl.Popup({
            closeButton: false
        });
        map.current.on('load', () => {
            map.current.addSource('dataset-source', {
                'type': 'geojson',
                'data': poligonos,
            });
            setLegendValues(getStops(poligonos));
            map.current.addLayer({
                "id": "dataset-layer-fill",
                "source": 'dataset-source',
                "type": "fill",
                "paint": {
                    "fill-color":
                    {
                        "property": "value",
                        "stops": getStops(poligonos)
                    },
                    "fill-opacity": 0.6
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
                if (allValues[param].length <= 1) continue;
                const dimensions = getDimensions(dsd);
                const urnCl = getUrnCL(param, dimensions);
                const codelist = getCodelist(urnCl, dsd);
                const paramName = getParamName(codelist);
                const paramSelect = document.createElement('select');
                paramSelect.toggleAttribute('class', 'form-select');
                paramSelect.toggleAttribute('aria-label', 'Default select example');
                const paramText = document.createElement('p');

                paramSelect.setAttribute('param', param);
                for (const paramValues of allValues[param]) {
                    const option = document.createElement('option');
                    option.setAttribute('code', paramValues);
                    option.textContent = getCodeName(codelist, paramValues);
                    paramSelect.appendChild(option);
                }
                paramText.textContent = `${paramName}:`;
                paramSelect.addEventListener('change', event => {
                    const selectedOptionTag = event.target.selectedOptions[0];
                    const selectedOption = selectedOptionTag.getAttribute('code');
                    const selectedParam = paramSelect.getAttribute('param');
                    csvParams[selectedParam] = selectedOption;

                    populatePoligonos(poligonos, csvLookup, csvParams, punteros);
                    updateMap(poligonos, map, setLegendValues);
                });

                const selectProMun = document.getElementById('provmun');
                selectProMun.addEventListener('change', event =>{
                    const newPoligonos = event.target.value;
                    if (newPoligonos ==='Provincias'){
                        poligonos = provincias;
                    }else{
                        poligonos = municipios;
                    }
                    populatePoligonos(poligonos, csvLookup, csvParams, punteros);
                    updateMap(poligonos, map, setLegendValues);
                    
                });
                filter.appendChild(paramText);
                filter.appendChild(paramSelect);
            }
        });
        map.current.on('mousemove', 'dataset-layer-fill', (e) => {
            map.current.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            popup
                .setLngLat(e.lngLat)
                .setHTML(`<p>${feature.properties.nombre}</p><p>${feature.properties.value}</p>`
                )
                .addTo(map.current);

        });
        map.current.on('mouseleave', 'dataset-layer-fill', () => {
            map.current.getCanvas().style.cursor = '';
            popup.remove();
        });
    }, [dsd.csvLookup, poligonos]);
    return (
        <div>
            <div ref={mapContainer} className="map-container" id='map-container' />
            <div className="filter" id="filter" >
                <p>Unidad territorial:</p>
                <select id='provmun'>
                    <option value="Provincias">
                        Provincias
                    </option>
                    <option value="Municipios">
                        Municipios
                    </option>
                </select>
            </div>
            <nav className="legend" id="legend" >
                <span style={{ 'background': '#ffdac8' }}></span>
                <span style={{ 'background': '#FFCCCC' }}></span>
                <span style={{ 'background': '#FF9999' }}></span>
                <span style={{ 'background': '#FF6666' }}></span>
                <span style={{ 'background': '#FF3333' }}></span>
                <label>&lt;={legendValues[0][0]}</label>
                <label>{legendValues[1][0]}</label>
                <label>{legendValues[2][0]}</label>
                <label>{legendValues[3][0]}</label>
                <label>&gt;={legendValues[4][0]}</label>
            </nav>
        </div>
    );
}